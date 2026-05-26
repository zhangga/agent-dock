import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { AddressInfo } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { createAgentDockServer } from "../../src/server/server.js";
import type { StackSkillInstall } from "../../src/core/stackStore.js";
import type { RestoreCommandRunner } from "../../src/core/skillRestoreExecutor.js";
import type { SkillRemoveRunner } from "../../src/core/skillRemover.js";
import type { RunDiagnosticsOptions } from "../../src/core/diagnostics.js";

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

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function withServer<T>(
  skillRoots: string[],
  run: (baseUrl: string) => Promise<T>,
  options: {
    stackPath?: string;
    configPath?: string;
    chooseStackFile?: () => Promise<{ path?: string; canceled?: boolean }>;
    revealStackFile?: (path: string) => Promise<{ revealed?: boolean; unavailable?: boolean; message?: string }>;
    resolveSkillInstall?: () => Promise<StackSkillInstall>;
    restoreRunner?: RestoreCommandRunner;
    removeSkillRunner?: SkillRemoveRunner;
    diagnostics?: RunDiagnosticsOptions;
  } = {}
) {
  const server = createAgentDockServer({
    skillRoots,
    stackPath: options.stackPath,
    configPath: options.configPath,
    chooseStackFile: options.chooseStackFile,
    revealStackFile: options.revealStackFile,
    restoreRunner: options.restoreRunner,
    removeSkillRunner: options.removeSkillRunner,
    diagnostics: options.diagnostics,
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

  test("does not save an installed skill without an install command", async () => {
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

        expect(response.status).toBe(400);
        expect(payload).toEqual({
          error: "Install command or GitHub skill URL is required before a skill can be saved to backup."
        });

        const stackResponse = await fetch(`${baseUrl}/api/stack`);
        const stackPayload = await stackResponse.json();
        expect(stackPayload.stack.skills).toEqual([]);
      },
      { stackPath }
    );
  });

  test("resolves a skill install command without saving it", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, ".agentdock", "stack.json");
    await writeSkill(root, "find-skills");

    await withServer(
      [root],
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stack/skills/resolve`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: "find-skills",
            installPath: join(root, "find-skills")
          })
        });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.command).toBe("npx skills add https://github.com/vercel-labs/skills --skill find-skills");
        expect(payload.install.status).toBe("resolved");

        const stackResponse = await fetch(`${baseUrl}/api/stack`);
        const stackPayload = await stackResponse.json();
        expect(stackPayload.stack.skills).toEqual([]);
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
            installPath: join(root, "find-skills"),
            install: "npx skills add https://github.com/vercel-labs/skills --skill find-skills"
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
      { stackPath }
    );
  });

  test("normalizes a GitHub skill URL when saving a skill", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, ".agentdock", "stack.json");
    await writeSkill(root, "chatgpt-images-fallback");

    await withServer(
      [root],
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stack/skills`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: "chatgpt-images-fallback",
            installPath: join(root, "chatgpt-images-fallback"),
            install: "https://github.com/zhangga/aihub/tree/main/skills/chatgpt-images-fallback"
          })
        });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.stack.skills[0]).toEqual({
          id: "chatgpt-images-fallback",
          type: "skill",
          source: {
            type: "skills.sh",
            package: "zhangga/aihub",
            skill: "chatgpt-images-fallback"
          },
          desiredState: "enabled"
        });
      },
      { stackPath }
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
            installPath: join(root, "browser-tools"),
            install: "npx skills add owner/repo --skill browser-tools"
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

  test("uninstalls a local skill without removing it from backup", async () => {
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
            installPath: join(root, "browser-tools"),
            install: "npx skills add owner/repo --skill browser-tools"
          })
        });

        const response = await fetch(`${baseUrl}/api/skills`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: "browser-tools",
            installPath: join(root, "browser-tools")
          })
        });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.removed).toEqual({
          removed: true,
          id: "browser-tools",
          installPath: join(root, "browser-tools"),
          method: "filesystem"
        });
        expect(payload.skills).toEqual([]);
        expect(payload.stack.skills).toHaveLength(1);
        expect(await pathExists(join(root, "browser-tools"))).toBe(false);
      },
      { stackPath }
    );
  });

  test("does not uninstall a local skill when the install path does not match the scan result", async () => {
    const root = await makeTempRoot();
    await writeSkill(root, "browser-tools");

    await withServer([root], async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/skills`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "browser-tools",
          installPath: join(root, "not-browser-tools")
        })
      });
      const payload = await response.json();

      expect(response.status).toBe(404);
      expect(payload).toEqual({
        error: "Skill not found"
      });
      expect(await pathExists(join(root, "browser-tools"))).toBe(true);
    });
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

  test("reveals the current stack file location through the API", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, "portable", "stack.json");
    const revealedPaths: string[] = [];

    await withServer(
      [root],
      async (baseUrl) => {
        await fetch(`${baseUrl}/api/stack/create`, { method: "POST" });

        const response = await fetch(`${baseUrl}/api/stack/reveal`, { method: "POST" });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toEqual({
          revealed: true,
          stackFile: {
            path: stackPath,
            exists: true
          }
        });
        expect(revealedPaths).toEqual([stackPath]);
      },
      {
        stackPath,
        revealStackFile: async (path) => {
          revealedPaths.push(path);
          return { revealed: true };
        }
      }
    );
  });

  test("does not reveal a missing stack file", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, "portable", "stack.json");
    const revealedPaths: string[] = [];

    await withServer(
      [root],
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stack/reveal`, { method: "POST" });
        const payload = await response.json();

        expect(response.status).toBe(404);
        expect(payload).toEqual({
          error: "Create the backup file before opening its location."
        });
        expect(revealedPaths).toEqual([]);
      },
      {
        stackPath,
        revealStackFile: async (path) => {
          revealedPaths.push(path);
          return { revealed: true };
        }
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
            installPath: join(root, "already-here"),
            install: "npx skills add owner/repo --skill already-here"
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

  test("saves a manual install command source while adding a skill", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, ".agentdock", "stack.json");
    await writeSkill(root, "local-only");

    await withServer(
      [root],
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stack/skills`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: "local-only",
            installPath: join(root, "local-only"),
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

  test("rejects unsupported install commands when adding a skill", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, ".agentdock", "stack.json");
    await writeSkill(root, "local-only");

    await withServer(
      [root],
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/stack/skills`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: "local-only",
            installPath: join(root, "local-only"),
            install: "npx skills add owner/repo --skill local-only && rm -rf /"
          })
        });
        const payload = await response.json();

        expect(response.status).toBe(400);
        expect(payload).toEqual({
          error: "Enter a npx skills add command or a GitHub skill URL."
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
      expect(html).toContain("GitHub skill URL");
    });
  });

  test("serves compact description UI with expandable details", async () => {
    const root = await makeTempRoot();

    await withServer([root], async (baseUrl) => {
      const response = await fetch(baseUrl);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain("desc-details");
      expect(html).toContain("desc-preview");
      expect(html).toContain("desc-full");
      expect(html).toContain("previewDescription(");
    });
  });

  test("serves accessible responsive console controls", async () => {
    const root = await makeTempRoot();

    await withServer([root], async (baseUrl) => {
      const response = await fetch(baseUrl);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain('class="metrics" aria-label="AgentDock counts"');
      expect(html).toContain('id="view-subtitle"');
      expect(html).toContain('id="search-wrap"');
      expect(html).toContain('aria-label="Filter installed skills"');
      expect(html).toContain('id="clear-search"');
      expect(html).toContain("clearSearch.addEventListener");
      expect(html).toContain('aria-label="Generated install script"');
      expect(html).toContain('data-label="Install path"');
      expect(html).toContain("No matches found");
    });
  });

  test("serves tabbed sections with installed as the default view", async () => {
    const root = await makeTempRoot();

    await withServer([root], async (baseUrl) => {
      const response = await fetch(baseUrl);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain('class="view-tabs" role="tablist"');
      expect(html).toContain('id="installed-tab" class="view-tab active" role="tab" type="button" aria-selected="true" aria-controls="installed-panel" data-view="installed"');
      expect(html).toContain('id="backup-tab" class="view-tab" role="tab" type="button" aria-selected="false" aria-controls="backup-panel" data-view="backup"');
      expect(html).toContain('id="restore-tab" class="view-tab" role="tab" type="button" aria-selected="false" aria-controls="restore-panel" data-view="restore"');
      expect(html).toContain('id="installed-panel" class="view-panel" role="tabpanel" aria-labelledby="installed-tab" data-view="installed"');
      expect(html).toContain('id="backup-panel" class="view-panel" role="tabpanel" aria-labelledby="backup-tab" data-view="backup" hidden');
      expect(html).toContain('id="restore-panel" class="view-panel" role="tabpanel" aria-labelledby="restore-tab" data-view="restore" hidden');
      expect(html).toContain("activateView(");
      expect(html).toContain("viewTabs.forEach");
    });
  });

  test("serves backup contents and location UI controls", async () => {
    const root = await makeTempRoot();

    await withServer([root], async (baseUrl) => {
      const response = await fetch(baseUrl);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain("Backup Contents");
      expect(html).toContain("backup-list");
      expect(html).toContain("stack-count");
      expect(html).toContain("add-to-backup");
      expect(html).toContain("remove-stack-skill");
      expect(html).toContain("renderBackupContents(");
      expect(html).toContain("Restore source");
      expect(html).toContain("This skill does not have a restore source yet.");
      expect(html).toContain("Location");
      expect(html).not.toContain("Source root</th>");
    });
  });

  test("serves backup command confirmation UI", async () => {
    const root = await makeTempRoot();

    await withServer([root], async (baseUrl) => {
      const response = await fetch(baseUrl);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain('id="backup-confirm-dialog"');
      expect(html).toContain("Confirm backup command");
      expect(html).toContain("backup-command-input");
      expect(html).toContain("backup-confirm-message");
      expect(html).toContain("resolveSkillBeforeBackup(");
      expect(html).toContain("openBackupConfirm(");
      expect(html).toContain("saveConfirmedSkill(");
      expect(html).toContain("/api/stack/skills/resolve");
      expect(html).not.toContain("saveSkill(button.dataset.id, button.dataset.installPath);");
    });
  });

  test("serves local skill uninstall controls inside the installed list", async () => {
    const root = await makeTempRoot();

    await withServer([root], async (baseUrl) => {
      const response = await fetch(baseUrl);
      const html = await response.text();
      const toolbarHtml = html.slice(html.indexOf('<div class="toolbar">'), html.indexOf('<div class="view-tabs"'));
      const installedPanelHtml = html.slice(
        html.indexOf('<section id="installed-panel"'),
        html.indexOf('<section id="backup-panel"')
      );

      expect(response.status).toBe(200);
      expect(toolbarHtml).not.toContain('id="show-delete-controls"');
      expect(installedPanelHtml).toContain('class="installed-local-tools"');
      expect(installedPanelHtml).toContain("Local uninstall");
      expect(installedPanelHtml).toContain('id="show-delete-controls"');
      expect(html).toContain("Show uninstall");
      expect(html).toContain("toggleDeleteControls(");
      expect(html).toContain("showDeleteControls: false");
      expect(html).toContain("delete-local-skill");
      expect(html).toContain('id="delete-skill-dialog"');
      expect(html).toContain("Uninstall skill");
      expect(html).toContain("This will not remove the skill from Backup.");
      expect(html).toContain("openDeleteSkillConfirm(");
      expect(html).toContain("deleteLocalSkill(");
      expect(html).toContain('fetch("/api/skills", {');
      expect(html).toContain('method: "DELETE"');
      expect(html).toContain("<th>Backup</th>");
      expect(html).toContain("<th>Uninstall</th>");
      expect(html).not.toContain("<th>Actions</th>");
    });
  });

  test("matches saved backup entries to installed skill rows", async () => {
    const root = await makeTempRoot();

    await withServer([root], async (baseUrl) => {
      const response = await fetch(baseUrl);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain('return (skill.type || "skill") + ":" + skill.id;');
    });
  });

  test("does not render descriptions inside saved skills rows", async () => {
    const root = await makeTempRoot();

    await withServer([root], async (baseUrl) => {
      const response = await fetch(baseUrl);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).not.toContain("renderStackSkillDetail(");
      expect(html).not.toContain("renderSourceLabel(");
    });
  });

  test("does not show local install paths in saved skills rows", async () => {
    const root = await makeTempRoot();

    await withServer([root], async (baseUrl) => {
      const response = await fetch(baseUrl);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain("<thead><tr><th>Name</th><th>Status</th><th>Restore source</th><th>Location</th><th></th></tr></thead>");
      expect(html).not.toContain("<thead><tr><th>Name</th><th>Status</th><th>Restore source</th><th>Location</th><th>Install path</th><th></th></tr></thead>");
      expect(html).not.toContain("renderCurrentInstallPath(");
    });
  });

  test("serves restore preview and restore controls", async () => {
    const root = await makeTempRoot();

    await withServer([root], async (baseUrl) => {
      const response = await fetch(baseUrl);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain("Restore Preview");
      expect(html).toContain("restore-preview");
      expect(html).toContain("restore-preview-summary");
      expect(html).toContain("restore-results");
      expect(html).toContain("start-restore");
      expect(html).toContain("Start restore");
      expect(html).toContain("copy-install-script");
      expect(html).toContain("Advanced option");
      expect(html).toContain("renderRestorePreview(");
      expect(html).toContain("buildInstallScript(");
      expect(html).toContain("copyTextWithFallback(");
      expect(html).toContain("startRestore(");
      expect(html).toContain("retryRestore(");
      expect(html).toContain("saveManualInstallCommand(");
      expect(html).not.toContain("<h3 id=\"install-plan-heading\">Copy install script</h3>");
    });
  });

  test("serves diagnostics controls inside the restore view", async () => {
    const root = await makeTempRoot();

    await withServer([root], async (baseUrl) => {
      const response = await fetch(baseUrl);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain("Diagnostics");
      expect(html).toContain('id="diagnostics-panel"');
      expect(html).toContain('id="diagnostics-summary"');
      expect(html).toContain('id="diagnostics-list"');
      expect(html).toContain('id="run-diagnostics"');
      expect(html).toContain("renderDiagnostics(");
      expect(html).toContain("runDiagnostics(");
      expect(html).toContain('fetch("/api/diagnostics")');
    });
  });

  test("serves backup file path and missing-file prompt UI", async () => {
    const root = await makeTempRoot();

    await withServer([root], async (baseUrl) => {
      const response = await fetch(baseUrl);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain("Current backup file");
      expect(html).toContain("stack-file-path");
      expect(html).toContain("create-stack");
      expect(html).toContain("choose-stack-file");
      expect(html).toContain("Choose backup file");
      expect(html).toContain("manual-stack-path");
      expect(html).toContain("reveal-stack-file");
      expect(html).toContain("Show file");
      expect(html).toContain("copy-stack-path");
      expect(html).toContain("Copy path");
      expect(html).toContain("stack-path-input");
      expect(html).toContain("revealStackFileLocation(");
      expect(html).toContain("copyStackFilePath(");
      expect(html).toContain("/api/stack/reveal");
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

  test("serves diagnostics for restore prerequisites", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, ".agentdock", "stack.json");
    await mkdir(join(root, ".agentdock"), { recursive: true });
    await writeFile(stackPath, JSON.stringify({ schemaVersion: 1, skills: [] }), "utf8");

    await withServer(
      [root],
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/diagnostics`);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.summary).toEqual({
          ok: 8,
          warning: 0,
          error: 0
        });
        expect(payload.checks.map((check: { id: string }) => check.id)).toContain("runtime.npx");
        expect(payload.checks.map((check: { id: string }) => check.id)).toContain("stack.file");
      },
      {
        stackPath,
        diagnostics: {
          nodeVersion: "v20.0.0",
          commandRunner: async (command) => ({
            exitCode: 0,
            stdout: command === "git" ? "git version 2.0.0" : "10.0.0",
            stderr: ""
          }),
          fetcher: async () => ({
            ok: true,
            status: 200
          }),
          pathExists: async () => true,
          canWritePath: async () => true
        }
      }
    );
  });

  test("exports the current backup as a profile", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, ".agentdock", "stack.json");

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

        const response = await fetch(`${baseUrl}/api/profile/export`);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.fileName).toBe("agentdock-profile.json");
        expect(payload.profile).toMatchObject({
          schemaVersion: 1,
          agentdockVersion: "0.1.0",
          stack
        });
        expect(typeof payload.profile.exportedAt).toBe("string");
      },
      { stackPath }
    );
  });

  test("previews profile imports against the current backup", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, ".agentdock", "stack.json");
    const profile = {
      schemaVersion: 1,
      exportedAt: "2026-05-26T00:00:00.000Z",
      agentdockVersion: "0.1.0",
      stack: {
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
            id: "new-skill",
            type: "skill",
            source: {
              type: "command",
              install: "npx skills add owner/repo --skill new-skill"
            },
            desiredState: "enabled"
          }
        ]
      }
    };

    await withServer(
      [root],
      async (baseUrl) => {
        await fetch(`${baseUrl}/api/stack/create`, { method: "POST" });
        await writeFile(
          stackPath,
          JSON.stringify(
            {
              schemaVersion: 1,
              skills: [profile.stack.skills[0]]
            },
            null,
            2
          ),
          "utf8"
        );

        const response = await fetch(`${baseUrl}/api/profile/import/preview`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ profile })
        });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.preview.summary).toEqual({
          new: 1,
          existing: 1,
          updated: 0,
          invalid: 0
        });
      },
      { stackPath }
    );
  });

  test("applies valid profile imports into the current backup", async () => {
    const root = await makeTempRoot();
    const stackPath = join(root, ".agentdock", "stack.json");
    const profile = {
      schemaVersion: 1,
      exportedAt: "2026-05-26T00:00:00.000Z",
      agentdockVersion: "0.1.0",
      stack: {
        schemaVersion: 1,
        skills: [
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
        ]
      }
    };

    await withServer(
      [root],
      async (baseUrl) => {
        await fetch(`${baseUrl}/api/stack/create`, { method: "POST" });

        const response = await fetch(`${baseUrl}/api/profile/import/apply`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ profile: JSON.stringify(profile) })
        });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.preview.summary.new).toBe(1);
        expect(payload.stack.skills.map((skill: { id: string }) => skill.id)).toEqual(["new-skill"]);

        const file = JSON.parse(await readFile(stackPath, "utf8"));
        expect(file.skills.map((skill: { id: string }) => skill.id)).toEqual(["new-skill"]);
      },
      { stackPath }
    );
  });
});
