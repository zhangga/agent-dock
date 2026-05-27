#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createAgentDockServer } from "../server/server.js";
import { listenWithPortFallback } from "../server/listen.js";
import { scanInstalledSkills } from "../core/skillScanner.js";
import { formatPortBusyHelp } from "./portHelp.js";
import {
  parseCliArgs,
  runDiagnosticsCommand,
  runProfileExportCommand,
  runProfileImportCommand,
  type ParsedArgs
} from "./commands.js";

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.command === "help") {
    printHelp();
    return;
  }

  if (args.command === "status") {
    await printStatus(args.skillRoots);
    return;
  }

  if (args.command === "diagnostics") {
    const result = await runDiagnosticsCommand({ skillRoots: args.skillRoots });
    process.stdout.write(result.stdout);
    process.exitCode = result.exitCode;
    return;
  }

  if (args.command === "profile-export") {
    const result = await runProfileExportCommand({ outputPath: args.profileOutputPath });
    process.stdout.write(result.stdout);
    process.exitCode = result.exitCode;
    return;
  }

  if (args.command === "profile-import") {
    if (!args.profileInputPath) {
      console.error("Profile path is required.");
      process.exitCode = 1;
      return;
    }

    const result = await runProfileImportCommand({ profilePath: args.profileInputPath });
    process.stdout.write(result.stdout);
    process.exitCode = result.exitCode;
    return;
  }

  await startServer(args);
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
  agentdock diagnostics
  agentdock profile export [--output agentdock-profile.json]
  agentdock profile import agentdock-profile.json

Options:
  --skill-root <path>  Scan an additional explicit skill root. Repeatable.
  --host <host>       Host for the local console. Defaults to 127.0.0.1.
  --port <port>       Port for the local console. Defaults to 3789.
  --no-open           Do not open the browser automatically.
  --output <path>     Write profile export JSON to a file instead of stdout.
`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
