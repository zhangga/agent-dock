import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { AddressInfo } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { createAgentDockServer } from "../../src/server/server.js";
import type { StackSkillInstall } from "../../src/core/stackStore.js";
import type { RestoreCommandRunner } from "../../src/core/skillRestoreExecutor.js";

const tempRoots: string[] = [];

async function makeTempRoot() {
  const root = await mkdtemp(join(tmpdir(), "agentdock-server-"));
  tempRoots.push(root);
  return root;
}

async function writeSkill(root: string, dirName: string) {
  const skillDir = join(root, dirName);
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    join(skillDir, "SKILL.md"),
    [
      "---",
      `name: ${dirName}`,
      `description: ${dirName} description`,
      "---",
      "",
      `# ${dirName}`
    ].join("\n"),
    "utf8"
  );
}

async function withServer<T>(
  skillRoots: string[],
  run: (baseUrl: string) => Promise<T>,
  options: {
    stackPath?: string;
    configPath?: string;
    chooseStackFile?: () => Promise<{ path?: string; canceled?: boolean }>;
    resolveSkillInstall?: () => Promise<StackSkillInstall>;
    restoreRunner?: RestoreCommandRunner;
  } = {}
) {
  const server = createAgentDockServer({
    skillRoots,
    stackPath: options.stackPath,
    configPath: options.configPath,
    chooseStackFile: options.chooseStackFile,
    restoreRunner: options.restoreRunner,
    resolveSkillInstall:
      options.resolveSkillInstall ??
      (async () => ({
        status: "missing_install_source",
        reason: "Not resolved in this test.",
        resolvedAt: "2026-05-25T00:00:00.000Z"
      }))
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("AgentDock server", () => {
  test("serves installed skills as JSON", async () => {
    const root = await makeTempRoot();
    await writeSkill(root, "browser-tools");

    await withServer([root], async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/skills`);
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload).toEqual({
        skills: [
          expect.objectContaining({
            id: "browser-tools",
            name: "browser-tools",
            description: "browser-tools description"
          })
        ]
      });
    });
  });

  test("serves an empty stack as JSON", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, ".agentdock", "stack.json");

    await withServer(
      [root],
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stack`);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toMatchObject({
          stackFile: {
            path: stackPath,
            exists: false
          },
          stack: {
            schemaVersion: 1,
            skills: []
          }
        });
      },
      { stackPath }
    );
  });

  test("creates the configured stack file", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, ".agentdock", "stack.json");

    await withServer(
      [root],
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stack/create`, { method: "POST" });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toMatchObject({
          stackFile: {
            path: stackPath,
            exists: true
          },
          stack: {
            schemaVersion: 1,
            skills: []
          }
        });
      },
      { stackPath }
    );
  });

  test("saves an installed skill into the stack", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, ".agentdock", "stack.json");
    await writeSkill(root, "browser-tools");

    await withServer(
      [root],
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stack/skills`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: "browser-tools",
            installPath: join(root, "browser-tools")
          })
        });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.stack.skills).toEqual([
          {
            id: "browser-tools",
            type: "skill",
            source: {
              type: "unknown"
            },
            desiredState: "enabled"
          }
        ]);
      },
      { stackPath }
    );
  });

  test("saves a structured skills.sh source when saving a skill", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, ".agentdock", "stack.json");
    await writeSkill(root, "find-skills");

    await withServer(
      [root],
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stack/skills`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: "find-skills",
            installPath: join(root, "find-skills")
          })
        });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.stack.skills[0]).toEqual({
          id: "find-skills",
          type: "skill",
          source: {
            type: "skills.sh",
            package: "vercel-labs/skills",
            skill: "find-skills"
          },
          desiredState: "enabled"
        });
      },
      {
        stackPath,
        resolveSkillInstall: async () => ({
          status: "resolved",
          source: "skills.sh",
          command: "npx skills add https://github.com/vercel-labs/skills --skill find-skills",
          url: "https://skills.sh/vercel-labs/skills/find-skills",
          packageName: "vercel-labs/skills@find-skills",
          resolvedAt: "2026-05-25T00:00:00.000Z"
        })
      }
    );
  });

  test("removes a saved skill from the stack", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, ".agentdock", "stack.json");
    await writeSkill(root, "browser-tools");

    await withServer(
      [root],
      async (baseUrl) => {
        await fetch(`${baseUrl}/api/stack/skills`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: "browser-tools",
            installPath: join(root, "browser-tools")
          })
        });

        const response = await fetch(`${baseUrl}/api/stack/skills`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: "browser-tools"
          })
        });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.stack.skills).toEqual([]);
        expect(payload.stackFile).toMatchObject({
          path: stackPath,
          exists: true
        });
      },
      { stackPath }
    );
  });

  test("sets and creates the current stack file path through the API", async () => {
    const root = await makeTempRoot();
    const configPath = join(root, ".agentdock", "config.json");
    const stackPath = join(root, "portable", "stack.json");

    await withServer(
      [root],
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stack/path`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path: stackPath })
        });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toMatchObject({
          stackFile: {
            path: stackPath,
            exists: true
          },
          stack: {
            schemaVersion: 1,
            skills: []
          }
        });

        const stackFile = JSON.parse(await readFile(stackPath, "utf8"));
        expect(stackFile).toEqual({
          schemaVersion: 1,
          skills: []
        });
      },
      { configPath }
    );
  });

  test("loads the configured stack file path on the next server start", async () => {
    const root = await makeTempRoot();
    const configPath = join(root, ".agentdock", "config.json");
    const stackPath = join(root, "portable", "stack.json");

    await withServer(
      [root],
      async (baseUrl) => {
        await fetch(`${baseUrl}/api/stack/path`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path: stackPath })
        });
      },
      { configPath }
    );

    await withServer(
      [root],
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stack`);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.stackFile).toEqual({
          path: stackPath,
          exists: true
        });
      },
      { configPath }
    );
  });

  test("chooses and creates the current stack file through the local picker API", async () => {
    const root = await makeTempRoot();
    const configPath = join(root, ".agentdock", "config.json");
    const stackPath = join(root, "picked", "stack.json");

    await withServer(
      [root],
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stack/choose-file`, { method: "POST" });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toMatchObject({
          stackFile: {
            path: stackPath,
            exists: true
          },
          stack: {
            schemaVersion: 1,
            skills: []
          }
        });

        const stackResponse = await fetch(`${baseUrl}/api/stack`);
        const stackPayload = await stackResponse.json();
        const stackFile = JSON.parse(await readFile(stackPath, "utf8"));

        expect(stackPayload.stackFile).toEqual({
          path: stackPath,
          exists: true
        });
        expect(stackFile).toEqual({
          schemaVersion: 1,
          skills: []
        });
      },
      {
        configPath,
        chooseStackFile: async () => ({ path: stackPath })
      }
    );
  });

  test("reports when the local stack file picker is canceled", async () => {
    const root = await makeTempRoot();

    await withServer(
      [root],
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stack/choose-file`, { method: "POST" });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toEqual({ canceled: true });
      },
      {
        chooseStackFile: async () => ({ canceled: true })
      }
    );
  });

  test("serves a restore plan for the current backup file", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, ".agentdock", "stack.json");
    await writeSkill(root, "already-here");

    await withServer(
      [root],
      async (baseUrl) => {
        await fetch(`${baseUrl}/api/stack/create`, { method: "POST" });
        await fetch(`${baseUrl}/api/stack/skills`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: "already-here",
            installPath: join(root, "already-here")
          })
        });

        const stack = JSON.parse(await readFile(stackPath, "utf8"));
        stack.skills.push(
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
        );
        await writeFile(stackPath, `${JSON.stringify(stack, null, 2)}\n`, "utf8");

        const response = await fetch(`${baseUrl}/api/restore/skills/plan`, { method: "POST" });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.plan.alreadyInstalled.map((skill: { id: string }) => skill.id)).toEqual(["already-here"]);
        expect(payload.plan.installable.map((skill: { id: string }) => skill.id)).toEqual(["find-skills"]);
        expect(payload.plan.needsAttention.map((skill: { id: string }) => skill.id)).toEqual(["local-only"]);
      },
      { stackPath }
    );
  });

  test("applies restore for installable skills", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, ".agentdock", "stack.json");
    const calls: string[] = [];

    await withServer(
      [root],
      async (baseUrl) => {
        await fetch(`${baseUrl}/api/stack/create`, { method: "POST" });
        const stack = {
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
        };
        await writeFile(stackPath, `${JSON.stringify(stack, null, 2)}\n`, "utf8");

        const response = await fetch(`${baseUrl}/api/restore/skills/apply`, { method: "POST" });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(calls).toEqual(["npx skills add https://github.com/vercel-labs/skills --skill find-skills"]);
        expect(payload.results).toEqual([
          {
            id: "find-skills",
            status: "success",
            message: "Installed successfully.",
            command: "npx skills add https://github.com/vercel-labs/skills --skill find-skills"
          }
        ]);
      },
      {
        stackPath,
        restoreRunner: async (command, args) => {
          calls.push([command, ...args].join(" "));
          return {
            exitCode: 0,
            stdout: "installed",
            stderr: ""
          };
        }
      }
    );
  });

  test("saves a manual install command source through the API", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, ".agentdock", "stack.json");
    await writeSkill(root, "local-only");

    await withServer(
      [root],
      async (baseUrl) => {
        await fetch(`${baseUrl}/api/stack/skills`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: "local-only",
            installPath: join(root, "local-only")
          })
        });

        const response = await fetch(`${baseUrl}/api/stack/skills/source`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: "local-only",
            install: "npx skills add owner/repo --skill local-only"
          })
        });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.stack.skills[0].source).toEqual({
          type: "command",
          install: "npx skills add owner/repo --skill local-only"
        });
      },
      { stackPath }
    );
  });

  test("rejects unsupported manual install commands", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, ".agentdock", "stack.json");
    await writeSkill(root, "local-only");

    await withServer(
      [root],
      async (baseUrl) => {
        await fetch(`${baseUrl}/api/stack/skills`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: "local-only",
            installPath: join(root, "local-only")
          })
        });

        const response = await fetch(`${baseUrl}/api/stack/skills/source`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: "local-only",
            install: "npx skills add owner/repo --skill local-only && rm -rf /"
          })
        });
        const payload = await response.json();

        expect(response.status).toBe(400);
        expect(payload).toEqual({
          error: "Only npx skills add ... commands are supported right now."
        });
      },
      { stackPath }
    );
  });

  test("serves the local console HTML", async () => {
    const root = await makeTempRoot();

    await withServer([root], async (baseUrl) => {
      const response = await fetch(baseUrl);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect(html).toContain("AgentDock");
      expect(html).toContain("skill-list");
    });
  });

  test("serves compact description UI with hover details", async () => {
    const root = await makeTempRoot();

    await withServer([root], async (baseUrl) => {
      const response = await fetch(baseUrl);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain("desc-popover");
      expect(html).toContain("desc-preview");
      expect(html).toContain("desc-full");
      expect(html).toContain("previewDescription(");
    });
  });

  test("serves My Stack and Location UI controls", async () => {
    const root = await makeTempRoot();

    await withServer([root], async (baseUrl) => {
      const response = await fetch(baseUrl);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain("My Stack");
      expect(html).toContain("my-stack-list");
      expect(html).toContain("stack-count");
      expect(html).toContain("save-skill");
      expect(html).toContain("remove-stack-skill");
      expect(html).toContain("renderMyStack(");
      expect(html).toContain("Install command");
      expect(html).toContain("renderInstallCommand(");
      expect(html).toContain("Missing install source");
      expect(html).toContain("Location");
      expect(html).not.toContain("Source root</th>");
    });
  });

  test("serves install plan and copy script UI controls", async () => {
    const root = await makeTempRoot();

    await withServer([root], async (baseUrl) => {
      const response = await fetch(baseUrl);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain("Install Plan");
      expect(html).toContain("install-plan");
      expect(html).toContain("install-plan-summary");
      expect(html).toContain("install-script");
      expect(html).toContain("copy-install-script");
      expect(html).toContain("Copy install script");
      expect(html).toContain("renderInstallPlan(");
      expect(html).toContain("buildInstallScript(");
      expect(html).toContain("copyTextWithFallback(");
    });
  });

  test("serves stack file path and missing-file prompt UI", async () => {
    const root = await makeTempRoot();

    await withServer([root], async (baseUrl) => {
      const response = await fetch(baseUrl);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain("Current stack file");
      expect(html).toContain("stack-file-path");
      expect(html).toContain("create-stack");
      expect(html).toContain("choose-stack-file");
      expect(html).toContain("Choose stack file");
      expect(html).toContain("manual-stack-path");
      expect(html).toContain("stack-path-input");
      expect(html).toContain("/api/stack/choose-file");
      expect(html).toContain("/api/stack/path");
      expect(html).not.toContain("Use another path");
      expect(html).not.toContain("AGENTDOCK_STACK_PATH");
    });
  });

  test("handles favicon requests without logging browser noise", async () => {
    const root = await makeTempRoot();

    await withServer([root], async (baseUrl) => {
      const response = await fetch(`${baseUrl}/favicon.ico`);

      expect(response.status).toBe(204);
    });
  });
});
