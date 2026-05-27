import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { ensureDefaultStackFile } from "../../src/cli/startup.js";

const tempRoots: string[] = [];

async function makeTempRoot() {
  const root = await mkdtemp(join(tmpdir(), "agentdock-startup-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (!root) continue;
    await rm(root, { recursive: true, force: true });
  }
});

describe("ensureDefaultStackFile", () => {
  test("creates the stack file when it is missing", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, ".agentdock", "stack.json");

    const result = await ensureDefaultStackFile({ stackPath });

    expect(result.created).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.path).toBe(stackPath);

    const content = await readFile(stackPath, "utf8");
    expect(JSON.parse(content)).toMatchObject({
      schemaVersion: 1,
      skills: []
    });
  });

  test("does not overwrite an existing stack file", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, ".agentdock", "stack.json");
    const existingContent = JSON.stringify(
      {
        schemaVersion: 1,
        skills: [
          {
            id: "existing-skill",
            type: "skill",
            source: { type: "unknown" },
            desiredState: "enabled"
          }
        ]
      },
      null,
      2
    );

    await mkdir(join(root, ".agentdock"), { recursive: true });
    await writeFile(stackPath, existingContent, "utf8");

    const result = await ensureDefaultStackFile({ stackPath });

    expect(result.created).toBe(false);
    expect(result.error).toBeUndefined();
    expect(result.path).toBe(stackPath);

    const content = await readFile(stackPath, "utf8");
    expect(content).toBe(existingContent);
  });

  test("uses the configured stack path from configPath", async () => {
    const root = await makeTempRoot();
    const configPath = join(root, "config.json");
    const stackPath = join(root, "custom-stack.json");

    await writeFile(
      configPath,
      JSON.stringify({ schemaVersion: 1, stackPath }, null, 2),
      "utf8"
    );

    const result = await ensureDefaultStackFile({ configPath });

    expect(result.created).toBe(true);
    expect(result.path).toBe(stackPath);

    const content = await readFile(stackPath, "utf8");
    expect(JSON.parse(content)).toMatchObject({ schemaVersion: 1, skills: [] });
  });

  test("returns an error string when the file cannot be written", async () => {
    const root = await makeTempRoot();
    const blockerPath = join(root, "blocker.txt");
    await writeFile(blockerPath, "not a directory", "utf8");

    const stackPath = join(blockerPath, "nested", "stack.json");

    const result = await ensureDefaultStackFile({ stackPath });

    expect(result.created).toBe(false);
    expect(typeof result.error).toBe("string");
    expect(result.error?.length).toBeGreaterThan(0);
    expect(result.path).toBe(stackPath);
  });
});
