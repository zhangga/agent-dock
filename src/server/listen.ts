import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface ListenWithPortFallbackOptions {
  host: string;
  port: number;
  maxAttempts?: number;
}

export interface StartedServer {
  server: Server;
  host: string;
  port: number;
  requestedPort: number;
  usedFallback: boolean;
}

export async function listenWithPortFallback(
  createServer: () => Server,
  options: ListenWithPortFallbackOptions
): Promise<StartedServer> {
  const maxAttempts = options.maxAttempts ?? 20;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidatePort = options.port === 0 ? 0 : options.port + attempt;
    const server = createServer();

    try {
      await listen(server, options.host, candidatePort);
      const address = server.address() as AddressInfo;

      return {
        server,
        host: options.host,
        port: address.port,
        requestedPort: options.port,
        usedFallback: options.port !== 0 && address.port !== options.port
      };
    } catch (error) {
      await closeQuietly(server);

      if (!isAddressInUse(error) || options.port === 0) {
        throw error;
      }
    }
  }

  throw new Error(
    `Could not find an available port from ${options.port} to ${options.port + maxAttempts - 1}.`
  );
}

function listen(server: Server, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      server.off("error", onError);
      server.off("listening", onListening);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onListening = () => {
      cleanup();
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

function closeQuietly(server: Server): Promise<void> {
  return new Promise((resolve) => {
    if (!server.listening) {
      resolve();
      return;
    }

    server.close(() => resolve());
  });
}

function isAddressInUse(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "EADDRINUSE"
  );
}
