#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createAgentDockServer } from "../server/server.js";
import { listenWithPortFallback } from "../server/listen.js";
import { scanInstalledSkills } from "../core/skillScanner.js";
import { formatPortBusyHelp } from "./portHelp.js";

interface ParsedArgs {
  command: "serve" | "status" | "help";
  host: string;
  port: number;
  open: boolean;
  skillRoots?: string[];
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "help") {
    printHelp();
    return;
  }

  if (args.command === "status") {
    await printStatus(args.skillRoots);
    return;
  }

  await startServer(args);
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    command: "serve",
    host: "127.0.0.1",
    port: 3789,
    open: true
  };

  const rest = [...argv];
  const first = rest[0];
  if (first === "status" || first === "help") {
    parsed.command = first;
    rest.shift();
  }

  if (first === "--help" || first === "-h") {
    parsed.command = "help";
  }

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === "--host") {
      parsed.host = rest[++index] ?? parsed.host;
      continue;
    }

    if (arg === "--port") {
      parsed.port = Number(rest[++index] ?? parsed.port);
      continue;
    }

    if (arg === "--no-open") {
      parsed.open = false;
      continue;
    }

    if (arg === "--skill-root") {
      parsed.skillRoots = [...(parsed.skillRoots ?? []), rest[++index]];
    }
  }

  return parsed;
}

async function printStatus(skillRoots?: string[]): Promise<void> {
  const skills = await scanInstalledSkills({ roots: skillRoots });
  console.log(`Installed skills: ${skills.length}`);

  if (skills.length === 0) {
    console.log("No installed skills found in the scanned roots.");
    return;
  }

  for (const skill of skills) {
    const description = skill.description ? ` - ${skill.description}` : "";
    console.log(`- ${skill.name}${description}`);
    console.log(`  ${skill.installPath}`);
  }
}

async function startServer(args: ParsedArgs): Promise<void> {
  const started = await listenWithPortFallback(() => createAgentDockServer({ skillRoots: args.skillRoots }), {
    host: args.host,
    port: args.port
  });

  const url = `http://${args.host}:${started.port}`;
  console.log(`AgentDock is running at ${url}`);

  if (started.usedFallback) {
    console.log("");
    console.log(formatPortBusyHelp(started.requestedPort, started.port));
  }

  if (args.open) {
    openBrowser(url);
  }
}

function openBrowser(url: string): void {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { stdio: "ignore", detached: true });
  child.unref();
}

function printHelp(): void {
  console.log(`AgentDock

Usage:
  agentdock [--port 3789] [--no-open]
  agentdock status

Options:
  --skill-root <path>  Scan an additional explicit skill root. Repeatable.
  --host <host>       Host for the local console. Defaults to 127.0.0.1.
  --port <port>       Port for the local console. Defaults to 3789.
  --no-open           Do not open the browser automatically.
`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
