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
