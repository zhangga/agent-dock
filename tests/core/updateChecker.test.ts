import { describe, expect, test } from "vitest";
import type { InstalledSkill } from "../../src/core/skillScanner.js";
import type { AgentDockStack } from "../../src/core/stackStore.js";
import { checkSkillUpdates } from "../../src/core/updateChecker.js";

function installedSkill(id: string): InstalledSkill {
  return {
    id,
    name: id,
    description: "",
    installPath: `/tmp/${id}`,
    manifestPath: `/tmp/${id}/SKILL.md`,
    sourceRoot: "/tmp",
    location: {
      kind: "custom",
      label: "Custom",
      root: "/tmp"
    }
  };
}

describe("checkSkillUpdates", () => {
  test("reports conservative default update states", async () => {
    const stack: AgentDockStack = {
      schemaVersion: 1,
      skills: [
        {
          id: "installed-skill",
          type: "skill",
          desiredState: "enabled",
          source: { type: "skills.sh", package: "owner/repo", skill: "installed-skill" }
        },
        {
          id: "missing-skill",
          type: "skill",
          desiredState: "enabled",
          source: { type: "command", install: "npx skills add owner/repo --skill missing-skill" }
        },
        {
          id: "local-only",
          type: "skill",
          desiredState: "enabled",
          source: { type: "unknown" }
        }
      ]
    };

    const result = await checkSkillUpdates(stack, [installedSkill("installed-skill")]);

    expect(result.summary).toEqual({
      update_available: 0,
      up_to_date: 0,
      unknown: 1,
      not_installed: 1,
      needs_source: 1
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        id: "installed-skill",
        installed: true,
        status: "unknown",
        suggestedCommand: "npx skills add https://github.com/owner/repo --skill installed-skill"
      }),
      expect.objectContaining({
        id: "missing-skill",
        installed: false,
        status: "not_installed",
        suggestedCommand: "npx skills add owner/repo --skill missing-skill"
      }),
      expect.objectContaining({
        id: "local-only",
        installed: false,
        status: "needs_source"
      })
    ]);
    expect(result.items[2]).not.toHaveProperty("suggestedCommand");
  });

  test("uses an injected probe when version data is available", async () => {
    const stack: AgentDockStack = {
      schemaVersion: 1,
      skills: [
        {
          id: "installed-skill",
          type: "skill",
          desiredState: "enabled",
          source: { type: "skills.sh", package: "owner/repo", skill: "installed-skill" }
        }
      ]
    };

    const result = await checkSkillUpdates(stack, [installedSkill("installed-skill")], {
      probe: async () => ({
        status: "update_available",
        currentVersion: "abc",
        latestVersion: "def",
        message: "New revision available."
      })
    });

    expect(result.summary).toEqual({
      update_available: 1,
      up_to_date: 0,
      unknown: 0,
      not_installed: 0,
      needs_source: 0
    });
    expect(result.items[0]).toMatchObject({
      status: "update_available",
      currentVersion: "abc",
      latestVersion: "def",
      message: "New revision available."
    });
  });
});
