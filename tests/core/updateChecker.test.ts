import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { InstalledSkill } from "../../src/core/skillScanner.js";
import type { AgentDockStack } from "../../src/core/stackStore.js";
import { checkSkillUpdates, createGitHubSkillUpdateProbe } from "../../src/core/updateChecker.js";

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

async function writeInstalledSkill(root: string, id: string, content: string): Promise<InstalledSkill> {
  const installPath = join(root, id);
  const manifestPath = join(installPath, "SKILL.md");
  await mkdir(installPath, { recursive: true });
  await writeFile(manifestPath, content, "utf8");

  return {
    id,
    name: id,
    description: "",
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

function gitBlobSha(content: string): string {
  const bytes = Buffer.from(content);
  return createHash("sha1")
    .update(Buffer.from(`blob ${bytes.length}\0`))
    .update(bytes)
    .digest("hex");
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body
  } as Response;
}

function errorResponse(status: number, statusText: string, body: unknown): Response {
  return {
    ok: false,
    status,
    statusText,
    json: async () => body
  } as Response;
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

  test("uses a GitHub probe to compare local skill files with the remote tree", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentdock-update-check-"));
    const matchingContent = "---\nname: matching-skill\n---\n";
    const staleContent = "---\nname: stale-skill\n---\nold\n";

    try {
      const stack: AgentDockStack = {
        schemaVersion: 1,
        skills: [
          {
            id: "matching-skill",
            type: "skill",
            desiredState: "enabled",
            source: { type: "skills.sh", package: "owner/repo", skill: "matching-skill" }
          },
          {
            id: "stale-skill",
            type: "skill",
            desiredState: "enabled",
            source: { type: "skills.sh", package: "owner/repo", skill: "stale-skill" }
          }
        ]
      };
      const installedSkills = [
        await writeInstalledSkill(root, "matching-skill", matchingContent),
        await writeInstalledSkill(root, "stale-skill", staleContent)
      ];
      const requestedUrls: string[] = [];
      const requestedHeaders: Array<Record<string, string> | undefined> = [];
      const probe = createGitHubSkillUpdateProbe({
        githubToken: "test-token",
        fetch: async (url, init) => {
          requestedUrls.push(String(url));
          requestedHeaders.push(init?.headers);
          return jsonResponse({
            truncated: false,
            tree: [
              {
                path: "skills/matching-skill/SKILL.md",
                type: "blob",
                sha: gitBlobSha(matchingContent)
              },
              {
                path: "skills/stale-skill/SKILL.md",
                type: "blob",
                sha: gitBlobSha("---\nname: stale-skill\n---\nnew\n")
              }
            ]
          });
        }
      });

      const result = await checkSkillUpdates(stack, installedSkills, { probe });

      expect(requestedUrls).toEqual(["https://api.github.com/repos/owner/repo/git/trees/HEAD?recursive=1"]);
      expect(requestedHeaders[0]).toMatchObject({ authorization: "Bearer test-token" });
      expect(result.summary).toEqual({
        update_available: 1,
        up_to_date: 1,
        unknown: 0,
        not_installed: 0,
        needs_source: 0
      });
      expect(result.items).toEqual([
        expect.objectContaining({
          id: "matching-skill",
          status: "up_to_date",
          message: "Local files match the GitHub source."
        }),
        expect.objectContaining({
          id: "stale-skill",
          status: "update_available",
          message: "Remote skill files differ from the local install."
        })
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("reports GitHub probe HTTP failures as unknown instead of an empty tree", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentdock-update-check-"));

    try {
      const stack: AgentDockStack = {
        schemaVersion: 1,
        skills: [
          {
            id: "rate-limited-skill",
            type: "skill",
            desiredState: "enabled",
            source: { type: "skills.sh", package: "owner/repo", skill: "rate-limited-skill" }
          }
        ]
      };
      const probe = createGitHubSkillUpdateProbe({
        fetch: async () =>
          errorResponse(403, "Forbidden", {
            message: "API rate limit exceeded"
          })
      });

      const result = await checkSkillUpdates(stack, [await writeInstalledSkill(root, "rate-limited-skill", "x")], {
        probe
      });

      expect(result.summary).toEqual({
        update_available: 0,
        up_to_date: 0,
        unknown: 1,
        not_installed: 0,
        needs_source: 0
      });
      expect(result.items[0]).toMatchObject({
        status: "unknown",
        message:
          "Could not check GitHub source: GitHub API rate limit exceeded. Set GITHUB_TOKEN or try again later."
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
