import { describe, expect, test } from "vitest";
import { join } from "node:path";
import { runDiagnostics, summarizeDiagnostics, type DiagnosticCheck } from "../../src/core/diagnostics.js";

function makeOkOptions(overrides: Parameters<typeof runDiagnostics>[0] = {}): Parameters<typeof runDiagnostics>[0] {
  const stackPath = "/tmp/agentdock/stack.json";
  const skillRoot = "/tmp/agentdock/skills";

  return {
    stackPath,
    skillRoots: [skillRoot],
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
    pathExists: async (path) => path === stackPath || path === skillRoot,
    canWritePath: async (path) => path === stackPath || path === skillRoot,
    ...overrides
  };
}

function byId(checks: DiagnosticCheck[]): Map<string, DiagnosticCheck> {
  return new Map(checks.map((check) => [check.id, check]));
}

describe("diagnostics", () => {
  test("reports ok checks when restore prerequisites are available", async () => {
    const checks = await runDiagnostics(makeOkOptions());
    const indexed = byId(checks);

    expect([...indexed.keys()]).toEqual([
      "runtime.node",
      "runtime.npm",
      "runtime.npx",
      "tools.git",
      "network.github",
      "network.skillsSh",
      "stack.file",
      "skills.roots"
    ]);
    expect(summarizeDiagnostics(checks)).toEqual({
      ok: 8,
      warning: 0,
      error: 0
    });
    expect(indexed.get("runtime.node")).toMatchObject({
      status: "ok",
      message: "Node.js is available."
    });
    expect(indexed.get("stack.file")).toMatchObject({
      status: "ok",
      message: "Backup file is readable and writable."
    });
  });

  test("reports missing npm and npx as errors and missing git as a warning", async () => {
    const checks = await runDiagnostics(
      makeOkOptions({
        commandRunner: async (command) => ({
          exitCode: command === "git" ? 127 : 1,
          stdout: "",
          stderr: command + " not found"
        })
      })
    );
    const indexed = byId(checks);

    expect(indexed.get("runtime.npm")).toMatchObject({
      status: "error",
      message: "npm is required before AgentDock can restore skills."
    });
    expect(indexed.get("runtime.npx")).toMatchObject({
      status: "error",
      message: "npx is required before AgentDock can restore skills."
    });
    expect(indexed.get("tools.git")).toMatchObject({
      status: "warning",
      message: "git was not found. Some skill installs may fail."
    });
  });

  test("reports network failures as warnings", async () => {
    const checks = await runDiagnostics(
      makeOkOptions({
        fetcher: async () => {
          throw new Error("network down");
        }
      })
    );
    const indexed = byId(checks);

    expect(indexed.get("network.github")).toMatchObject({
      status: "warning",
      message: "Could not reach GitHub. Check your network before restoring skills."
    });
    expect(indexed.get("network.skillsSh")).toMatchObject({
      status: "warning",
      message: "Could not reach skills.sh. Automatic restore-source lookup may be unavailable."
    });
  });

  test("reports a missing backup file as a warning", async () => {
    const missingStackPath = join("/tmp", "missing-agentdock-stack.json");
    const checks = await runDiagnostics(
      makeOkOptions({
        stackPath: missingStackPath,
        pathExists: async (path) => path !== missingStackPath,
        canWritePath: async () => true
      })
    );

    expect(byId(checks).get("stack.file")).toMatchObject({
      status: "warning",
      message: "Backup file does not exist yet. Create it before restoring on another machine."
    });
  });

  test("reports existing skill roots that are not writable", async () => {
    const checks = await runDiagnostics(
      makeOkOptions({
        skillRoots: ["/tmp/agentdock/readonly-skills"],
        pathExists: async () => true,
        canWritePath: async (path) => !path.includes("readonly-skills")
      })
    );

    expect(byId(checks).get("skills.roots")).toMatchObject({
      status: "error",
      message: "Skill roots exist, but none are writable."
    });
  });
});
