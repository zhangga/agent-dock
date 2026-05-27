import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { basename, dirname, join, relative, sep } from "node:path";
import type { InstalledSkill } from "./skillScanner.js";
import { getRestoreCommand } from "./skillRestoreExecutor.js";
import type { AgentDockStack, StackSkill } from "./stackStore.js";

export type UpdateCheckStatus = "update_available" | "up_to_date" | "unknown" | "not_installed" | "needs_source";

export interface UpdateCheckItem {
  id: string;
  type: "skill";
  installed: boolean;
  status: UpdateCheckStatus;
  currentVersion?: string;
  latestVersion?: string;
  suggestedCommand?: string;
  message: string;
}

export interface UpdateCheckSummary {
  update_available: number;
  up_to_date: number;
  unknown: number;
  not_installed: number;
  needs_source: number;
}

export interface UpdateCheckResult {
  items: UpdateCheckItem[];
  summary: UpdateCheckSummary;
}

export type SkillUpdateProbeResult = Partial<
  Pick<UpdateCheckItem, "status" | "currentVersion" | "latestVersion" | "message">
>;

export type SkillUpdateProbe = (
  skill: StackSkill,
  installedSkill: InstalledSkill | undefined
) => Promise<SkillUpdateProbeResult | undefined>;

export interface CheckSkillUpdatesOptions {
  probe?: SkillUpdateProbe;
}

type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
}>;

interface GitHubSkillUpdateProbeOptions {
  fetch?: FetchLike;
  githubToken?: string;
}

interface GitHubTreeEntry {
  path?: string;
  type?: string;
  sha?: string;
}

interface GitHubTreeResponse {
  tree?: GitHubTreeEntry[];
  truncated?: boolean;
}

interface GitHubTreeResult {
  entries: GitHubTreeEntry[];
  truncated: boolean;
  error?: string;
}

interface VersionSnapshot {
  digest: string;
  files: Map<string, string>;
}

interface GitHubTreeCacheEntry {
  expiresAt: number;
  promise: Promise<GitHubTreeResult>;
}

const GITHUB_TREE_API_PREFIX = "https://api.github.com/repos";
const IGNORED_LOCAL_NAMES = new Set([".git", ".DS_Store", "node_modules"]);
const GITHUB_TREE_CACHE_TTL_MS = 5 * 60 * 1000;
const GITHUB_TREE_ERROR_CACHE_TTL_MS = 30 * 1000;

export async function checkSkillUpdates(
  stack: AgentDockStack,
  installedSkills: InstalledSkill[],
  options: CheckSkillUpdatesOptions = {}
): Promise<UpdateCheckResult> {
  const installedById = new Map(installedSkills.map((skill) => [skill.id, skill]));
  const items: UpdateCheckItem[] = [];

  for (const skill of stack.skills) {
    const installedSkill = installedById.get(skill.id);
    const command = getRestoreCommand(skill);
    const baseItem = buildBaseItem(skill, installedSkill, command?.display);
    const probeResult = installedSkill && options.probe ? await options.probe(skill, installedSkill) : undefined;

    items.push(applyProbeResult(baseItem, probeResult));
  }

  return {
    items,
    summary: summarizeUpdateItems(items)
  };
}

export function createGitHubSkillUpdateProbe(options: GitHubSkillUpdateProbeOptions = {}): SkillUpdateProbe {
  const fetcher = options.fetch ?? globalThis.fetch;
  const githubToken = resolveGitHubToken(options.githubToken);
  const treeCache = new Map<string, GitHubTreeCacheEntry>();

  return async (skill, installedSkill) => {
    if (!installedSkill) {
      return undefined;
    }

    if (!fetcher) {
      return {
        status: "unknown",
        message: "Could not check GitHub source because fetch is not available in this Node.js runtime."
      };
    }

    const repository = getGitHubRepository(skill);
    if (!repository) {
      return undefined;
    }

    const tree = await getCachedGitHubTree(repository, fetcher, treeCache, githubToken);
    if (tree.error) {
      return {
        status: "unknown",
        message: `Could not check GitHub source: ${tree.error}`
      };
    }

    if (!tree.entries.length) {
      return {
        status: "unknown",
        message: "Could not check GitHub source because the repository tree was empty."
      };
    }

    if (tree.truncated) {
      return {
        status: "unknown",
        message: "Could not check GitHub source because the repository tree is too large."
      };
    }

    const sourceSkill = sourceSkillName(skill);
    const remoteSnapshot = findRemoteSkillSnapshot(tree.entries, candidateRemoteSkillPaths(sourceSkill, installedSkill));
    if (!remoteSnapshot) {
      return {
        status: "unknown",
        message: "Could not find this skill in the GitHub source."
      };
    }

    const localSnapshot = await snapshotLocalSkill(installedSkill.installPath);
    if (!localSnapshot.files.size) {
      return {
        status: "unknown",
        message: "Could not read local skill files for comparison."
      };
    }

    const matches = snapshotsMatch(localSnapshot, remoteSnapshot);

    return {
      status: matches ? "up_to_date" : "update_available",
      currentVersion: `local:${localSnapshot.digest.slice(0, 12)}`,
      latestVersion: `github:${remoteSnapshot.digest.slice(0, 12)}`,
      message: matches
        ? "Local files match the GitHub source."
        : "Remote skill files differ from the local install."
    };
  };
}

function buildBaseItem(
  skill: StackSkill,
  installedSkill: InstalledSkill | undefined,
  suggestedCommand: string | undefined
): UpdateCheckItem {
  if (!suggestedCommand) {
    return {
      id: skill.id,
      type: "skill",
      installed: Boolean(installedSkill),
      status: "needs_source",
      message: "This skill needs a restore source before AgentDock can check or refresh it."
    };
  }

  if (!installedSkill) {
    return {
      id: skill.id,
      type: "skill",
      installed: false,
      status: "not_installed",
      suggestedCommand,
      message: "This skill is saved in Backup but is not installed locally."
    };
  }

  return {
    id: skill.id,
    type: "skill",
    installed: true,
    status: "unknown",
    suggestedCommand,
    message: "No local version metadata is available yet; use the suggested command to refresh this skill if needed."
  };
}

function applyProbeResult(item: UpdateCheckItem, probeResult: SkillUpdateProbeResult | undefined): UpdateCheckItem {
  if (!probeResult?.status) {
    return item;
  }

  return {
    ...item,
    status: probeResult.status,
    ...(probeResult.currentVersion ? { currentVersion: probeResult.currentVersion } : {}),
    ...(probeResult.latestVersion ? { latestVersion: probeResult.latestVersion } : {}),
    message: probeResult.message ?? item.message
  };
}

function summarizeUpdateItems(items: UpdateCheckItem[]): UpdateCheckSummary {
  const summary: UpdateCheckSummary = {
    update_available: 0,
    up_to_date: 0,
    unknown: 0,
    not_installed: 0,
    needs_source: 0
  };

  for (const item of items) {
    summary[item.status] += 1;
  }

  return summary;
}

function getGitHubRepository(skill: StackSkill): string | undefined {
  if (skill.source.type === "skills.sh") {
    return normalizeGitHubPackage(skill.source.package);
  }

  if (skill.source.type !== "command") {
    return undefined;
  }

  const match = skill.source.install
    .trim()
    .match(/^npx\s+skills\s+add\s+((?:https:\/\/github\.com\/)?[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\s+--skill\s+[A-Za-z0-9_.:-]+$/);

  return match?.[1] ? normalizeGitHubPackage(match[1]) : undefined;
}

function normalizeGitHubPackage(value: string): string | undefined {
  const normalized = value.trim().replace(/^https:\/\/github\.com\//, "");
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalized) ? normalized : undefined;
}

function sourceSkillName(skill: StackSkill): string {
  if (skill.source.type === "skills.sh") {
    return skill.source.skill;
  }

  if (skill.source.type === "command") {
    const match = skill.source.install.trim().match(/\s--skill\s+([A-Za-z0-9_.:-]+)$/);
    return match?.[1] ?? skill.id;
  }

  return skill.id;
}

async function getCachedGitHubTree(
  repository: string,
  fetcher: FetchLike,
  cache: Map<string, GitHubTreeCacheEntry>,
  githubToken: string | undefined
): Promise<GitHubTreeResult> {
  const now = Date.now();
  const cached = cache.get(repository);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = fetchGitHubTree(repository, fetcher, githubToken).then((result) => {
    cache.set(repository, {
      expiresAt: Date.now() + (result.error ? GITHUB_TREE_ERROR_CACHE_TTL_MS : GITHUB_TREE_CACHE_TTL_MS),
      promise: Promise.resolve(result)
    });
    return result;
  });
  cache.set(repository, {
    expiresAt: now + GITHUB_TREE_CACHE_TTL_MS,
    promise
  });
  return promise;
}

async function fetchGitHubTree(
  repository: string,
  fetcher: FetchLike,
  githubToken: string | undefined
): Promise<GitHubTreeResult> {
  const url = `${GITHUB_TREE_API_PREFIX}/${repository}/git/trees/HEAD?recursive=1`;
  let response: Awaited<ReturnType<FetchLike>>;

  try {
    response = await fetcher(url, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "agentdock",
        ...(githubToken ? { authorization: `Bearer ${githubToken}` } : {})
      }
    });
  } catch (error) {
    return {
      entries: [],
      truncated: false,
      error: formatErrorMessage(error)
    };
  }

  if (!response.ok) {
    return {
      entries: [],
      truncated: false,
      error: await formatGitHubHttpError(response)
    };
  }

  const body = (await response.json()) as GitHubTreeResponse;
  return {
    entries: Array.isArray(body.tree) ? body.tree : [],
    truncated: body.truncated === true
  };
}

async function formatGitHubHttpError(response: Awaited<ReturnType<FetchLike>>): Promise<string> {
  let detail = "";

  try {
    const body = (await response.json()) as { message?: unknown };
    detail = typeof body.message === "string" ? body.message.trim() : "";
  } catch {
    detail = "";
  }

  if (response.status === 403 && /rate limit/i.test(`${response.statusText} ${detail}`)) {
    return "GitHub API rate limit exceeded. Set GITHUB_TOKEN or try again later.";
  }

  const statusText = response.statusText ? ` ${response.statusText}` : "";
  const suffix = detail ? `: ${trimTrailingSentencePunctuation(detail)}` : "";
  return `GitHub returned ${response.status}${statusText}${suffix}.`;
}

function resolveGitHubToken(token: string | undefined): string | undefined {
  const resolved = token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const trimmed = resolved?.trim();
  return trimmed || undefined;
}

function formatErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "request failed";
  return `${trimTrailingSentencePunctuation(message)}.`;
}

function trimTrailingSentencePunctuation(value: string): string {
  return value.trim().replace(/[.!?]+$/, "");
}

function candidateRemoteSkillPaths(skillName: string, installedSkill: InstalledSkill): string[] {
  const candidates = new Set<string>();
  const installedDir = basename(installedSkill.installPath);
  const installedParent = basename(dirname(installedSkill.installPath));

  if (installedParent.startsWith(".")) {
    candidates.add(`skills/${installedParent}/${installedDir}`);
  }

  candidates.add(`skills/${skillName}`);
  candidates.add(`skills/.system/${skillName}`);
  candidates.add(`skills/.curated/${skillName}`);
  candidates.add(`local-skills/${skillName}`);
  candidates.add(skillName);

  return [...candidates];
}

function findRemoteSkillSnapshot(entries: GitHubTreeEntry[], candidatePaths: string[]): VersionSnapshot | undefined {
  for (const candidate of candidatePaths) {
    const prefix = `${candidate}/`;
    const files = new Map<string, string>();

    for (const entry of entries) {
      if (entry.type !== "blob" || !entry.path || !entry.sha || !entry.path.startsWith(prefix)) {
        continue;
      }

      files.set(entry.path.slice(prefix.length), entry.sha);
    }

    if (files.has("SKILL.md")) {
      return {
        files,
        digest: digestFileMap(files)
      };
    }
  }

  return undefined;
}

async function snapshotLocalSkill(installPath: string): Promise<VersionSnapshot> {
  const files = new Map<string, string>();
  await collectLocalFiles(installPath, installPath, files);

  return {
    files,
    digest: digestFileMap(files)
  };
}

async function collectLocalFiles(root: string, currentPath: string, files: Map<string, string>): Promise<void> {
  const entries = await readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_LOCAL_NAMES.has(entry.name) || entry.isSymbolicLink()) {
      continue;
    }

    const childPath = join(currentPath, entry.name);
    if (entry.isDirectory()) {
      await collectLocalFiles(root, childPath, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const stats = await lstat(childPath);
    if (!stats.isFile()) {
      continue;
    }

    const localPath = relative(root, childPath).split(sep).join("/");
    const content = await readFile(childPath);
    files.set(localPath, gitBlobSha(content));
  }
}

function gitBlobSha(content: Buffer): string {
  return createHash("sha1")
    .update(Buffer.from(`blob ${content.length}\0`))
    .update(content)
    .digest("hex");
}

function snapshotsMatch(localSnapshot: VersionSnapshot, remoteSnapshot: VersionSnapshot): boolean {
  if (localSnapshot.files.size !== remoteSnapshot.files.size) {
    return false;
  }

  for (const [path, sha] of localSnapshot.files) {
    if (remoteSnapshot.files.get(path) !== sha) {
      return false;
    }
  }

  return true;
}

function digestFileMap(files: Map<string, string>): string {
  const hash = createHash("sha256");

  for (const [path, sha] of [...files.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    hash.update(path);
    hash.update("\0");
    hash.update(sha);
    hash.update("\0");
  }

  return hash.digest("hex");
}
