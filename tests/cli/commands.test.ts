import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import {
  parseCliArgs,
  runDiagnosticsCommand,
  runProfileExportCommand,
  runProfileImportCommand
} from "../../src/cli/commands.js";
import type { DiagnosticCheck } from "../../src/core/diagnostics.js";
import type { AgentDockStack } from "../../src/core/stackStore.js";

const tempRoots: string[] = [];

async function makeTempRoot() {
  const root = await mkdtemp(join(tmpdir(), "agentdock-cli-"));
  tempRoots.push(root);
  return root;
}

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
      }
    ]
  };
}

function makeDiagnosticChecks(status: DiagnosticCheck["status"] = "ok"): DiagnosticCheck[] {
  return [
    {
      id: "runtime.node",
      label: "Node.js",
      status,
      message: status === "ok" ? "Node.js is available." : "Node.js failed."
    }
  ];
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("CLI commands", () => {
  test("prints diagnostics and exits zero when checks have no errors", async () => {
    const result = await runDiagnosticsCommand({
      runDiagnostics: async () => makeDiagnosticChecks("ok")
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Diagnostics: 1 ok / 0 warnings / 0 errors");
    expect(result.stdout).toContain("ok");
    expect(result.stdout).toContain("Node.js");
  });

  test("prints diagnostics and exits one when any check is an error", async () => {
    const result = await runDiagnosticsCommand({
      runDiagnostics: async () => makeDiagnosticChecks("error")
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("Diagnostics: 0 ok / 0 warnings / 1 errors");
    expect(result.stdout).toContain("error");
  });

  test("exports a profile to stdout", async () => {
    const result = await runProfileExportCommand({
      readStack: async () => makeStack(),
      now: "2026-05-26T00:00:00.000Z",
      agentdockVersion: "0.1.0"
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      schemaVersion: 1,
      exportedAt: "2026-05-26T00:00:00.000Z",
      agentdockVersion: "0.1.0",
      stack: makeStack()
    });
  });

  test("exports a profile to a file", async () => {
    const root = await makeTempRoot();
    const outputPath = join(root, "agentdock-profile.json");

    const result = await runProfileExportCommand({
      outputPath,
      readStack: async () => makeStack(),
      now: "2026-05-26T00:00:00.000Z",
      agentdockVersion: "0.1.0"
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Profile exported to");
    expect(JSON.parse(await readFile(outputPath, "utf8"))).toMatchObject({
      schemaVersion: 1,
      stack: makeStack()
    });
  });

  test("imports a profile file into the active stack", async () => {
    const root = await makeTempRoot();
    const profilePath = join(root, "profile.json");
    const stackPath = join(root, "stack.json");
    const exported = await runProfileExportCommand({
      readStack: async () => makeStack(),
      now: "2026-05-26T00:00:00.000Z",
      agentdockVersion: "0.1.0"
    });
    await import("node:fs/promises").then((fs) => fs.writeFile(profilePath, exported.stdout, "utf8"));

    const result = await runProfileImportCommand({
      profilePath,
      stackPath,
      readStack: async () => ({ schemaVersion: 1, skills: [] })
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Profile import: 1 to import / 0 unchanged / 0 invalid");
    expect(JSON.parse(await readFile(stackPath, "utf8")).skills.map((skill: { id: string }) => skill.id)).toEqual([
      "find-skills"
    ]);
  });

  test("parses diagnostics and profile command arguments", () => {
    expect(parseCliArgs(["diagnostics", "--skill-root", "/tmp/skills"])).toMatchObject({
      command: "diagnostics",
      skillRoots: ["/tmp/skills"]
    });
    expect(parseCliArgs(["profile", "export", "--output", "agentdock-profile.json"])).toMatchObject({
      command: "profile-export",
      profileOutputPath: "agentdock-profile.json"
    });
    expect(parseCliArgs(["profile", "import", "agentdock-profile.json"])).toMatchObject({
      command: "profile-import",
      profileInputPath: "agentdock-profile.json"
    });
  });
});
