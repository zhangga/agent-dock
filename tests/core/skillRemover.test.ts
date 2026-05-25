import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { removeInstalledSkill } from "../../src/core/skillRemover.js";
import type { InstalledSkill } from "../../src/core/skillScanner.js";

const tempRoots: string[] = [];

async function makeTempRoot() {
  const root = await mkdtemp(join(tmpdir(), "agentdock-remove-skill-"));
  tempRoots.push(root);
  return root;
}

async function writeSkill(root: string, dirName: string) {
  const installPath = join(root, dirName);
  const manifestPath = join(installPath, "SKILL.md");
  await mkdir(installPath, { recursive: true });
  await writeFile(
    manifestPath,
    ["---", `name: ${dirName}`, `description: ${dirName}`, "---", "", `# ${dirName}`].join("\n"),
    "utf8"
  );

  return makeInstalledSkill(root, installPath, manifestPath, dirName);
}

function makeInstalledSkill(root: string, installPath: string, manifestPath: string, id: string): InstalledSkill {
  return {
    id,
    name: id,
    description: id,
    installPath,
    manifestPath,
    sourceRoot: root,
    location: {
      kind: "custom",
      label: "Custom",
      root
    }
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("removeInstalledSkill", () => {
  test("removes a scanned skill directory", async () => {
    const root = await makeTempRoot();
    const skill = await writeSkill(root, "browser-tools");

    const result = await removeInstalledSkill(skill);

    expect(result).toEqual({
      removed: true,
      id: "browser-tools",
      installPath: join(root, "browser-tools"),
      method: "filesystem"
    });
    expect(await exists(join(root, "browser-tools"))).toBe(false);
    expect(await exists(root)).toBe(true);
  });

  test("refuses to remove the skill root itself", async () => {
    const root = await makeTempRoot();
    const manifestPath = join(root, "SKILL.md");
    await writeFile(manifestPath, ["---", "name: root-skill", "---"].join("\n"), "utf8");
    const skill = makeInstalledSkill(root, root, manifestPath, "root-skill");

    await expect(removeInstalledSkill(skill)).rejects.toThrow("Refusing to remove a skill root directly.");
    expect(await exists(root)).toBe(true);
  });

  test("refuses to remove a directory when the manifest is missing", async () => {
    const root = await makeTempRoot();
    const skill = await writeSkill(root, "browser-tools");
    await rm(skill.manifestPath);

    await expect(removeInstalledSkill(skill)).rejects.toThrow("Skill manifest is missing.");
    expect(await exists(skill.installPath)).toBe(true);
  });

  test("uses the skills CLI for standard agent roots", async () => {
    const root = await makeTempRoot();
    const skill = await writeSkill(root, "browser-tools");
    skill.location = {
      kind: "codex",
      label: "Codex",
      root
    };
    const calls: Array<{ command: string; args: string[] }> = [];

    const result = await removeInstalledSkill(skill, {
      runner: async (command, args) => {
        calls.push({ command, args });
        await rm(skill.installPath, { recursive: true, force: false });
        return { exitCode: 0, stdout: "", stderr: "" };
      }
    });

    expect(calls).toEqual([
      {
        command: "npx",
        args: ["--yes", "skills", "remove", "--global", "browser-tools", "--agent", "*", "-y"]
      }
    ]);
    expect(result).toEqual({
      removed: true,
      id: "browser-tools",
      installPath: join(root, "browser-tools"),
      method: "skills-cli"
    });
    expect(await exists(skill.installPath)).toBe(false);
  });

  test("falls back to filesystem removal when the skills CLI leaves the path installed", async () => {
    const root = await makeTempRoot();
    const skill = await writeSkill(root, "browser-tools");
    skill.location = {
      kind: "project",
      label: "Project",
      root
    };

    const result = await removeInstalledSkill(skill, {
      runner: async () => ({ exitCode: 1, stdout: "", stderr: "not installed" })
    });

    expect(result).toEqual({
      removed: true,
      id: "browser-tools",
      installPath: join(root, "browser-tools"),
      method: "filesystem"
    });
    expect(await exists(skill.installPath)).toBe(false);
  });
});
