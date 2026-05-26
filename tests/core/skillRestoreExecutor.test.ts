import { describe, expect, test } from "vitest";
import {
  buildRestorePlan,
  normalizeInstallInput,
  parseInstallCommand,
  restoreMissingSkills,
  stackSkillFromInstallInput,
  type RestoreCommandRunner
} from "../../src/core/skillRestoreExecutor.js";
import type { InstalledSkill } from "../../src/core/skillScanner.js";
import type { AgentDockStack } from "../../src/core/stackStore.js";

function makeInstalledSkill(id: string): InstalledSkill {
  const root = "/Users/example/.agents/skills";
  return {
    id,
    name: id,
    description: `${id} description`,
    installPath: `${root}/${id}`,
    manifestPath: `${root}/${id}/SKILL.md`,
    sourceRoot: root,
    location: {
      kind: "personal",
      label: "Personal",
      root
    }
  };
}

function makeStack(): AgentDockStack {
  return {
    schemaVersion: 1,
    skills: [
      {
        id: "already-here",
        type: "skill",
        source: {
          type: "skills.sh",
          package: "example/skills",
          skill: "already-here"
        },
        desiredState: "enabled"
      },
      {
        id: "find-skills",
        type: "skill",
        source: {
          type: "skills.sh",
          package: "vercel-labs/skills",
          skill: "find-skills"
        },
        desiredState: "enabled"
      },
      {
        id: "manual-skill",
        type: "skill",
        source: {
          type: "command",
          install: "npx skills add owner/repo --skill manual-skill"
        },
        desiredState: "enabled"
      },
      {
        id: "local-only",
        type: "skill",
        source: {
          type: "unknown"
        },
        desiredState: "enabled"
      }
    ]
  };
}

describe("skillRestoreExecutor", () => {
  test("builds a restore plan from installed skills and stack skills", () => {
    const plan = buildRestorePlan(makeStack(), [makeInstalledSkill("already-here")]);

    expect(plan.alreadyInstalled.map((skill) => skill.id)).toEqual(["already-here"]);
    expect(plan.installable.map((skill) => skill.id)).toEqual(["find-skills", "manual-skill"]);
    expect(plan.needsAttention.map((skill) => skill.id)).toEqual(["local-only"]);
  });

  test("parses supported skills.sh install commands", () => {
    expect(parseInstallCommand("npx skills add https://github.com/owner/repo --skill skill-name")).toEqual({
      command: "npx",
      args: ["skills", "add", "https://github.com/owner/repo", "--skill", "skill-name"],
      display: "npx skills add https://github.com/owner/repo --skill skill-name"
    });

    expect(parseInstallCommand("npx skills add owner/repo --skill skill-name")).toEqual({
      command: "npx",
      args: ["skills", "add", "owner/repo", "--skill", "skill-name"],
      display: "npx skills add owner/repo --skill skill-name"
    });
  });

  test("normalizes GitHub skill directory URLs into install commands", () => {
    expect(
      normalizeInstallInput("https://github.com/zhangga/aihub/tree/main/skills/chatgpt-images-fallback")
    ).toEqual({
      command: "npx",
      args: [
        "skills",
        "add",
        "https://github.com/zhangga/aihub",
        "--skill",
        "chatgpt-images-fallback"
      ],
      display: "npx skills add https://github.com/zhangga/aihub --skill chatgpt-images-fallback"
    });

    expect(
      normalizeInstallInput(" https://github.com/owner/repo/tree/feature/branch/skills/skill-name/?tab=readme#usage ")
    ).toHaveProperty("display", "npx skills add https://github.com/owner/repo --skill skill-name");
  });

  test("creates a stack skill from a GitHub skill directory URL", () => {
    expect(
      stackSkillFromInstallInput("https://github.com/zhangga/aihub/tree/main/skills/chatgpt-images-fallback")
    ).toEqual({
      id: "chatgpt-images-fallback",
      type: "skill",
      source: {
        type: "skills.sh",
        package: "zhangga/aihub",
        skill: "chatgpt-images-fallback"
      },
      desiredState: "enabled"
    });
  });

  test("creates a stack skill from a shorthand install command", () => {
    expect(stackSkillFromInstallInput("npx skills add owner/repo --skill skill-name")).toEqual({
      id: "skill-name",
      type: "skill",
      source: {
        type: "skills.sh",
        package: "owner/repo",
        skill: "skill-name"
      },
      desiredState: "enabled"
    });
  });

  test("returns undefined for unsupported manual source input", () => {
    expect(stackSkillFromInstallInput("npm install owner/repo")).toBeUndefined();
  });

  test("rejects unsupported GitHub URLs as install inputs", () => {
    expect(normalizeInstallInput("https://github.com/owner/repo/tree/main/docs/skill-name")).toBeUndefined();
    expect(normalizeInstallInput("https://github.com/owner/repo/blob/main/skills/skill-name/SKILL.md")).toBeUndefined();
    expect(normalizeInstallInput("https://example.com/owner/repo/tree/main/skills/skill-name")).toBeUndefined();
    expect(normalizeInstallInput("https://github.com/owner/repo/tree/main/skills/bad%20skill")).toBeUndefined();
  });

  test("rejects unsupported install command syntax", () => {
    expect(parseInstallCommand("npx skills add https://github.com/owner/repo --skill skill-name && rm -rf /")).toBeUndefined();
    expect(parseInstallCommand("npx skills add https://github.com/owner/repo --skill skill-name | cat")).toBeUndefined();
    expect(parseInstallCommand("npm install owner/repo")).toBeUndefined();
    expect(parseInstallCommand("npx skills add git@github.com:owner/repo --skill skill-name")).toBeUndefined();
  });

  test("restores installable skills with a runner and skips unsupported skills", async () => {
    const calls: string[] = [];
    const runner: RestoreCommandRunner = async (command, args) => {
      calls.push([command, ...args].join(" "));
      return {
        exitCode: 0,
        stdout: "installed",
        stderr: ""
      };
    };

    const results = await restoreMissingSkills(makeStack(), [makeInstalledSkill("already-here")], {
      runner
    });

    expect(calls).toEqual([
      "npx skills add https://github.com/vercel-labs/skills --skill find-skills",
      "npx skills add owner/repo --skill manual-skill"
    ]);
    expect(results).toEqual([
      {
        id: "already-here",
        status: "skipped",
        message: "Already installed."
      },
      {
        id: "find-skills",
        status: "success",
        message: "Installed successfully.",
        command: "npx skills add https://github.com/vercel-labs/skills --skill find-skills"
      },
      {
        id: "manual-skill",
        status: "success",
        message: "Installed successfully.",
        command: "npx skills add owner/repo --skill manual-skill"
      },
      {
        id: "local-only",
        status: "skipped",
        message: "This skill does not have a restore source yet."
      }
    ]);
  });

  test("supports restoring only selected skill ids", async () => {
    const calls: string[] = [];
    const runner: RestoreCommandRunner = async (command, args) => {
      calls.push([command, ...args].join(" "));
      return {
        exitCode: 0,
        stdout: "installed",
        stderr: ""
      };
    };

    const results = await restoreMissingSkills(makeStack(), [], {
      ids: ["manual-skill"],
      runner
    });

    expect(calls).toEqual(["npx skills add owner/repo --skill manual-skill"]);
    expect(results).toEqual([
      {
        id: "manual-skill",
        status: "success",
        message: "Installed successfully.",
        command: "npx skills add owner/repo --skill manual-skill"
      }
    ]);
  });

  test("normalizes failed restore results", async () => {
    const runner: RestoreCommandRunner = async () => ({
      exitCode: 1,
      stdout: "",
      stderr: "fatal: could not read from remote repository"
    });

    const results = await restoreMissingSkills(
      {
        schemaVersion: 1,
        skills: [
          {
            id: "find-skills",
            type: "skill",
            source: {
              type: "skills.sh",
              package: "vercel-labs/skills",
              skill: "find-skills"
            },
            desiredState: "enabled"
          }
        ]
      },
      [],
      { runner }
    );

    expect(results).toEqual([
      {
        id: "find-skills",
        status: "failed",
        message: "Could not reach the skill source. Check your network and try again.",
        command: "npx skills add https://github.com/vercel-labs/skills --skill find-skills",
        detail: "fatal: could not read from remote repository"
      }
    ]);
  });

  test("normalizes timeout restore results", async () => {
    const runner: RestoreCommandRunner = async () => ({
      exitCode: null,
      timedOut: true,
      stdout: "",
      stderr: ""
    });

    const results = await restoreMissingSkills(
      {
        schemaVersion: 1,
        skills: [
          {
            id: "slow-skill",
            type: "skill",
            source: {
              type: "skills.sh",
              package: "owner/repo",
              skill: "slow-skill"
            },
            desiredState: "enabled"
          }
        ]
      },
      [],
      { runner }
    );

    expect(results[0]).toMatchObject({
      id: "slow-skill",
      status: "failed",
      message: "This skill took too long to install. You can retry it."
    });
  });
});
