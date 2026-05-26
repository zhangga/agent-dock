import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { InstalledSkill } from "./skillScanner.js";

export interface StackSkill {
  id: string;
  type: "skill";
  source: StackSkillSource;
  desiredState: "enabled";
}

export type StackSkillSource =
  | {
      type: "skills.sh";
      package: string;
      skill: string;
    }
  | {
      type: "command";
      install: string;
    }
  | {
      type: "unknown";
    };

export type StackSkillInstall =
  | {
      status: "resolved";
      source: "skills.sh";
      command: string;
      url?: string;
      packageName?: string;
      installUrl?: string;
      resolvedAt: string;
    }
  | {
      status: "missing_install_source";
      reason: string;
      resolvedAt: string;
    };

export interface AgentDockStack {
  schemaVersion: 1;
  skills: StackSkill[];
}

export interface StackStoreOptions {
  stackPath?: string;
  now?: string;
  install?: StackSkillInstall;
}

export interface StackFileState {
  path: string;
  exists: boolean;
}

export function getDefaultStackPath(): string {
  return join(homedir(), ".agentdock", "stack.json");
}

export async function readStackFileState(options: StackStoreOptions = {}): Promise<StackFileState> {
  const stackPath = options.stackPath ?? getDefaultStackPath();

  return {
    path: stackPath,
    exists: await pathExists(stackPath)
  };
}

export async function readStack(options: StackStoreOptions = {}): Promise<AgentDockStack> {
  const stackPath = options.stackPath ?? getDefaultStackPath();

  try {
    const content = await readFile(stackPath, "utf8");
    const parsed = JSON.parse(content) as Partial<AgentDockStack>;

    return {
      schemaVersion: 1,
      skills: Array.isArray(parsed.skills) ? normalizeStackSkills(parsed.skills) : []
    };
  } catch (error) {
    if (isNotFound(error)) {
      return emptyStack();
    }

    throw error;
  }
}

export async function createStackFile(options: StackStoreOptions = {}): Promise<AgentDockStack> {
  const stackPath = options.stackPath ?? getDefaultStackPath();
  const stack = await readStack({ stackPath });
  await writeStack(stack, stackPath);
  return stack;
}

export async function writeStackFile(
  stack: AgentDockStack,
  options: StackStoreOptions = {}
): Promise<AgentDockStack> {
  const stackPath = options.stackPath ?? getDefaultStackPath();
  const nextStack: AgentDockStack = {
    schemaVersion: 1,
    skills: [...stack.skills].sort((left, right) => left.id.localeCompare(right.id))
  };

  await writeStack(nextStack, stackPath);
  return nextStack;
}

export async function addSkillToStack(
  skill: InstalledSkill,
  options: StackStoreOptions = {}
): Promise<AgentDockStack> {
  const stackPath = options.stackPath ?? getDefaultStackPath();
  const stack = await readStack({ stackPath });
  const stackSkill = toStackSkill(skill, options.install);
  const existingIndex = stack.skills.findIndex((item) => stackSkillKey(item) === stackSkillKey(stackSkill));

  if (existingIndex >= 0) {
    stack.skills[existingIndex] = stackSkill;
  } else {
    stack.skills.push(stackSkill);
  }

  stack.skills.sort((left, right) => left.id.localeCompare(right.id));
  await writeStack(stack, stackPath);
  return stack;
}

export async function removeSkillFromStack(
  skill: Pick<StackSkill, "id">,
  options: StackStoreOptions = {}
): Promise<AgentDockStack> {
  const stackPath = options.stackPath ?? getDefaultStackPath();
  const stack = await readStack({ stackPath });
  const nextStack: AgentDockStack = {
    schemaVersion: 1,
    skills: stack.skills.filter((item) => item.id !== skill.id)
  };

  await writeStack(nextStack, stackPath);
  return nextStack;
}

export async function updateSkillSourceInStack(
  skill: Pick<StackSkill, "id">,
  source: StackSkillSource,
  options: StackStoreOptions = {}
): Promise<AgentDockStack | undefined> {
  const stackPath = options.stackPath ?? getDefaultStackPath();
  const stack = await readStack({ stackPath });
  const existingIndex = stack.skills.findIndex((item) => item.id === skill.id);

  if (existingIndex === -1) {
    return undefined;
  }

  const nextStack: AgentDockStack = {
    schemaVersion: 1,
    skills: stack.skills.map((item, index) =>
      index === existingIndex
        ? {
            ...item,
            source
          }
        : item
    )
  };

  await writeStack(nextStack, stackPath);
  return nextStack;
}

function toStackSkill(skill: InstalledSkill, install?: StackSkillInstall): StackSkill {
  return {
    id: skill.id,
    type: "skill",
    source: toStackSkillSource(skill, install),
    desiredState: "enabled"
  };
}

function normalizeStackSkills(skills: unknown[]): StackSkill[] {
  const normalized = skills
    .map((skill) => normalizeStackSkill(skill))
    .filter((skill): skill is StackSkill => Boolean(skill));
  const byKey = new Map<string, StackSkill>();

  for (const skill of normalized) {
    byKey.set(stackSkillKey(skill), skill);
  }

  return [...byKey.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeStackSkill(value: unknown): StackSkill | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";

  if (!id) {
    return undefined;
  }

  return {
    id,
    type: "skill",
    source: normalizeStackSkillSource(raw, id),
    desiredState: "enabled"
  };
}

function normalizeStackSkillSource(raw: Record<string, unknown>, skillId: string): StackSkillSource {
  if (raw.source && typeof raw.source === "object") {
    const source = raw.source as Record<string, unknown>;
    const type = source.type;

    if (type === "skills.sh") {
      const packageName = typeof source.package === "string" ? source.package.trim() : "";
      const skill = typeof source.skill === "string" ? source.skill.trim() : skillId;

      if (packageName && skill) {
        return {
          type: "skills.sh",
          package: packageName,
          skill
        };
      }
    }

    if (type === "command") {
      const install = typeof source.install === "string" ? source.install.trim() : "";

      if (install) {
        return {
          type: "command",
          install
        };
      }
    }
  }

  return toStackSkillSource({ id: skillId } as InstalledSkill, normalizeLegacyInstall(raw.install));
}

function normalizeLegacyInstall(install: unknown): StackSkillInstall | undefined {
  if (!install || typeof install !== "object") {
    return undefined;
  }

  const raw = install as Record<string, unknown>;

  if (raw.status === "resolved" && typeof raw.command === "string") {
    return {
      status: "resolved",
      source: "skills.sh",
      command: raw.command,
      ...(typeof raw.url === "string" ? { url: raw.url } : {}),
      ...(typeof raw.packageName === "string" ? { packageName: raw.packageName } : {}),
      ...(typeof raw.installUrl === "string" ? { installUrl: raw.installUrl } : {}),
      resolvedAt: typeof raw.resolvedAt === "string" ? raw.resolvedAt : ""
    };
  }

  return undefined;
}

function toStackSkillSource(skill: Pick<InstalledSkill, "id">, install?: StackSkillInstall): StackSkillSource {
  if (!install || install.status !== "resolved") {
    return {
      type: "unknown"
    };
  }

  const packageSource = parsePackageName(install.packageName, skill.id) ?? parseInstallCommand(install.command);

  if (packageSource) {
    return packageSource;
  }

  return {
    type: "command",
    install: install.command
  };
}

function parsePackageName(packageName: string | undefined, fallbackSkill: string): StackSkillSource | undefined {
  const match = packageName?.trim().match(/^(.+)@([^@]+)$/);

  if (!match) {
    return undefined;
  }

  const packageId = match[1]?.trim();
  const skill = match[2]?.trim() || fallbackSkill;

  if (!packageId || !skill) {
    return undefined;
  }

  return {
    type: "skills.sh",
    package: packageId,
    skill
  };
}

function parseInstallCommand(command: string): StackSkillSource | undefined {
  const match = command
    .trim()
    .match(/^npx\s+skills\s+add\s+https:\/\/github\.com\/([^\s]+)\s+--skill\s+([^\s]+)$/);

  if (!match?.[1] || !match[2]) {
    return undefined;
  }

  return {
    type: "skills.sh",
    package: match[1],
    skill: match[2]
  };
}

function stackSkillKey(skill: Pick<StackSkill, "type" | "id">): string {
  return `${skill.type}:${skill.id}`;
}

async function writeStack(stack: AgentDockStack, stackPath: string): Promise<void> {
  await mkdir(dirname(stackPath), { recursive: true });
  await writeFile(stackPath, `${JSON.stringify(stack, null, 2)}\n`, "utf8");
}

function emptyStack(): AgentDockStack {
  return {
    schemaVersion: 1,
    skills: []
  };
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
