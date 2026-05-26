import type { AgentDockStack, StackSkill, StackSkillSource } from "./stackStore.js";

export interface AgentDockProfile {
  schemaVersion: 1;
  exportedAt: string;
  agentdockVersion: string;
  stack: AgentDockStack;
}

export type ProfileImportStatus = "new" | "existing" | "updated" | "invalid";

export interface ProfileImportPreviewItem {
  id: string;
  status: ProfileImportStatus;
  skill?: StackSkill;
  reason?: string;
}

export interface ProfileImportPreview {
  items: ProfileImportPreviewItem[];
  summary: Record<ProfileImportStatus, number>;
}

export interface CreateProfileOptions {
  exportedAt?: string;
  agentdockVersion?: string;
}

export interface ApplyProfileImportResult {
  stack: AgentDockStack;
  preview: ProfileImportPreview;
}

export function createProfileFromStack(
  stack: AgentDockStack,
  options: CreateProfileOptions = {}
): AgentDockProfile {
  return {
    schemaVersion: 1,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    agentdockVersion: options.agentdockVersion ?? "0.1.0",
    stack: normalizeProfileStack(stack)
  };
}

export function parseProfileInput(input: string | unknown): AgentDockProfile {
  let parsed: unknown;

  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      throw new Error("Profile JSON could not be parsed.");
    }
  } else {
    parsed = input;
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Only AgentDock profile schema v1 is supported.");
  }

  const raw = parsed as Record<string, unknown>;
  if (raw.schemaVersion !== 1) {
    throw new Error("Only AgentDock profile schema v1 is supported.");
  }

  return {
    schemaVersion: 1,
    exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : "",
    agentdockVersion: typeof raw.agentdockVersion === "string" ? raw.agentdockVersion : "",
    stack: normalizeProfileStack(raw.stack)
  };
}

export function previewProfileImport(
  profile: AgentDockProfile,
  currentStack: AgentDockStack
): ProfileImportPreview {
  const currentById = new Map(currentStack.skills.map((skill) => [skill.id, skill]));
  const items: ProfileImportPreviewItem[] = profile.stack.skills.map((rawSkill) => {
    const normalized = normalizeProfileSkill(rawSkill);

    if (!normalized.skill) {
      return {
        id: normalized.id,
        status: "invalid",
        reason: normalized.reason
      };
    }

    const current = currentById.get(normalized.skill.id);
    if (!current) {
      return {
        id: normalized.skill.id,
        status: "new",
        skill: normalized.skill
      };
    }

    if (sourceEquals(current.source, normalized.skill.source)) {
      return {
        id: normalized.skill.id,
        status: "existing",
        skill: normalized.skill
      };
    }

    return {
      id: normalized.skill.id,
      status: "updated",
      skill: normalized.skill
    };
  });

  return {
    items,
    summary: summarizePreviewItems(items)
  };
}

export function applyProfileImport(
  profile: AgentDockProfile,
  currentStack: AgentDockStack
): ApplyProfileImportResult {
  const preview = previewProfileImport(profile, currentStack);
  const byId = new Map(currentStack.skills.map((skill) => [skill.id, skill]));

  for (const item of preview.items) {
    if (!item.skill || item.status === "invalid" || item.status === "existing") {
      continue;
    }

    byId.set(item.skill.id, item.skill);
  }

  return {
    stack: {
      schemaVersion: 1,
      skills: [...byId.values()].sort((left, right) => left.id.localeCompare(right.id))
    },
    preview
  };
}

function normalizeProfileStack(value: unknown): AgentDockStack {
  if (!value || typeof value !== "object") {
    return {
      schemaVersion: 1,
      skills: []
    };
  }

  const raw = value as Record<string, unknown>;
  const skills = Array.isArray(raw.skills) ? raw.skills : [];

  return {
    schemaVersion: 1,
    skills: skills.map((skill) => skill as StackSkill)
  };
}

function normalizeProfileSkill(value: unknown): { id: string; skill?: StackSkill; reason?: string } {
  if (!value || typeof value !== "object") {
    return {
      id: "",
      reason: "Profile entry is not an object."
    };
  }

  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";

  if (!id) {
    return {
      id,
      reason: "Skill id is required."
    };
  }

  const source = normalizeProfileSource(raw.source, id);
  if (!source) {
    return {
      id,
      reason: "Skill restore source is not supported."
    };
  }

  return {
    id,
    skill: {
      id,
      type: "skill",
      source,
      desiredState: "enabled"
    }
  };
}

function normalizeProfileSource(source: unknown, fallbackSkill: string): StackSkillSource | undefined {
  if (!source || typeof source !== "object") {
    return {
      type: "unknown"
    };
  }

  const raw = source as Record<string, unknown>;

  if (raw.type === "unknown") {
    return {
      type: "unknown"
    };
  }

  if (raw.type === "skills.sh") {
    const packageName = typeof raw.package === "string" ? raw.package.trim() : "";
    const skill = typeof raw.skill === "string" ? raw.skill.trim() : fallbackSkill;

    if (packageName && skill) {
      return {
        type: "skills.sh",
        package: packageName,
        skill
      };
    }
  }

  if (raw.type === "command") {
    const install = typeof raw.install === "string" ? raw.install.trim() : "";

    if (install) {
      return {
        type: "command",
        install
      };
    }
  }

  return undefined;
}

function sourceEquals(left: StackSkillSource, right: StackSkillSource): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function summarizePreviewItems(items: ProfileImportPreviewItem[]): Record<ProfileImportStatus, number> {
  return items.reduce<Record<ProfileImportStatus, number>>(
    (summary, item) => {
      summary[item.status] += 1;
      return summary;
    },
    {
      new: 0,
      existing: 0,
      updated: 0,
      invalid: 0
    }
  );
}
