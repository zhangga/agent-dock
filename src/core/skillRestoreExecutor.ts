import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { InstalledSkill } from "./skillScanner.js";
import type { AgentDockStack, StackSkill } from "./stackStore.js";

const execFileAsync = promisify(execFile);
const RESTORE_TIMEOUT_MS = 120_000;
const OUTPUT_LIMIT = 500;

export interface RestorePlan {
  alreadyInstalled: StackSkill[];
  installable: StackSkill[];
  needsAttention: StackSkill[];
}

export interface RestoreCommand {
  command: string;
  args: string[];
  display: string;
}

export interface RestoreRunnerResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
}

export type RestoreCommandRunner = (command: string, args: string[]) => Promise<RestoreRunnerResult>;

export interface RestoreMissingSkillsOptions {
  ids?: string[];
  runner?: RestoreCommandRunner;
}

export interface RestoreSkillResult {
  id: string;
  status: "success" | "failed" | "skipped";
  message: string;
  command?: string;
  detail?: string;
}

export function buildRestorePlan(stack: AgentDockStack, installedSkills: InstalledSkill[]): RestorePlan {
  const installedIds = new Set(installedSkills.map((skill) => skill.id));
  const plan: RestorePlan = {
    alreadyInstalled: [],
    installable: [],
    needsAttention: []
  };

  for (const skill of stack.skills) {
    if (installedIds.has(skill.id)) {
      plan.alreadyInstalled.push(skill);
      continue;
    }

    if (getRestoreCommand(skill)) {
      plan.installable.push(skill);
      continue;
    }

    plan.needsAttention.push(skill);
  }

  return plan;
}

export async function restoreMissingSkills(
  stack: AgentDockStack,
  installedSkills: InstalledSkill[],
  options: RestoreMissingSkillsOptions = {}
): Promise<RestoreSkillResult[]> {
  const selectedIds = options.ids ? new Set(options.ids) : undefined;
  const runner = options.runner ?? runRestoreCommand;
  const plan = buildRestorePlan(stack, installedSkills);
  const results: RestoreSkillResult[] = [];

  for (const skill of stack.skills) {
    if (selectedIds && !selectedIds.has(skill.id)) {
      continue;
    }

    if (plan.alreadyInstalled.some((item) => item.id === skill.id)) {
      results.push({
        id: skill.id,
        status: "skipped",
        message: "Already installed."
      });
      continue;
    }

    const restoreCommand = getRestoreCommand(skill);
    if (!restoreCommand) {
      results.push({
        id: skill.id,
        status: "skipped",
        message: "This skill does not have a restore source yet."
      });
      continue;
    }

    const runnerResult = await runner(restoreCommand.command, restoreCommand.args);
    results.push(toRestoreResult(skill, restoreCommand, runnerResult));
  }

  return results;
}

export function getRestoreCommand(skill: StackSkill): RestoreCommand | undefined {
  const source = skill.source;

  if (source.type === "skills.sh") {
    return parseInstallCommand(`npx skills add https://github.com/${source.package} --skill ${source.skill}`);
  }

  if (source.type === "command") {
    return parseInstallCommand(source.install);
  }

  return undefined;
}

export function normalizeInstallInput(input: string): RestoreCommand | undefined {
  return parseInstallCommand(input) ?? parseGitHubSkillUrl(input);
}

export function parseInstallCommand(command: string): RestoreCommand | undefined {
  const normalized = command.trim().replace(/\s+/g, " ");
  const match = normalized.match(
    /^npx skills add ((?:https:\/\/github\.com\/)?[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+) --skill ([A-Za-z0-9_.:-]+)$/
  );

  if (!match?.[1] || !match[2]) {
    return undefined;
  }

  return {
    command: "npx",
    args: ["skills", "add", match[1], "--skill", match[2]],
    display: `npx skills add ${match[1]} --skill ${match[2]}`
  };
}

function parseGitHubSkillUrl(input: string): RestoreCommand | undefined {
  let url: URL;

  try {
    url = new URL(input.trim());
  } catch {
    return undefined;
  }

  if (url.protocol !== "https:" || url.hostname !== "github.com") {
    return undefined;
  }

  const segments = decodePathSegments(url.pathname);
  const owner = segments[0];
  const repo = segments[1];

  if (!owner || !repo || segments[2] !== "tree" || !isSafePackageSegment(owner) || !isSafePackageSegment(repo)) {
    return undefined;
  }

  const skillsIndex = findLastSkillsPathSegment(segments);
  const skill = skillsIndex >= 0 ? segments[skillsIndex + 1] : undefined;

  if (!skill || !isSafeSkillSegment(skill)) {
    return undefined;
  }

  return parseInstallCommand(`npx skills add https://github.com/${owner}/${repo} --skill ${skill}`);
}

function decodePathSegments(pathname: string): string[] {
  try {
    return pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return [];
  }
}

function findLastSkillsPathSegment(segments: string[]): number {
  for (let index = segments.length - 2; index >= 3; index -= 1) {
    if (segments[index] === "skills") {
      return index;
    }
  }

  return -1;
}

function isSafePackageSegment(value: string): boolean {
  return /^[A-Za-z0-9_.-]+$/.test(value);
}

function isSafeSkillSegment(value: string): boolean {
  return /^[A-Za-z0-9_.:-]+$/.test(value);
}

async function runRestoreCommand(command: string, args: string[]): Promise<RestoreRunnerResult> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: RESTORE_TIMEOUT_MS,
      maxBuffer: 1024 * 1024
    });

    return {
      exitCode: 0,
      stdout,
      stderr
    };
  } catch (error) {
    const details = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: string | number;
      signal?: string;
      killed?: boolean;
    };

    return {
      exitCode: typeof details.code === "number" ? details.code : null,
      stdout: details.stdout ?? "",
      stderr: details.stderr ?? details.message,
      timedOut: details.killed === true || details.signal === "SIGTERM"
    };
  }
}

function toRestoreResult(skill: StackSkill, command: RestoreCommand, result: RestoreRunnerResult): RestoreSkillResult {
  if (result.exitCode === 0 && !result.timedOut) {
    return {
      id: skill.id,
      status: "success",
      message: "Installed successfully.",
      command: command.display
    };
  }

  const detail = summarizeOutput(result.stderr || result.stdout);
  return {
    id: skill.id,
    status: "failed",
    message: restoreFailureMessage(result),
    command: command.display,
    ...(detail ? { detail } : {})
  };
}

function restoreFailureMessage(result: RestoreRunnerResult): string {
  const combined = `${result.stderr}\n${result.stdout}`.toLowerCase();

  if (result.timedOut) {
    return "This skill took too long to install. You can retry it.";
  }

  if (combined.includes("enoent") || combined.includes("not found")) {
    return "Node.js/npm is required before AgentDock can restore skills.";
  }

  if (
    combined.includes("network") ||
    combined.includes("github") ||
    combined.includes("remote repository") ||
    combined.includes("could not resolve host")
  ) {
    return "Could not reach the skill source. Check your network and try again.";
  }

  return "The skill could not be restored. Check the details and try again.";
}

function summarizeOutput(output: string): string {
  return output.replace(/\s+/g, " ").trim().slice(0, OUTPUT_LIMIT);
}
