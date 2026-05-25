import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, test } from "vitest";
import { createAgentDockServer } from "../../src/server/server.js";
import { listenWithPortFallback } from "../../src/server/listen.js";

const openServers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        })
    )
  );
});

async function occupyPort(): Promise<number> {
  const server = createServer((_request, response) => {
    response.writeHead(200);
    response.end("occupied");
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  openServers.push(server);
  return (server.address() as AddressInfo).port;
}

describe("listenWithPortFallback", () => {
  test("uses the requested port when it is available", async () => {
    const started = await listenWithPortFallback(() => createAgentDockServer(), {
      host: "127.0.0.1",
      port: 0
    });

    openServers.push(started.server);

    expect(started.port).toBeGreaterThan(0);
    expect(started.usedFallback).toBe(false);
  });

  test("falls back to the next port when the requested port is already in use", async () => {
    const occupiedPort = await occupyPort();

    const started = await listenWithPortFallback(() => createAgentDockServer(), {
      host: "127.0.0.1",
      port: occupiedPort,
      maxAttempts: 20
    });

    openServers.push(started.server);

    expect(started.port).toBeGreaterThan(occupiedPort);
    expect(started.usedFallback).toBe(true);
  });
});
