# Skills Backup Restore Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the beginner-friendly Skills backup and restore MVP: backup wording, restore preview, one-click restore execution, manual install-command repair, failure messages, and retry.

**Architecture:** Keep the existing stack JSON as the persistence model, add a focused restore executor in `src/core`, expose restore and source-repair endpoints from the existing HTTP server, and update the single-page UI to present the flow as backup and restore. The executor owns planning, command parsing, command safety, and result normalization so the server and UI stay thin.

**Tech Stack:** TypeScript, Node.js `child_process.execFile`, built-in HTTP server, Vitest, current inline HTML/CSS/JS renderer in `src/ui/page.ts`.

---

## File Structure

- Create `src/core/skillRestoreExecutor.ts`
  - Builds restore plans.
  - Parses supported `npx skills add ...` commands into argv.
  - Executes restore commands serially with a per-skill timeout.
  - Normalizes success, failed, and skipped results.
- Create `tests/core/skillRestoreExecutor.test.ts`
  - Covers restore planning, command generation, manual command validation, injection rejection, skipped items, success, failure, and timeout.
- Modify `src/core/stackStore.ts`
  - Adds `updateSkillSourceInStack` for saving a validated manual command source.
- Modify `tests/core/stackStore.test.ts`
  - Covers manual source update and missing skill behavior.
- Modify `src/server/server.ts`
  - Adds restore plan, restore apply, and manual source APIs.
  - Adds dependency injection for restore execution in server tests.
- Modify `tests/server/server.test.ts`
  - Covers restore plan/apply/source APIs and updated backup/restore UI strings.
- Modify `src/ui/page.ts`
  - Rewords stack/install-plan UI to backup/restore.
  - Adds start restore, restore result rendering, retry, and manual command repair form.
- Modify `README.md`
  - Documents the backup/restore workflow and advanced install script fallback.

## Task 1: Core Restore Planning and Command Execution

**Files:**
- Create: `src/core/skillRestoreExecutor.ts`
- Create: `tests/core/skillRestoreExecutor.test.ts`

- [ ] **Step 1: Write the failing core tests**

Create `tests/core/skillRestoreExecutor.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  buildRestorePlan,
  parseInstallCommand,
  restoreMissingSkills,
  type RestoreCommandRunner
} from "../../src/core/skillRestoreExecutor.js";
import type { InstalledSkill } from "../../src/core/skillScanner.js";
import type { AgentDockStack } from "../../src/core/stackStore.js";

function makeInstalledSkill(id: string): InstalledSkill {
  const root = "/Users/example/.agents/skills";
  return {
    id,
    name: id,
    description: `${id} description`,
    installPath: `${root}/${id}`,
    manifestPath: `${root}/${id}/SKILL.md`,
    sourceRoot: root,
    location: {
      kind: "personal",
      label: "Personal",
      root
    }
  };
}

function makeStack(): AgentDockStack {
  return {
    schemaVersion: 1,
    skills: [
      {
        id: "already-here",
        type: "skill",
        source: {
          type: "skills.sh",
          package: "example/skills",
          skill: "already-here"
        },
        desiredState: "enabled"
      },
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
        id: "manual-skill",
        type: "skill",
        source: {
          type: "command",
          install: "npx skills add owner/repo --skill manual-skill"
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

describe("skillRestoreExecutor", () => {
  test("builds a restore plan from installed skills and stack skills", () => {
    const plan = buildRestorePlan(makeStack(), [makeInstalledSkill("already-here")]);

    expect(plan.alreadyInstalled.map((skill) => skill.id)).toEqual(["already-here"]);
    expect(plan.installable.map((skill) => skill.id)).toEqual(["find-skills", "manual-skill"]);
    expect(plan.needsAttention.map((skill) => skill.id)).toEqual(["local-only"]);
  });

  test("parses supported skills.sh install commands", () => {
    expect(parseInstallCommand("npx skills add https://github.com/owner/repo --skill skill-name")).toEqual({
      command: "npx",
      args: ["skills", "add", "https://github.com/owner/repo", "--skill", "skill-name"],
      display: "npx skills add https://github.com/owner/repo --skill skill-name"
    });

    expect(parseInstallCommand("npx skills add owner/repo --skill skill-name")).toEqual({
      command: "npx",
      args: ["skills", "add", "owner/repo", "--skill", "skill-name"],
      display: "npx skills add owner/repo --skill skill-name"
    });
  });

  test("rejects unsupported install command syntax", () => {
    expect(parseInstallCommand("npx skills add https://github.com/owner/repo --skill skill-name && rm -rf /")).toBeUndefined();
    expect(parseInstallCommand("npx skills add https://github.com/owner/repo --skill skill-name | cat")).toBeUndefined();
    expect(parseInstallCommand("npm install owner/repo")).toBeUndefined();
    expect(parseInstallCommand("npx skills add git@github.com:owner/repo --skill skill-name")).toBeUndefined();
  });

  test("restores installable skills with a runner and skips unsupported skills", async () => {
    const calls: string[] = [];
    const runner: RestoreCommandRunner = async (command, args) => {
      calls.push([command, ...args].join(" "));
      return {
        exitCode: 0,
        stdout: "installed",
        stderr: ""
      };
    };

    const results = await restoreMissingSkills(makeStack(), [makeInstalledSkill("already-here")], {
      runner
    });

    expect(calls).toEqual([
      "npx skills add https://github.com/vercel-labs/skills --skill find-skills",
      "npx skills add owner/repo --skill manual-skill"
    ]);
    expect(results).toEqual([
      {
        id: "already-here",
        status: "skipped",
        message: "Already installed."
      },
      {
        id: "find-skills",
        status: "success",
        message: "Installed successfully.",
        command: "npx skills add https://github.com/vercel-labs/skills --skill find-skills"
      },
      {
        id: "manual-skill",
        status: "success",
        message: "Installed successfully.",
        command: "npx skills add owner/repo --skill manual-skill"
      },
      {
        id: "local-only",
        status: "skipped",
        message: "This skill does not have a restore source yet."
      }
    ]);
  });

  test("supports restoring only selected skill ids", async () => {
    const calls: string[] = [];
    const runner: RestoreCommandRunner = async (command, args) => {
      calls.push([command, ...args].join(" "));
      return {
        exitCode: 0,
        stdout: "installed",
        stderr: ""
      };
    };

    const results = await restoreMissingSkills(makeStack(), [], {
      ids: ["manual-skill"],
      runner
    });

    expect(calls).toEqual(["npx skills add owner/repo --skill manual-skill"]);
    expect(results).toEqual([
      {
        id: "manual-skill",
        status: "success",
        message: "Installed successfully.",
        command: "npx skills add owner/repo --skill manual-skill"
      }
    ]);
  });

  test("normalizes failed restore results", async () => {
    const runner: RestoreCommandRunner = async () => ({
      exitCode: 1,
      stdout: "",
      stderr: "fatal: could not read from remote repository"
    });

    const results = await restoreMissingSkills(
      {
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
      },
      [],
      { runner }
    );

    expect(results).toEqual([
      {
        id: "find-skills",
        status: "failed",
        message: "Could not reach the skill source. Check your network and try again.",
        command: "npx skills add https://github.com/vercel-labs/skills --skill find-skills",
        detail: "fatal: could not read from remote repository"
      }
    ]);
  });

  test("normalizes timeout restore results", async () => {
    const runner: RestoreCommandRunner = async () => ({
      exitCode: null,
      timedOut: true,
      stdout: "",
      stderr: ""
    });

    const results = await restoreMissingSkills(
      {
        schemaVersion: 1,
        skills: [
          {
            id: "slow-skill",
            type: "skill",
            source: {
              type: "skills.sh",
              package: "owner/repo",
              skill: "slow-skill"
            },
            desiredState: "enabled"
          }
        ]
      },
      [],
      { runner }
    );

    expect(results[0]).toMatchObject({
      id: "slow-skill",
      status: "failed",
      message: "This skill took too long to install. You can retry it."
    });
  });
});
```

- [ ] **Step 2: Run the failing core tests**

Run:

```bash
npm test -- tests/core/skillRestoreExecutor.test.ts
```

Expected: fail because `src/core/skillRestoreExecutor.ts` does not exist.

- [ ] **Step 3: Implement the restore executor**

Create `src/core/skillRestoreExecutor.ts`:

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { InstalledSkill } from "./skillScanner.js";
import type { AgentDockStack, StackSkill } from "./stackStore.js";

const execFileAsync = promisify(execFile);
const RESTORE_TIMEOUT_MS = 120_000;
const OUTPUT_LIMIT = 500;

export interface RestorePlan {
  alreadyInstalled: StackSkill[];
  installable: StackSkill[];
  needsAttention: StackSkill[];
}

export interface RestoreCommand {
  command: string;
  args: string[];
  display: string;
}

export interface RestoreRunnerResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
}

export type RestoreCommandRunner = (command: string, args: string[]) => Promise<RestoreRunnerResult>;

export interface RestoreMissingSkillsOptions {
  ids?: string[];
  runner?: RestoreCommandRunner;
}

export interface RestoreSkillResult {
  id: string;
  status: "success" | "failed" | "skipped";
  message: string;
  command?: string;
  detail?: string;
}

export function buildRestorePlan(stack: AgentDockStack, installedSkills: InstalledSkill[]): RestorePlan {
  const installedIds = new Set(installedSkills.map((skill) => skill.id));
  const plan: RestorePlan = {
    alreadyInstalled: [],
    installable: [],
    needsAttention: []
  };

  for (const skill of stack.skills) {
    if (installedIds.has(skill.id)) {
      plan.alreadyInstalled.push(skill);
      continue;
    }

    if (getRestoreCommand(skill)) {
      plan.installable.push(skill);
      continue;
    }

    plan.needsAttention.push(skill);
  }

  return plan;
}

export async function restoreMissingSkills(
  stack: AgentDockStack,
  installedSkills: InstalledSkill[],
  options: RestoreMissingSkillsOptions = {}
): Promise<RestoreSkillResult[]> {
  const selectedIds = options.ids ? new Set(options.ids) : undefined;
  const runner = options.runner ?? runRestoreCommand;
  const plan = buildRestorePlan(stack, installedSkills);
  const results: RestoreSkillResult[] = [];

  for (const skill of stack.skills) {
    if (selectedIds && !selectedIds.has(skill.id)) {
      continue;
    }

    if (plan.alreadyInstalled.some((item) => item.id === skill.id)) {
      results.push({
        id: skill.id,
        status: "skipped",
        message: "Already installed."
      });
      continue;
    }

    const restoreCommand = getRestoreCommand(skill);
    if (!restoreCommand) {
      results.push({
        id: skill.id,
        status: "skipped",
        message: "This skill does not have a restore source yet."
      });
      continue;
    }

    const runnerResult = await runner(restoreCommand.command, restoreCommand.args);
    results.push(toRestoreResult(skill, restoreCommand, runnerResult));
  }

  return results;
}

export function getRestoreCommand(skill: StackSkill): RestoreCommand | undefined {
  const source = skill.source;

  if (source.type === "skills.sh") {
    return parseInstallCommand(`npx skills add https://github.com/${source.package} --skill ${source.skill}`);
  }

  if (source.type === "command") {
    return parseInstallCommand(source.install);
  }

  return undefined;
}

export function parseInstallCommand(command: string): RestoreCommand | undefined {
  const normalized = command.trim().replace(/\s+/g, " ");
  const match = normalized.match(
    /^npx skills add ((?:https:\/\/github\.com\/)?[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+) --skill ([A-Za-z0-9_.:-]+)$/
  );

  if (!match?.[1] || !match[2]) {
    return undefined;
  }

  return {
    command: "npx",
    args: ["skills", "add", match[1], "--skill", match[2]],
    display: `npx skills add ${match[1]} --skill ${match[2]}`
  };
}

async function runRestoreCommand(command: string, args: string[]): Promise<RestoreRunnerResult> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: RESTORE_TIMEOUT_MS,
      maxBuffer: 1024 * 1024
    });

    return {
      exitCode: 0,
      stdout,
      stderr
    };
  } catch (error) {
    const details = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: string | number;
      signal?: string;
      killed?: boolean;
    };

    return {
      exitCode: typeof details.code === "number" ? details.code : null,
      stdout: details.stdout ?? "",
      stderr: details.stderr ?? details.message,
      timedOut: details.killed === true || details.signal === "SIGTERM"
    };
  }
}

function toRestoreResult(
  skill: StackSkill,
  command: RestoreCommand,
  result: RestoreRunnerResult
): RestoreSkillResult {
  if (result.exitCode === 0 && !result.timedOut) {
    return {
      id: skill.id,
      status: "success",
      message: "Installed successfully.",
      command: command.display
    };
  }

  return {
    id: skill.id,
    status: "failed",
    message: restoreFailureMessage(result),
    command: command.display,
    ...(summarizeOutput(result.stderr || result.stdout) ? { detail: summarizeOutput(result.stderr || result.stdout) } : {})
  };
}

function restoreFailureMessage(result: RestoreRunnerResult): string {
  const combined = `${result.stderr}\n${result.stdout}`.toLowerCase();

  if (result.timedOut) {
    return "This skill took too long to install. You can retry it.";
  }

  if (combined.includes("enoent") || combined.includes("not found")) {
    return "Node.js/npm is required before AgentDock can restore skills.";
  }

  if (
    combined.includes("network") ||
    combined.includes("github") ||
    combined.includes("remote repository") ||
    combined.includes("could not resolve host")
  ) {
    return "Could not reach the skill source. Check your network and try again.";
  }

  return "The skill could not be restored. Check the details and try again.";
}

function summarizeOutput(output: string): string {
  return output.replace(/\s+/g, " ").trim().slice(0, OUTPUT_LIMIT);
}
```

- [ ] **Step 4: Run the core tests**

Run:

```bash
npm test -- tests/core/skillRestoreExecutor.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/core/skillRestoreExecutor.ts tests/core/skillRestoreExecutor.test.ts
git commit -m "feat: add skill restore executor"
```

## Task 2: Manual Source Updates in Stack Store

**Files:**
- Modify: `src/core/stackStore.ts`
- Modify: `tests/core/stackStore.test.ts`

- [ ] **Step 1: Add failing stack store tests**

Append these tests inside the existing `describe("stackStore", () => { ... })` block in `tests/core/stackStore.test.ts`:

```ts
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
```

Update the import at the top of `tests/core/stackStore.test.ts`:

```ts
import {
  addSkillToStack,
  createStackFile,
  readStack,
  readStackFileState,
  removeSkillFromStack,
  updateSkillSourceInStack
} from "../../src/core/stackStore.js";
```

- [ ] **Step 2: Run the failing stack store tests**

Run:

```bash
npm test -- tests/core/stackStore.test.ts
```

Expected: fail because `updateSkillSourceInStack` is not exported.

- [ ] **Step 3: Implement `updateSkillSourceInStack`**

Add this exported function after `removeSkillFromStack` in `src/core/stackStore.ts`:

```ts
export async function updateSkillSourceInStack(
  skill: Pick<StackSkill, "id">,
  source: StackSkillSource,
  options: StackStoreOptions = {}
): Promise<AgentDockStack | undefined> {
  const stackPath = options.stackPath ?? getDefaultStackPath();
  const stack = await readStack({ stackPath });
  const existingIndex = stack.skills.findIndex((item) => item.id === skill.id);

  if (existingIndex === -1) {
    return undefined;
  }

  const nextStack: AgentDockStack = {
    schemaVersion: 1,
    skills: stack.skills.map((item, index) =>
      index === existingIndex
        ? {
            ...item,
            source
          }
        : item
    )
  };

  await writeStack(nextStack, stackPath);
  return nextStack;
}
```

- [ ] **Step 4: Run stack store tests**

Run:

```bash
npm test -- tests/core/stackStore.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/core/stackStore.ts tests/core/stackStore.test.ts
git commit -m "feat: allow manual skill restore sources"
```

## Task 3: Restore and Source APIs

**Files:**
- Modify: `src/server/server.ts`
- Modify: `tests/server/server.test.ts`

- [ ] **Step 1: Add failing server API tests**

In `tests/server/server.test.ts`, update imports:

```ts
import type { RestoreCommandRunner } from "../../src/core/skillRestoreExecutor.js";
```

Update the `withServer` options type:

```ts
  options: {
    stackPath?: string;
    configPath?: string;
    chooseStackFile?: () => Promise<{ path?: string; canceled?: boolean }>;
    resolveSkillInstall?: () => Promise<StackSkillInstall>;
    restoreRunner?: RestoreCommandRunner;
  } = {}
```

Pass `restoreRunner` to `createAgentDockServer`:

```ts
    restoreRunner: options.restoreRunner,
```

Add these tests before the existing `"serves the local console HTML"` test:

```ts
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
```

- [ ] **Step 2: Run the failing server tests**

Run:

```bash
npm test -- tests/server/server.test.ts
```

Expected: fail because the restore APIs and server option are not implemented.

- [ ] **Step 3: Implement server APIs**

In `src/server/server.ts`, add imports:

```ts
import {
  buildRestorePlan,
  parseInstallCommand,
  restoreMissingSkills,
  type RestoreCommandRunner
} from "../core/skillRestoreExecutor.js";
```

Add `updateSkillSourceInStack` to the stack store import:

```ts
  updateSkillSourceInStack
```

Add the option:

```ts
  restoreRunner?: RestoreCommandRunner;
```

Add this route after the existing stack skill delete route and before health:

```ts
  if (request.method === "POST" && url.pathname === "/api/restore/skills/plan") {
    const stackPath = await resolveStackPath(options);
    const [stack, skills] = await Promise.all([
      readStack({ stackPath }),
      scanInstalledSkills({ roots: options.skillRoots })
    ]);

    sendJson(response, 200, { plan: buildRestorePlan(stack, skills) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/restore/skills/apply") {
    const body = await readJsonBody(request);
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string") : undefined;
    const stackPath = await resolveStackPath(options);
    const [stack, skills] = await Promise.all([
      readStack({ stackPath }),
      scanInstalledSkills({ roots: options.skillRoots })
    ]);
    const results = await restoreMissingSkills(stack, skills, {
      ids,
      ...(options.restoreRunner ? { runner: options.restoreRunner } : {})
    });

    sendJson(response, 200, { results });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/stack/skills/source") {
    const body = await readJsonBody(request);
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const install = typeof body.install === "string" ? body.install.trim() : "";

    if (!id || !install) {
      sendJson(response, 400, { error: "Skill id and install command are required." });
      return;
    }

    const parsedCommand = parseInstallCommand(install);
    if (!parsedCommand) {
      sendJson(response, 400, { error: "Only npx skills add ... commands are supported right now." });
      return;
    }

    const stackPath = await resolveStackPath(options);
    const stack = await updateSkillSourceInStack(
      { id },
      {
        type: "command",
        install: parsedCommand.display
      },
      { stackPath }
    );

    if (!stack) {
      sendJson(response, 404, { error: "Skill not found in backup" });
      return;
    }

    const stackFile = await readStackFileState({ stackPath });
    sendJson(response, 200, { stack, stackFile });
    return;
  }
```

- [ ] **Step 4: Run server tests**

Run:

```bash
npm test -- tests/server/server.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/server/server.ts tests/server/server.test.ts
git commit -m "feat: add skill restore APIs"
```

## Task 4: Backup and Restore UI

**Files:**
- Modify: `src/ui/page.ts`
- Modify: `tests/server/server.test.ts`

- [ ] **Step 1: Update UI HTML tests to fail on the new wording and controls**

Replace the three UI tests near the end of `tests/server/server.test.ts` with:

```ts
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
      expect(html).toContain("startRestore(");
      expect(html).toContain("retryRestore(");
      expect(html).toContain("saveManualInstallCommand(");
      expect(html).not.toContain("<h3 id=\"install-plan-heading\">Copy install script</h3>");
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
      expect(html).toContain("stack-path-input");
      expect(html).toContain("/api/stack/choose-file");
      expect(html).toContain("/api/stack/path");
      expect(html).not.toContain("Use another path");
      expect(html).not.toContain("AGENTDOCK_STACK_PATH");
    });
  });
```

- [ ] **Step 2: Run the failing UI tests**

Run:

```bash
npm test -- tests/server/server.test.ts
```

Expected: fail because `src/ui/page.ts` still uses My Stack and Install Plan wording.

- [ ] **Step 3: Update static UI text and element ids**

In `src/ui/page.ts`, make these structural changes:

- Keep the existing `stack-file-path`, `stack-count`, `stack-path-form`, and API paths.
- Change visible labels:
  - `Local skill inventory` to `Skills backup and restore`.
  - `saved in My Stack` to `skills in backup`.
  - `Current stack file` to `Current backup file`.
  - `Create stack file` to `Create backup file`.
  - `Choose stack file...` to `Choose backup file...`.
  - `Stack file path` to `Backup file path`.
  - `Installed skills on this machine` to `My Skills`.
  - `Save` to `Add to backup`.
  - `Saved` to `In backup`.
  - `My Stack` section to `Backup Contents`.
  - `Install Plan` section to `Restore Preview`.
  - `Copy install script` heading to `Restore missing skills`.
- Rename the section/list ids and variables where useful:
  - `my-stack-list` to `backup-list`.
  - `install-plan` to `restore-preview`.
  - `install-plan-summary` to `restore-preview-summary`.
  - `install-plan-list` to `restore-preview-list`.
- Keep `install-script` and `copy-install-script` for the advanced fallback.

- [ ] **Step 4: Add restore state and client functions**

In the inline script in `src/ui/page.ts`, extend state:

```js
const state = {
  skills: [],
  stack: { skills: [] },
  stackFile: { path: "", exists: false },
  restoreResults: []
};
```

Add `restoreResults` and `startRestoreButton` element bindings:

```js
const restoreResults = document.querySelector("#restore-results");
const startRestoreButton = document.querySelector("#start-restore");
```

Rename `renderMyStack` to `renderBackupContents` and `renderInstallPlan` to `renderRestorePreview`. The restore preview should use the same group logic as the old install plan:

```js
function renderRestorePreview(installed) {
  const plan = getRestorePlan(installed);
  const script = buildInstallScript(plan);

  restorePreviewSummary.textContent =
    plan.alreadyInstalled.length + " installed / " +
    plan.installable.length + " restorable / " +
    plan.needsAttention.length + " needs attention";

  restorePreviewList.innerHTML = [
    renderPlanStat(plan.alreadyInstalled.length, "Installed"),
    renderPlanStat(plan.installable.length, "Restorable"),
    renderPlanStat(plan.needsAttention.length, "Needs attention")
  ].join("");

  installScript.value = script || "# No missing restorable skills.";
  copyInstallScript.disabled = !script;
  startRestoreButton.disabled = plan.installable.length === 0;
  renderRestoreResults();
}
```

Implement `startRestore`, `retryRestore`, `renderRestoreResults`, and `saveManualInstallCommand`:

```js
async function startRestore(ids) {
  const plan = getRestorePlan(new Set(state.skills.map(installedSkillKey)));
  const restoreIds = Array.isArray(ids) ? ids : plan.installable.map((skill) => skill.id);
  if (restoreIds.length === 0) return;

  startRestoreButton.disabled = true;
  statusLine.textContent = "Restoring skills...";

  const response = await fetch("/api/restore/skills/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids: restoreIds })
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    statusLine.textContent = payload.error || "Could not restore skills";
    startRestoreButton.disabled = false;
    return;
  }

  state.restoreResults = payload.results || [];
  statusLine.textContent = "Restore finished";
  await loadSkills();
}

async function retryRestore(id) {
  await startRestore([id]);
}

function renderRestoreResults() {
  if (!state.restoreResults.length) {
    restoreResults.innerHTML = "";
    return;
  }

  const successes = state.restoreResults.filter((result) => result.status === "success").length;
  const failures = state.restoreResults.filter((result) => result.status === "failed").length;

  restoreResults.innerHTML = [
    '<div class="restore-results-summary">' + escapeHtml(successes) + " restored / " + escapeHtml(failures) + " failed</div>",
    '<div class="table-wrap"><table><thead><tr><th>Skill</th><th>Status</th><th>Message</th><th></th></tr></thead><tbody>',
    ...state.restoreResults.map((result) => [
      '<tr>',
      '<td><div class="skill-name">' + escapeHtml(result.id) + '</div></td>',
      '<td>' + escapeHtml(result.status) + '</td>',
      '<td><span class="desc-preview">' + escapeHtml(result.message || "") + '</span>' + (result.detail ? '<div class="desc">' + escapeHtml(result.detail) + '</div>' : "") + '</td>',
      '<td>' + (result.status === "failed" ? '<button class="retry-restore" type="button" data-id="' + escapeHtml(result.id) + '">Retry</button>' : "") + '</td>',
      '</tr>'
    ].join("")),
    '</tbody></table></div>'
  ].join("");
}

async function saveManualInstallCommand(id, install) {
  const command = String(install || "").trim();
  if (!command) {
    statusLine.textContent = "Enter an install command";
    return;
  }

  const response = await fetch("/api/stack/skills/source", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, install: command })
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    statusLine.textContent = payload.error || "Could not save install command";
    return;
  }

  state.stack = payload.stack || state.stack;
  state.stackFile = payload.stackFile || state.stackFile;
  statusLine.textContent = "Install command saved";
  render();
}
```

Render needs-attention rows in the backup contents table with a form:

```js
function renderManualCommandForm(skill) {
  const source = skill.source || { type: "unknown" };
  if (source.type !== "unknown") {
    return "";
  }

  return [
    '<form class="manual-command-form" data-id="' + escapeHtml(skill.id) + '">',
    '<input class="manual-command-input" type="text" autocomplete="off" placeholder="npx skills add https://github.com/owner/repo --skill ' + escapeHtml(skill.id) + '" />',
    '<button class="button secondary" type="submit">Save and add to restore</button>',
    '</form>'
  ].join("");
}
```

Update click and submit event handlers:

```js
startRestoreButton.addEventListener("click", () => startRestore());

document.addEventListener("click", (event) => {
  const retryButton = event.target.closest(".retry-restore");
  if (retryButton) {
    retryRestore(retryButton.dataset.id);
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest(".manual-command-form");
  if (!form) return;
  event.preventDefault();
  const input = form.querySelector(".manual-command-input");
  saveManualInstallCommand(form.dataset.id, input.value);
});
```

- [ ] **Step 5: Run UI/server tests**

Run:

```bash
npm test -- tests/server/server.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit Task 4**

```bash
git add src/ui/page.ts tests/server/server.test.ts
git commit -m "feat: add backup restore UI"
```

## Task 5: README Workflow Update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README to describe the new workflow**

In `README.md`, update the MVP feature list so it includes:

```markdown
- 将已安装 skill 加入备份文件。
- 在备份内容中查看当前机器上是 `Installed` 还是 `Missing`。
- 根据备份文件生成 `Restore Preview`，区分已安装、可恢复和需要处理的 skills。
- 在界面中点击 `Start restore` 恢复可安装的缺失 skills。
- 对缺少安装来源的 skill 手动补充 `npx skills add ...` 安装命令。
- 保留 `Copy install script` 作为高级备用入口。
```

Replace the migration paragraph with:

```markdown
换电脑时，旧机器先把想长期保留的 skills 加入备份文件。新机器运行 AgentDock 后，在主界面点击 `Choose backup file...` 选择这个 JSON 文件。`Restore Preview` 会自动分成已安装、可恢复和需要处理三类；点击 `Start restore` 后，AgentDock 会在本机执行可恢复 skills 的安装命令。缺少安装来源的 skill 可以点击 `Save and add to restore` 手动补充 `npx skills add ...` 命令。`Copy install script` 仍作为高级备用方式保留。
```

- [ ] **Step 2: Run docs-adjacent verification**

Run:

```bash
npm test -- tests/server/server.test.ts
```

Expected: pass; this confirms README wording changes did not require UI test changes.

- [ ] **Step 3: Commit Task 5**

```bash
git add README.md
git commit -m "docs: document backup restore workflow"
```

## Task 6: Full Verification and Build

**Files:**
- No new files.

- [ ] **Step 1: Run the complete test suite**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run the TypeScript build**

Run:

```bash
npm run build
```

Expected: TypeScript build completes without errors.

- [ ] **Step 3: Smoke run the local app**

Run:

```bash
npm run dev -- --no-open --port 3790
```

Expected: terminal prints `AgentDock is running at http://127.0.0.1:3790`.

Open `http://127.0.0.1:3790` in the Codex in-app browser and verify the first screen shows:

- `My Skills`
- `Backup Contents`
- `Restore Preview`
- `Start restore`
- `Choose backup file`

Stop the dev server after the smoke check.

- [ ] **Step 4: Commit final verification notes if code changed during smoke fixes**

If smoke verification requires a code fix, commit only the fix files:

```bash
git add src/core/skillRestoreExecutor.ts src/core/stackStore.ts src/server/server.ts src/ui/page.ts tests/core/skillRestoreExecutor.test.ts tests/core/stackStore.test.ts tests/server/server.test.ts README.md
git commit -m "fix: polish backup restore smoke issues"
```

If no code changed during smoke verification, do not create an empty commit.

## Self-Review Checklist

- Spec goal "backup/restore wording" is covered by Task 4 and Task 5.
- Spec goal "restore preview" is covered by Task 1, Task 3, and Task 4.
- Spec goal "one-click restore" is covered by Task 1, Task 3, and Task 4.
- Spec goal "manual install command repair" is covered by Task 2, Task 3, and Task 4.
- Spec goal "failure messages and retry" is covered by Task 1 and Task 4.
- Command safety is covered by Task 1 tests and `parseInstallCommand`.
- Server API coverage is included in Task 3.
- README coverage is included in Task 5.
- Full verification is included in Task 6.
