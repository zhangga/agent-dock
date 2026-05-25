import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { getDefaultStackPath } from "./stackStore.js";

const execFileAsync = promisify(execFile);
const COMMAND_TIMEOUT_MS = 5000;
const NETWORK_TIMEOUT_MS = 5000;

export type DiagnosticStatus = "ok" | "warning" | "error";

export interface DiagnosticCheck {
  id: string;
  label: string;
  status: DiagnosticStatus;
  message: string;
  detail?: string;
}

export interface DiagnosticsSummary {
  ok: number;
  warning: number;
  error: number;
}

export interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export type DiagnosticCommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

export interface DiagnosticFetchResponse {
  ok: boolean;
  status: number;
}

export type DiagnosticFetcher = (url: string, init: { method: "HEAD"; signal?: AbortSignal }) => Promise<DiagnosticFetchResponse>;

export interface RunDiagnosticsOptions {
  stackPath?: string;
  skillRoots?: string[];
  cwd?: string;
  nodeVersion?: string;
  commandRunner?: DiagnosticCommandRunner;
  fetcher?: DiagnosticFetcher;
  pathExists?: (path: string) => Promise<boolean>;
  canWritePath?: (path: string) => Promise<boolean>;
}

export async function runDiagnostics(options: RunDiagnosticsOptions = {}): Promise<DiagnosticCheck[]> {
  const commandRunner = options.commandRunner ?? runCommand;
  const fetcher = options.fetcher ?? fetchUrl;
  const pathExists = options.pathExists ?? defaultPathExists;
  const canWritePath = options.canWritePath ?? defaultCanWritePath;
  const stackPath = options.stackPath ?? getDefaultStackPath();
  const skillRoots = options.skillRoots?.map((root) => resolve(root)) ?? getDefaultSkillRoots(options.cwd);

  const checks = await Promise.all([
    checkNode(options.nodeVersion ?? process.version),
    checkCommand({
      id: "runtime.npm",
      label: "npm",
      command: "npm",
      args: ["--version"],
      runner: commandRunner,
      okMessage: "npm is available.",
      failureStatus: "error",
      failureMessage: "npm is required before AgentDock can restore skills."
    }),
    checkCommand({
      id: "runtime.npx",
      label: "npx",
      command: "npx",
      args: ["--version"],
      runner: commandRunner,
      okMessage: "npx is available.",
      failureStatus: "error",
      failureMessage: "npx is required before AgentDock can restore skills."
    }),
    checkCommand({
      id: "tools.git",
      label: "git",
      command: "git",
      args: ["--version"],
      runner: commandRunner,
      okMessage: "git is available.",
      failureStatus: "warning",
      failureMessage: "git was not found. Some skill installs may fail."
    }),
    checkNetwork({
      id: "network.github",
      label: "GitHub",
      url: "https://github.com",
      fetcher,
      okMessage: "GitHub is reachable.",
      failureMessage: "Could not reach GitHub. Check your network before restoring skills."
    }),
    checkNetwork({
      id: "network.skillsSh",
      label: "skills.sh",
      url: "https://skills.sh",
      fetcher,
      okMessage: "skills.sh is reachable.",
      failureMessage: "Could not reach skills.sh. Automatic restore-source lookup may be unavailable."
    }),
    checkStackFile(stackPath, pathExists, canWritePath),
    checkSkillRoots(skillRoots, pathExists, canWritePath)
  ]);

  return checks;
}

export function summarizeDiagnostics(checks: DiagnosticCheck[]): DiagnosticsSummary {
  return checks.reduce<DiagnosticsSummary>(
    (summary, check) => {
      summary[check.status] += 1;
      return summary;
    },
    { ok: 0, warning: 0, error: 0 }
  );
}

function checkNode(version: string): DiagnosticCheck {
  return {
    id: "runtime.node",
    label: "Node.js",
    status: "ok",
    message: "Node.js is available.",
    detail: version
  };
}

async function checkCommand(options: {
  id: string;
  label: string;
  command: string;
  args: string[];
  runner: DiagnosticCommandRunner;
  okMessage: string;
  failureStatus: DiagnosticStatus;
  failureMessage: string;
}): Promise<DiagnosticCheck> {
  try {
    const result = await options.runner(options.command, options.args);
    const detail = summarizeCommandOutput(result);

    if (result.exitCode === 0) {
      return {
        id: options.id,
        label: options.label,
        status: "ok",
        message: options.okMessage,
        ...(detail ? { detail } : {})
      };
    }

    return {
      id: options.id,
      label: options.label,
      status: options.failureStatus,
      message: options.failureMessage,
      ...(detail ? { detail } : {})
    };
  } catch (error) {
    return {
      id: options.id,
      label: options.label,
      status: options.failureStatus,
      message: options.failureMessage,
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}

async function checkNetwork(options: {
  id: string;
  label: string;
  url: string;
  fetcher: DiagnosticFetcher;
  okMessage: string;
  failureMessage: string;
}): Promise<DiagnosticCheck> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);

  try {
    const response = await options.fetcher(options.url, {
      method: "HEAD",
      signal: controller.signal
    });

    if (response.ok || response.status < 500) {
      return {
        id: options.id,
        label: options.label,
        status: "ok",
        message: options.okMessage,
        detail: `HTTP ${response.status}`
      };
    }

    return {
      id: options.id,
      label: options.label,
      status: "warning",
      message: options.failureMessage,
      detail: `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      id: options.id,
      label: options.label,
      status: "warning",
      message: options.failureMessage,
      detail: error instanceof Error ? error.message : String(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkStackFile(
  stackPath: string,
  pathExists: (path: string) => Promise<boolean>,
  canWritePath: (path: string) => Promise<boolean>
): Promise<DiagnosticCheck> {
  if (!(await pathExists(stackPath))) {
    return {
      id: "stack.file",
      label: "Backup file",
      status: "warning",
      message: "Backup file does not exist yet. Create it before restoring on another machine.",
      detail: stackPath
    };
  }

  if (await canWritePath(stackPath)) {
    return {
      id: "stack.file",
      label: "Backup file",
      status: "ok",
      message: "Backup file is readable and writable.",
      detail: stackPath
    };
  }

  return {
    id: "stack.file",
    label: "Backup file",
    status: "error",
    message: "Backup file exists, but AgentDock cannot write to it.",
    detail: stackPath
  };
}

async function checkSkillRoots(
  skillRoots: string[],
  pathExists: (path: string) => Promise<boolean>,
  canWritePath: (path: string) => Promise<boolean>
): Promise<DiagnosticCheck> {
  const existingRoots: string[] = [];
  const writableRoots: string[] = [];

  for (const root of skillRoots) {
    if (!(await pathExists(root))) {
      continue;
    }

    existingRoots.push(root);
    if (await canWritePath(root)) {
      writableRoots.push(root);
    }
  }

  if (existingRoots.length === 0) {
    return {
      id: "skills.roots",
      label: "Skill roots",
      status: "warning",
      message: "No skill roots exist yet. Install a skill or create a skill root before restoring.",
      detail: skillRoots.join("\n")
    };
  }

  if (writableRoots.length > 0) {
    return {
      id: "skills.roots",
      label: "Skill roots",
      status: "ok",
      message: "At least one skill root is writable.",
      detail: writableRoots.join("\n")
    };
  }

  return {
    id: "skills.roots",
    label: "Skill roots",
    status: "error",
    message: "Skill roots exist, but none are writable.",
    detail: existingRoots.join("\n")
  };
}

async function runCommand(command: string, args: string[]): Promise<CommandResult> {
  try {
    const result = await execFileAsync(command, args, {
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: 1024 * 1024
    });
    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    return {
      exitCode: typeof (error as { code?: unknown }).code === "number" ? (error as { code: number }).code : null,
      stdout: (error as { stdout?: string }).stdout ?? "",
      stderr: (error as { stderr?: string; message?: string }).stderr ?? (error as Error).message
    };
  }
}

async function fetchUrl(url: string, init: { method: "HEAD"; signal?: AbortSignal }): Promise<DiagnosticFetchResponse> {
  const response = await fetch(url, init);
  return {
    ok: response.ok,
    status: response.status
  };
}

async function defaultPathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function defaultCanWritePath(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK | constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function getDefaultSkillRoots(cwd = process.cwd()): string[] {
  const home = homedir();

  return [
    join(home, ".agents", "skills"),
    join(home, ".codex", "skills"),
    join(home, ".claude", "skills"),
    join(cwd, ".agents", "skills"),
    join(cwd, ".codex", "skills"),
    join(cwd, ".claude", "skills")
  ].map((root) => resolve(root));
}

function summarizeCommandOutput(result: CommandResult): string {
  return (result.stdout || result.stderr).replace(/\s+/g, " ").trim();
}
