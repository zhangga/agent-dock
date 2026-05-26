import { describe, expect, test } from "vitest";
import {
  applyProfileImport,
  createProfileFromStack,
  parseProfileInput,
  previewProfileImport
} from "../../src/core/profileStore.js";
import type { AgentDockStack } from "../../src/core/stackStore.js";

function makeStack(): AgentDockStack {
  return {
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

describe("profileStore", () => {
  test("creates a profile from the current stack", () => {
    const profile = createProfileFromStack(makeStack(), {
      exportedAt: "2026-05-26T00:00:00.000Z",
      agentdockVersion: "0.1.0"
    });

    expect(profile).toEqual({
      schemaVersion: 1,
      exportedAt: "2026-05-26T00:00:00.000Z",
      agentdockVersion: "0.1.0",
      stack: makeStack()
    });
  });

  test("parses profile JSON strings and object input", () => {
    const profile = createProfileFromStack(makeStack(), {
      exportedAt: "2026-05-26T00:00:00.000Z",
      agentdockVersion: "0.1.0"
    });

    expect(parseProfileInput(JSON.stringify(profile))).toEqual(profile);
    expect(parseProfileInput(profile)).toEqual(profile);
  });

  test("rejects invalid JSON and unsupported schemas", () => {
    expect(() => parseProfileInput("{not json")).toThrow("Profile JSON could not be parsed.");
    expect(() => parseProfileInput({ schemaVersion: 99 })).toThrow("Only AgentDock profile schema v1 is supported.");
  });

  test("previews new, existing, updated, and invalid imported skills", () => {
    const current = makeStack();
    const imported = parseProfileInput({
      schemaVersion: 1,
      exportedAt: "2026-05-26T00:00:00.000Z",
      agentdockVersion: "0.1.0",
      stack: {
        schemaVersion: 1,
        skills: [
          current.skills[0],
          {
            id: "local-only",
            type: "skill",
            source: {
              type: "command",
              install: "npx skills add owner/repo --skill local-only"
            },
            desiredState: "enabled"
          },
          {
            id: "new-skill",
            type: "skill",
            source: {
              type: "skills.sh",
              package: "owner/repo",
              skill: "new-skill"
            },
            desiredState: "enabled"
          },
          {
            id: "",
            type: "skill",
            source: {
              type: "unknown"
            },
            desiredState: "enabled"
          },
          {
            id: "bad-source",
            type: "skill",
            source: {
              type: "file"
            },
            desiredState: "enabled"
          }
        ]
      }
    });

    const preview = previewProfileImport(imported, current);

    expect(preview.summary).toEqual({
      new: 1,
      existing: 1,
      updated: 1,
      invalid: 2
    });
    expect(preview.items.map((item) => [item.id, item.status])).toEqual([
      ["find-skills", "existing"],
      ["local-only", "updated"],
      ["new-skill", "new"],
      ["", "invalid"],
      ["bad-source", "invalid"]
    ]);
  });

  test("applies valid imported skills and ignores invalid entries", () => {
    const current = makeStack();
    const imported = parseProfileInput({
      schemaVersion: 1,
      exportedAt: "2026-05-26T00:00:00.000Z",
      agentdockVersion: "0.1.0",
      stack: {
        schemaVersion: 1,
        skills: [
          {
            id: "local-only",
            type: "skill",
            source: {
              type: "command",
              install: "npx skills add owner/repo --skill local-only"
            },
            desiredState: "enabled"
          },
          {
            id: "new-skill",
            type: "skill",
            source: {
              type: "skills.sh",
              package: "owner/repo",
              skill: "new-skill"
            },
            desiredState: "enabled"
          },
          {
            id: "",
            type: "skill",
            source: {
              type: "unknown"
            },
            desiredState: "enabled"
          }
        ]
      }
    });

    const result = applyProfileImport(imported, current);

    expect(result.stack.skills).toEqual([
      current.skills[0],
      {
        id: "local-only",
        type: "skill",
        source: {
          type: "command",
          install: "npx skills add owner/repo --skill local-only"
        },
        desiredState: "enabled"
      },
      {
        id: "new-skill",
        type: "skill",
        source: {
          type: "skills.sh",
          package: "owner/repo",
          skill: "new-skill"
        },
        desiredState: "enabled"
      }
    ]);
    expect(result.preview.summary).toEqual({
      new: 1,
      existing: 0,
      updated: 1,
      invalid: 1
    });
  });
});
