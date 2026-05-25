import { execFile } from "node:child_process";
import { access, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import type { InstalledSkill } from "./skillScanner.js";

const execFileAsync = promisify(execFile);
const REMOVE_TIMEOUT_MS = 120_000;
const OUTPUT_LIMIT = 500;

export interface RemoveInstalledSkillResult {
  removed: true;
  id: string;
  installPath: string;
  method: "skills-cli" | "filesystem";
}

export interface SkillRemoveRunnerResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
}

export type SkillRemoveRunner = (command: string, args: string[]) => Promise<SkillRemoveRunnerResult>;

export interface RemoveInstalledSkillOptions {
  runner?: SkillRemoveRunner;
}

export async function removeInstalledSkill(
  skill: InstalledSkill,
  options: RemoveInstalledSkillOptions = {}
): Promise<RemoveInstalledSkillResult> {
  const sourceRoot = resolve(skill.sourceRoot);
  const installPath = resolve(skill.installPath);
  const manifestPath = resolve(skill.manifestPath);
  const rootRelativePath = relative(sourceRoot, installPath);

  if (!rootRelativePath || rootRelativePath.startsWith("..") || isAbsolute(rootRelativePath)) {
    throw new Error("Refusing to remove a skill root directly.");
  }

  if (manifestPath !== join(installPath, "SKILL.md")) {
    throw new Error("Skill manifest is outside the install directory.");
  }

  try {
    await access(manifestPath, constants.F_OK);
  } catch {
    throw new Error("Skill manifest is missing.");
  }

  const removeCommand = buildSkillsCliRemoveCommand(skill);
  if (removeCommand) {
    const runner = options.runner ?? runSkillsRemoveCommand;
    try {
      await runner(removeCommand.command, removeCommand.args);
    } catch {
      // Fall back to the verified filesystem deletion below.
    }

    if (!(await pathExists(installPath))) {
      return {
        removed: true,
        id: skill.id,
        installPath,
        method: "skills-cli"
      };
    }
  }

  await rm(installPath, { recursive: true, force: false });

  return {
    removed: true,
    id: skill.id,
    installPath,
    method: "filesystem"
  };
}

function buildSkillsCliRemoveCommand(skill: InstalledSkill): { command: string; args: string[] } | undefined {
  if (!canUseSkillsCli(skill.location.kind)) {
    return undefined;
  }

  const args = ["--yes", "skills", "remove"];

  if (isGlobalSkillLocation(skill.location.kind)) {
    args.push("--global");
  }

  args.push(skill.id, "--agent", "*", "-y");
  return { command: "npx", args };
}

function canUseSkillsCli(kind: InstalledSkill["location"]["kind"]): boolean {
  return kind === "personal" || kind === "codex" || kind === "claude" || kind === "project";
}

function isGlobalSkillLocation(kind: InstalledSkill["location"]["kind"]): boolean {
  return kind === "personal" || kind === "codex" || kind === "claude";
}

async function runSkillsRemoveCommand(command: string, args: string[]): Promise<SkillRemoveRunnerResult> {
  try {
    const result = await execFileAsync(command, args, { timeout: REMOVE_TIMEOUT_MS });
    return {
      exitCode: 0,
      stdout: limitOutput(result.stdout),
      stderr: limitOutput(result.stderr)
    };
  } catch (error) {
    return {
      exitCode: typeof (error as { code?: unknown }).code === "number" ? (error as { code: number }).code : null,
      stdout: limitOutput((error as { stdout?: string }).stdout ?? ""),
      stderr: limitOutput((error as { stderr?: string; message?: string }).stderr ?? (error as Error).message),
      timedOut: (error as { killed?: boolean }).killed === true
    };
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function limitOutput(value: string): string {
  return value.length > OUTPUT_LIMIT ? `${value.slice(0, OUTPUT_LIMIT)}...` : value;
}
