import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { readAgentDockConfig } from "../core/configStore.js";
import {
  runDiagnostics,
  summarizeDiagnostics,
  type DiagnosticCheck,
  type RunDiagnosticsOptions
} from "../core/diagnostics.js";
import {
  applyProfileImport,
  createProfileFromStack,
  parseProfileInput,
  type ProfileImportPreview
} from "../core/profileStore.js";
import { getDefaultStackPath, readStack, writeStackFile, type AgentDockStack } from "../core/stackStore.js";

export type CliCommand =
  | "serve"
  | "status"
  | "diagnostics"
  | "profile-export"
  | "profile-import"
  | "help";

export interface ParsedArgs {
  command: CliCommand;
  host: string;
  port: number;
  open: boolean;
  skillRoots?: string[];
  profileOutputPath?: string;
  profileInputPath?: string;
}

export interface CliCommandResult {
  exitCode: number;
  stdout: string;
  stderr?: string;
}

export interface RunDiagnosticsCommandOptions {
  skillRoots?: string[];
  stackPath?: string;
  runDiagnostics?: (options?: RunDiagnosticsOptions) => Promise<DiagnosticCheck[]>;
}

export interface RunProfileExportCommandOptions {
  outputPath?: string;
  stackPath?: string;
  now?: string;
  agentdockVersion?: string;
  readStack?: (options?: { stackPath?: string }) => Promise<AgentDockStack>;
}

export interface RunProfileImportCommandOptions {
  profilePath: string;
  stackPath?: string;
  readStack?: (options?: { stackPath?: string }) => Promise<AgentDockStack>;
}

export function parseCliArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    command: "serve",
    host: "127.0.0.1",
    port: 3789,
    open: true
  };

  const rest = [...argv];
  const first = rest[0];

  if (first === "--help" || first === "-h" || first === "help") {
    parsed.command = "help";
    if (first === "help") {
      rest.shift();
    }
  } else if (first === "status") {
    parsed.command = "status";
    rest.shift();
  } else if (first === "diagnostics") {
    parsed.command = "diagnostics";
    rest.shift();
  } else if (first === "profile") {
    rest.shift();
    const subcommand = rest.shift();

    if (subcommand === "export") {
      parsed.command = "profile-export";
    } else if (subcommand === "import") {
      parsed.command = "profile-import";
      parsed.profileInputPath = rest.shift();
    } else {
      parsed.command = "help";
    }
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
      continue;
    }

    if (arg === "--output") {
      parsed.profileOutputPath = rest[++index];
    }
  }

  return parsed;
}

export async function resolveConfiguredStackPath(stackPath?: string): Promise<string> {
  if (stackPath) {
    return stackPath;
  }

  const config = await readAgentDockConfig();
  return config.stackPath ?? getDefaultStackPath();
}

export async function runDiagnosticsCommand(
  options: RunDiagnosticsCommandOptions = {}
): Promise<CliCommandResult> {
  const stackPath = await resolveConfiguredStackPath(options.stackPath);
  const checks = await (options.runDiagnostics ?? runDiagnostics)({
    stackPath,
    skillRoots: options.skillRoots
  });
  const summary = summarizeDiagnostics(checks);
  const stdout = formatDiagnosticsReport(checks);

  return {
    exitCode: summary.error > 0 ? 1 : 0,
    stdout
  };
}

export async function runProfileExportCommand(
  options: RunProfileExportCommandOptions = {}
): Promise<CliCommandResult> {
  const stackPath = await resolveConfiguredStackPath(options.stackPath);
  const stack = await (options.readStack ?? readStack)({ stackPath });
  const profile = createProfileFromStack(stack, {
    exportedAt: options.now,
    agentdockVersion: options.agentdockVersion
  });
  const profileJson = `${JSON.stringify(profile, null, 2)}\n`;

  if (options.outputPath) {
    await mkdir(dirname(options.outputPath), { recursive: true });
    await writeFile(options.outputPath, profileJson, "utf8");
    return {
      exitCode: 0,
      stdout: `Profile exported to ${options.outputPath}\n`
    };
  }

  return {
    exitCode: 0,
    stdout: profileJson
  };
}

export async function runProfileImportCommand(
  options: RunProfileImportCommandOptions
): Promise<CliCommandResult> {
  const stackPath = await resolveConfiguredStackPath(options.stackPath);
  const [profileContent, stack] = await Promise.all([
    readFile(options.profilePath, "utf8"),
    (options.readStack ?? readStack)({ stackPath })
  ]);
  const profile = parseProfileInput(profileContent);
  const result = applyProfileImport(profile, stack);
  await writeStackFile(result.stack, { stackPath });

  return {
    exitCode: 0,
    stdout: formatProfileImportPreview(result.preview)
  };
}

export function formatDiagnosticsReport(checks: DiagnosticCheck[]): string {
  const summary = summarizeDiagnostics(checks);
  const lines = [
    `Diagnostics: ${summary.ok} ok / ${summary.warning} warnings / ${summary.error} errors`,
    ""
  ];

  for (const check of checks) {
    lines.push(`${check.status.padEnd(7)} ${check.label.padEnd(14)} ${check.message}`);
    if (check.detail) {
      lines.push(`${"".padEnd(22)} ${check.detail}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function formatProfileImportPreview(preview: ProfileImportPreview): string {
  const applicable = preview.summary.new + preview.summary.updated;
  const lines = [
    `Profile import: ${applicable} to import / ${preview.summary.existing} unchanged / ${preview.summary.invalid} invalid`
  ];

  for (const item of preview.items) {
    lines.push(`- ${item.status.padEnd(8)} ${item.id || "Invalid entry"}${item.reason ? ` - ${item.reason}` : ""}`);
  }

  return `${lines.join("\n")}\n`;
}
