import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { getSkillLocation, scanInstalledSkills } from "../../src/core/skillScanner.js";

const tempRoots: string[] = [];

async function makeTempRoot() {
  const root = await mkdtemp(join(tmpdir(), "agentdock-skills-"));
  tempRoots.push(root);
  return root;
}

async function writeSkill(root: string, dirName: string, body: string) {
  const skillDir = join(root, dirName);
  await mkdir(skillDir, { recursive: true });
  await writeFile(join(skillDir, "SKILL.md"), body, "utf8");
  return skillDir;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("scanInstalledSkills", () => {
  test("finds installed skills with metadata from SKILL.md files", async () => {
    const root = await makeTempRoot();
    const frontendPath = await writeSkill(
      root,
      "frontend-design",
      [
        "---",
        "name: frontend-design",
        "description: Create polished frontend interfaces.",
        "---",
        "",
        "# Frontend Design"
      ].join("\n")
    );

    await writeSkill(
      root,
      "playwright-cli",
      [
        "---",
        "name: playwright-cli",
        "description: Automate browser interactions.",
        "---",
        "",
        "# Playwright CLI"
      ].join("\n")
    );
    await mkdir(join(root, "notes-only"), { recursive: true });

    const skills = await scanInstalledSkills({ roots: [root] });

    expect(skills).toEqual([
      {
        id: "frontend-design",
        name: "frontend-design",
        description: "Create polished frontend interfaces.",
        installPath: frontendPath,
        manifestPath: join(frontendPath, "SKILL.md"),
        sourceRoot: root,
        location: {
          kind: "custom",
          label: "Custom",
          root
        }
      },
      {
        id: "playwright-cli",
        name: "playwright-cli",
        description: "Automate browser interactions.",
        installPath: join(root, "playwright-cli"),
        manifestPath: join(root, "playwright-cli", "SKILL.md"),
        sourceRoot: root,
        location: {
          kind: "custom",
          label: "Custom",
          root
        }
      }
    ]);
  });

  test("falls back to the directory name when frontmatter is missing", async () => {
    const root = await makeTempRoot();
    await writeSkill(root, "plain-skill", "# Plain Skill\n\nNo metadata yet.");

    const skills = await scanInstalledSkills({ roots: [root] });

    expect(skills).toMatchObject([
      {
        id: "plain-skill",
        name: "plain-skill",
        description: "",
        installPath: join(root, "plain-skill")
      }
    ]);
  });

  test("skips skills installed as symlinks into an agent skill root", async () => {
    const root = await makeTempRoot();
    const sourceRoot = await makeTempRoot();
    await writeSkill(
      sourceRoot,
      "browser-tools",
      ["---", "name: browser-tools", "description: Browser helpers.", "---", "", "# Browser Tools"].join("\n")
    );
    await symlink(join(sourceRoot, "browser-tools"), join(root, "browser-tools"), "dir");

    const skills = await scanInstalledSkills({ roots: [root] });

    expect(skills).toEqual([]);
  });

  test("keeps distinct real skill directories with the same skill id", async () => {
    const agentsRoot = await makeTempRoot();
    const claudeRoot = await makeTempRoot();
    const agentsSkillPath = await writeSkill(
      agentsRoot,
      "agent-browser",
      [
        "---",
        "name: agent-browser",
        "description: Browser automation from agents.",
        "---",
        "",
        "# Agent Browser"
      ].join("\n")
    );
    await writeSkill(
      claudeRoot,
      "agent-browser",
      [
        "---",
        "name: agent-browser",
        "description: Browser automation from claude.",
        "---",
        "",
        "# Agent Browser"
      ].join("\n")
    );

    const skills = await scanInstalledSkills({ roots: [agentsRoot, claudeRoot] });

    expect(skills).toHaveLength(2);
    expect(skills).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "agent-browser",
        description: "Browser automation from claude.",
        installPath: join(claudeRoot, "agent-browser"),
        sourceRoot: claudeRoot
      }),
      expect.objectContaining({
        id: "agent-browser",
        description: "Browser automation from agents.",
        installPath: agentsSkillPath,
        sourceRoot: agentsRoot
      })
    ]));
  });

  test("labels common skill roots for the UI", () => {
    const home = "/Users/example";
    const cwd = "/Users/example/work/project";

    expect(getSkillLocation(join(home, ".agents", "skills"), { home, cwd })).toMatchObject({
      kind: "personal",
      label: "Personal"
    });
    expect(getSkillLocation(join(home, ".codex", "skills"), { home, cwd })).toMatchObject({
      kind: "codex",
      label: "Codex"
    });
    expect(getSkillLocation(join(cwd, ".agents", "skills"), { home, cwd })).toMatchObject({
      kind: "project",
      label: "Project"
    });
  });
});
