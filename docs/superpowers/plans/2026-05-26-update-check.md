# Update Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read-only update checks for backed-up skills, with conservative status reporting and refresh command suggestions.

**Architecture:** Create a focused core update checker that combines the backup stack, installed scan results, restore command generation, and an optional injected probe. The server exposes this through `POST /api/check-updates`, and the Backup UI renders a small panel for on-demand checks.

**Tech Stack:** TypeScript, Node HTTP server, Vitest, existing inline UI renderer in `src/ui/page.ts`.

---

### Task 1: Core Update Checker

**Files:**
- Create: `src/core/updateChecker.ts`
- Test: `tests/core/updateChecker.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests for:

```ts
import { describe, expect, test } from "vitest";
import { checkSkillUpdates } from "../../src/core/updateChecker.js";
import type { AgentDockStack } from "../../src/core/stackStore.js";

const stack: AgentDockStack = {
  schemaVersion: 1,
  skills: [
    { id: "installed-skill", type: "skill", desiredState: "enabled", source: { type: "skills.sh", package: "owner/repo", skill: "installed-skill" } },
    { id: "missing-skill", type: "skill", desiredState: "enabled", source: { type: "command", install: "npx skills add owner/repo --skill missing-skill" } },
    { id: "local-only", type: "skill", desiredState: "enabled", source: { type: "unknown" } }
  ]
};

test("reports conservative default update states", async () => {
  const result = await checkSkillUpdates(stack, [
    { id: "installed-skill", name: "Installed Skill", description: "", installPath: "/tmp/installed-skill", sourceRoot: "/tmp" }
  ]);

  expect(result.summary).toEqual({
    update_available: 0,
    up_to_date: 0,
    unknown: 1,
    not_installed: 1,
    needs_source: 1
  });
});

test("uses an injected probe when version data is available", async () => {
  const result = await checkSkillUpdates(stack, [], {
    probe: async (skill) =>
      skill.id === "installed-skill"
        ? { status: "update_available", currentVersion: "abc", latestVersion: "def", message: "New revision available." }
        : undefined
  });

  expect(result.items.find((item) => item.id === "installed-skill")).toMatchObject({
    status: "update_available",
    currentVersion: "abc",
    latestVersion: "def"
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- tests/core/updateChecker.test.ts`

Expected: fail because `src/core/updateChecker.ts` does not exist.

- [ ] **Step 3: Implement core checker**

Implement `UpdateCheckStatus`, `UpdateCheckItem`, `UpdateCheckResult`, `SkillUpdateProbe`, and `checkSkillUpdates`.

- [ ] **Step 4: Verify core tests pass**

Run: `npm test -- tests/core/updateChecker.test.ts`

Expected: pass.

### Task 2: Server Endpoint

**Files:**
- Modify: `src/server/server.ts`
- Modify: `tests/server/server.test.ts`

- [ ] **Step 1: Write failing server tests**

Add a test that posts to `/api/check-updates`, verifies summary counts, verifies a refresh command is returned, and verifies the stack file content is unchanged.

- [ ] **Step 2: Verify server test fails**

Run: `npm test -- tests/server/server.test.ts`

Expected: fail with `404` for `/api/check-updates`.

- [ ] **Step 3: Add endpoint and option wiring**

Import `checkSkillUpdates`, add an optional `updateProbe` to `AgentDockServerOptions`, scan skills and read stack, then return `{ updates }`.

- [ ] **Step 4: Verify server tests pass**

Run: `npm test -- tests/server/server.test.ts`

Expected: pass.

### Task 3: Backup UI

**Files:**
- Modify: `src/ui/page.ts`
- Modify: `tests/server/server.test.ts`

- [ ] **Step 1: Write failing HTML test**

Assert the served HTML contains:

- `Update Check`
- `id="check-updates"`
- `id="update-results"`
- `checkUpdates(`
- `fetch("/api/check-updates"`

- [ ] **Step 2: Verify HTML test fails**

Run: `npm test -- tests/server/server.test.ts`

Expected: fail because the UI does not contain the new controls.

- [ ] **Step 3: Implement UI state and rendering**

Add `state.updates`, Backup panel markup, `checkUpdates`, `renderUpdateResults`, and status helpers.

- [ ] **Step 4: Verify HTML test passes**

Run: `npm test -- tests/server/server.test.ts`

Expected: pass.

### Task 4: README and Full Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document update checks**

Add a short section describing the Backup view update check, conservative status semantics, and suggested refresh commands.

- [ ] **Step 2: Run full tests and build**

Run:

```bash
npm test
npm run build
```

Expected: both pass.

- [ ] **Step 3: Browser smoke test**

Start the local dev server with `npm run dev -- --no-open --port 3790`, open `http://127.0.0.1:3790`, verify the Backup view shows the Update Check panel, and click `Check updates`.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-05-26-update-check-design.md docs/superpowers/plans/2026-05-26-update-check.md src/core/updateChecker.ts src/server/server.ts src/ui/page.ts tests/core/updateChecker.test.ts tests/server/server.test.ts README.md
git commit -m "feat: add skill update check"
```
