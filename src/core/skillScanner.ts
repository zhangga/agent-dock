import { access, lstat, opendir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, join, resolve } from "node:path";
import { homedir } from "node:os";

export type SkillLocationKind = "personal" | "codex" | "claude" | "project" | "custom";

export interface SkillLocation {
  kind: SkillLocationKind;
  label: string;
  root: string;
}

export interface InstalledSkill {
  id: string;
  name: string;
  description: string;
  installPath: string;
  manifestPath: string;
  sourceRoot: string;
  location: SkillLocation;
}

export interface ScanInstalledSkillsOptions {
  roots?: string[];
  cwd?: string;
  maxDepth?: number;
}

interface SkillMetadata {
  name?: string;
  description?: string;
}

const DEFAULT_MAX_DEPTH = 4;
const IGNORED_DIRECTORIES = new Set([".git", "node_modules"]);

export async function scanInstalledSkills(options: ScanInstalledSkillsOptions = {}): Promise<InstalledSkill[]> {
  const roots = options.roots?.map((root) => resolve(root)) ?? getDefaultSkillRoots(options.cwd);
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const skills: InstalledSkill[] = [];

  for (const root of roots) {
    if (!(await pathExists(root))) {
      continue;
    }

    const rootStats = await lstat(root);
    if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
      continue;
    }

    const rootSkills = await scanRoot(root, root, 0, maxDepth, options.cwd);
    skills.push(...rootSkills);
  }

  return skills.sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    return byName === 0 ? left.installPath.localeCompare(right.installPath) : byName;
  });
}

function getDefaultSkillRoots(cwd = process.cwd()): string[] {
  const home = homedir();
  const envRoots = process.env.AGENTDOCK_SKILL_DIRS?.split(":")
    .map((root) => root.trim())
    .filter(Boolean);

  if (envRoots?.length) {
    return envRoots.map((root) => resolve(root));
  }

  return [
    join(home, ".agents", "skills"),
    join(home, ".codex", "skills"),
    join(home, ".claude", "skills"),
    join(cwd, ".agents", "skills"),
    join(cwd, ".codex", "skills"),
    join(cwd, ".claude", "skills")
  ].map((root) => resolve(root));
}

export function getSkillLocation(
  sourceRoot: string,
  options: { home?: string; cwd?: string } = {}
): SkillLocation {
  const root = resolve(sourceRoot);
  const home = resolve(options.home ?? homedir());
  const cwd = resolve(options.cwd ?? process.cwd());

  if (
    root === join(cwd, ".agents", "skills") ||
    root === join(cwd, ".codex", "skills") ||
    root === join(cwd, ".claude", "skills")
  ) {
    return { kind: "project", label: "Project", root };
  }

  if (root === join(home, ".agents", "skills")) {
    return { kind: "personal", label: "Personal", root };
  }

  if (root === join(home, ".codex", "skills")) {
    return { kind: "codex", label: "Codex", root };
  }

  if (root === join(home, ".claude", "skills")) {
    return { kind: "claude", label: "Claude", root };
  }

  return { kind: "custom", label: "Custom", root };
}

async function scanRoot(
  currentPath: string,
  sourceRoot: string,
  depth: number,
  maxDepth: number,
  cwd: string | undefined
): Promise<InstalledSkill[]> {
  if (await pathIsSymbolicLink(currentPath)) {
    return [];
  }

  const manifestPath = join(currentPath, "SKILL.md");
  if (await pathExists(manifestPath)) {
    return [await readSkill(currentPath, manifestPath, sourceRoot, cwd)];
  }

  if (depth >= maxDepth) {
    return [];
  }

  const found: InstalledSkill[] = [];
  const directory = await opendir(currentPath);

  for await (const entry of directory) {
    if (IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const childPath = join(currentPath, entry.name);
    if (!canContainSkill(entry)) {
      continue;
    }

    found.push(...(await scanRoot(childPath, sourceRoot, depth + 1, maxDepth, cwd)));
  }

  return found;
}

function canContainSkill(entry: { isDirectory(): boolean; isSymbolicLink(): boolean }): boolean {
  return !entry.isSymbolicLink() && entry.isDirectory();
}

async function readSkill(
  installPath: string,
  manifestPath: string,
  sourceRoot: string,
  cwd: string | undefined
): Promise<InstalledSkill> {
  const content = await readFile(manifestPath, "utf8");
  const metadata = parseSkillMetadata(content);
  const fallbackName = basename(installPath);
  const name = metadata.name || fallbackName;

  return {
    id: name,
    name,
    description: metadata.description ?? "",
    installPath,
    manifestPath,
    sourceRoot,
    location: getSkillLocation(sourceRoot, { cwd })
  };
}

function parseSkillMetadata(content: string): SkillMetadata {
  if (!content.startsWith("---")) {
    return {};
  }

  const end = content.indexOf("\n---", 3);
  if (end === -1) {
    return {};
  }

  const frontmatter = content.slice(3, end).split(/\r?\n/);
  const metadata: SkillMetadata = {};

  for (const line of frontmatter) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    const value = unquote(match[2].trim());

    if (key === "name") {
      metadata.name = value;
    }

    if (key === "description") {
      metadata.description = value;
    }
  }

  return metadata;
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function pathIsSymbolicLink(path: string): Promise<boolean> {
  try {
    const stats = await lstat(path);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}
