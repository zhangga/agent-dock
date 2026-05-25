import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import {
  addSkillToStack,
  createStackFile,
  readStack,
  readStackFileState,
  removeSkillFromStack,
  updateSkillSourceInStack
} from "../../src/core/stackStore.js";
import type { InstalledSkill } from "../../src/core/skillScanner.js";

const tempRoots: string[] = [];

async function makeTempRoot() {
  const root = await mkdtemp(join(tmpdir(), "agentdock-stack-"));
  tempRoots.push(root);
  return root;
}

function makeSkill(overrides: Partial<InstalledSkill> = {}): InstalledSkill {
  const root = "/Users/example/.agents/skills";
  return {
    id: "frontend-design",
    name: "frontend-design",
    description: "Create polished frontend interfaces.",
    installPath: join(root, "frontend-design"),
    manifestPath: join(root, "frontend-design", "SKILL.md"),
    sourceRoot: root,
    location: {
      kind: "personal",
      label: "Personal",
      root
    },
    ...overrides
  };
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("stackStore", () => {
  test("returns an empty stack when the stack file does not exist", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, "stack.json");

    const stack = await readStack({ stackPath });

    expect(stack).toEqual({
      schemaVersion: 1,
      skills: []
    });
  });

  test("reports the active stack path and whether it exists", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, "stack.json");

    const before = await readStackFileState({ stackPath });
    await createStackFile({ stackPath });
    const after = await readStackFileState({ stackPath });

    expect(before).toEqual({
      path: stackPath,
      exists: false
    });
    expect(after).toEqual({
      path: stackPath,
      exists: true
    });
  });

  test("creates an empty stack file", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, ".agentdock", "stack.json");

    const stack = await createStackFile({ stackPath });
    const file = JSON.parse(await readFile(stackPath, "utf8"));

    expect(stack).toEqual({
      schemaVersion: 1,
      skills: []
    });
    expect(file).toEqual(stack);
  });

  test("adds an installed skill to the stack file", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, ".agentdock", "stack.json");

    const stack = await addSkillToStack(makeSkill(), { stackPath, now: "2026-05-25T00:00:00.000Z" });

    expect(stack.skills).toEqual([
      {
        id: "frontend-design",
        type: "skill",
        source: {
          type: "unknown"
        },
        desiredState: "enabled"
      }
    ]);

    const file = JSON.parse(await readFile(stackPath, "utf8"));
    expect(file.skills[0]).toEqual(stack.skills[0]);
    expect(Object.keys(file.skills[0]).sort()).toEqual(["desiredState", "id", "source", "type"]);
  });

  test("stores a structured skills.sh source for a saved skill", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, "stack.json");

    const stack = await addSkillToStack(makeSkill({ id: "find-skills", name: "find-skills" }), {
      stackPath,
      now: "2026-05-25T00:00:00.000Z",
      install: {
        status: "resolved",
        source: "skills.sh",
        command: "npx skills add https://github.com/vercel-labs/skills --skill find-skills",
        url: "https://skills.sh/vercel-labs/skills/find-skills",
        packageName: "vercel-labs/skills@find-skills",
        resolvedAt: "2026-05-25T00:00:00.000Z"
      }
    });

    expect(stack.skills[0]).toEqual({
      id: "find-skills",
      type: "skill",
      source: {
        type: "skills.sh",
        package: "vercel-labs/skills",
        skill: "find-skills"
      },
      desiredState: "enabled"
    });
  });

  test("updates an existing stack item instead of duplicating it", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, "stack.json");

    await addSkillToStack(makeSkill({ description: "First description." }), {
      stackPath,
      now: "2026-05-25T00:00:00.000Z"
    });
    const stack = await addSkillToStack(makeSkill({ description: "Updated description." }), {
      stackPath,
      now: "2026-05-25T00:05:00.000Z"
    });

    expect(stack.skills).toHaveLength(1);
    expect(stack.skills[0]).toEqual({
      id: "frontend-design",
      type: "skill",
      source: {
        type: "unknown"
      },
      desiredState: "enabled"
    });
  });

  test("removes a saved skill from the stack file", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, "stack.json");

    await addSkillToStack(makeSkill({ id: "frontend-design", name: "frontend-design" }), {
      stackPath,
      now: "2026-05-25T00:00:00.000Z"
    });
    await addSkillToStack(
      makeSkill({
        id: "skill-installer",
        name: "skill-installer",
        installPath: "/Users/example/.agents/skills/skill-installer"
      }),
      {
        stackPath,
        now: "2026-05-25T00:01:00.000Z"
      }
    );

    const stack = await removeSkillFromStack({ id: "frontend-design" }, { stackPath });

    expect(stack.skills).toEqual([
      {
        id: "skill-installer",
        type: "skill",
        source: {
          type: "unknown"
        },
        desiredState: "enabled"
      }
    ]);

    const file = JSON.parse(await readFile(stackPath, "utf8"));
    expect(file.skills).toHaveLength(1);
  });

  test("normalizes legacy stack entries into the compact sync schema", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, "stack.json");

    await writeFile(
      stackPath,
      JSON.stringify(
        {
          schemaVersion: 1,
          skills: [
            {
              id: "find-skills",
              type: "skill",
              name: "find-skills",
              description: "Legacy description.",
              installPath: "/Users/example/.agents/skills/find-skills",
              sourceRoot: "/Users/example/.agents/skills",
              location: {
                kind: "personal",
                label: "Personal",
                root: "/Users/example/.agents/skills"
              },
              desiredState: "enabled",
              install: {
                status: "resolved",
                source: "skills.sh",
                command: "npx skills add https://github.com/vercel-labs/skills --skill find-skills",
                packageName: "vercel-labs/skills@find-skills",
                resolvedAt: "2026-05-25T00:00:00.000Z"
              },
              savedAt: "2026-05-25T00:00:00.000Z"
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const stack = await readStack({ stackPath });

    expect(stack.skills).toEqual([
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
    ]);
  });

  test("updates a saved skill with a manual command source", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, "stack.json");

    await addSkillToStack(makeSkill({ id: "custom-skill", name: "custom-skill" }), {
      stackPath
    });

    const stack = await updateSkillSourceInStack(
      { id: "custom-skill" },
      {
        type: "command",
        install: "npx skills add owner/repo --skill custom-skill"
      },
      { stackPath }
    );

    expect(stack?.skills).toEqual([
      {
        id: "custom-skill",
        type: "skill",
        source: {
          type: "command",
          install: "npx skills add owner/repo --skill custom-skill"
        },
        desiredState: "enabled"
      }
    ]);

    const file = JSON.parse(await readFile(stackPath, "utf8"));
    expect(file.skills[0].source).toEqual({
      type: "command",
      install: "npx skills add owner/repo --skill custom-skill"
    });
  });

  test("returns undefined when updating source for a missing saved skill", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, "stack.json");
    await createStackFile({ stackPath });

    const stack = await updateSkillSourceInStack(
      { id: "missing-skill" },
      {
        type: "command",
        install: "npx skills add owner/repo --skill missing-skill"
      },
      { stackPath }
    );

    expect(stack).toBeUndefined();
    expect(await readStack({ stackPath })).toEqual({
      schemaVersion: 1,
      skills: []
    });
  });
});
