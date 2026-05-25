import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { InstalledSkill } from "./skillScanner.js";
import type { StackSkillInstall } from "./stackStore.js";

const execFileAsync = promisify(execFile);

export type SkillInstallResolver = (skill: InstalledSkill) => Promise<StackSkillInstall>;

interface SkillsShSearchResult {
  slug?: string;
  source?: string;
  installUrl?: string | null;
  url?: string;
  isDuplicate?: boolean;
}

export async function resolveSkillInstallFromSkillsSh(skill: InstalledSkill): Promise<StackSkillInstall> {
  const resolvedAt = new Date().toISOString();

  try {
    const apiResult = await resolveFromSkillsShApi(skill, resolvedAt);
    if (apiResult) {
      return apiResult;
    }
  } catch {
    // Fall through to the public CLI search when API auth is missing or the API is unavailable.
  }

  try {
    const cliResult = await resolveFromSkillsCli(skill, resolvedAt);
    if (cliResult) {
      return cliResult;
    }
  } catch {
    // Return a structured missing source below.
  }

  return {
    status: "missing_install_source",
    reason: "No matching skill was found on skills.sh.",
    resolvedAt
  };
}

async function resolveFromSkillsShApi(
  skill: InstalledSkill,
  resolvedAt: string
): Promise<StackSkillInstall | undefined> {
  const apiKey = process.env.SKILLS_SH_API_KEY?.trim();
  if (!apiKey) {
    return undefined;
  }

  const url = new URL("https://skills.sh/api/v1/skills/search");
  url.searchParams.set("q", skill.name);
  url.searchParams.set("limit", "10");

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    return undefined;
  }

  const payload = (await response.json()) as { data?: SkillsShSearchResult[] };
  const match = findBestSearchMatch(payload.data ?? [], skill);
  if (!match?.slug || !match.source) {
    return undefined;
  }

  return {
    status: "resolved",
    source: "skills.sh",
    command: buildSkillsCommand(match.source, match.slug, match.installUrl ?? undefined),
    ...(match.url ? { url: match.url } : {}),
    packageName: `${match.source}@${match.slug}`,
    ...(match.installUrl ? { installUrl: match.installUrl } : {}),
    resolvedAt
  };
}

async function resolveFromSkillsCli(
  skill: InstalledSkill,
  resolvedAt: string
): Promise<StackSkillInstall | undefined> {
  const { stdout } = await execFileAsync("npx", ["--yes", "skills", "find", skill.name], {
    timeout: 15000,
    maxBuffer: 1024 * 1024
  });
  const match = parseSkillsCliMatch(stdout, skill);

  if (!match) {
    return undefined;
  }

  const pageCommand = match.url ? await fetchInstallCommandFromSkillsPage(match.url) : undefined;

  return {
    status: "resolved",
    source: "skills.sh",
    command: pageCommand ?? `npx skills add ${match.packageName}`,
    ...(match.url ? { url: match.url } : {}),
    packageName: match.packageName,
    resolvedAt
  };
}

function findBestSearchMatch(
  results: SkillsShSearchResult[],
  skill: InstalledSkill
): SkillsShSearchResult | undefined {
  const expected = normalizeSkillName(skill.name || skill.id);
  return results.find((result) => {
    if (result.isDuplicate || !result.slug) {
      return false;
    }

    return normalizeSkillName(result.slug) === expected;
  });
}

function parseSkillsCliMatch(
  output: string,
  skill: InstalledSkill
): { packageName: string; url?: string } | undefined {
  const expected = normalizeSkillName(skill.name || skill.id);
  const lines = stripAnsi(output)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^(.+@([A-Za-z0-9_.:-]+))\s+\S+\s+installs\b/);
    if (!match) {
      continue;
    }

    const packageName = match[1];
    const skillName = match[2];
    if (normalizeSkillName(skillName) !== expected) {
      continue;
    }

    const urlLine = lines.slice(index + 1, index + 3).find((candidate) => candidate.includes("skills.sh/"));
    const url = urlLine?.match(/https?:\/\/(?:www\.)?skills\.sh\/\S+/)?.[0];
    return {
      packageName,
      ...(url ? { url } : {})
    };
  }

  return undefined;
}

async function fetchInstallCommandFromSkillsPage(url: string): Promise<string | undefined> {
  const response = await fetch(url.replace("https://skills.sh", "https://www.skills.sh"));
  if (!response.ok) {
    return undefined;
  }

  const html = decodeHtml(await response.text());
  const match = html.match(/npx skills add\s+(?:https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+|[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:\s+--skill\s+[A-Za-z0-9_.:-]+)?/);
  return match?.[0];
}

function buildSkillsCommand(source: string, slug: string, installUrl?: string): string {
  const sourceTarget = installUrl ?? source;
  return `npx skills add ${sourceTarget} --skill ${slug}`;
}

function normalizeSkillName(value: string): string {
  return value.trim().toLowerCase();
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function decodeHtml(value: string): string {
  return value
    .replaceAll("\\u003c", "<")
    .replaceAll("\\u003e", ">")
    .replaceAll("\\u0026", "&")
    .replaceAll("&amp;", "&")
    .replaceAll("&#x2F;", "/")
    .replaceAll("&quot;", '"');
}
