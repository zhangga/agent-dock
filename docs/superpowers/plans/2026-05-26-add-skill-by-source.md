# Add Skill by Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users paste a supported install command or GitHub skill URL into Backup and save a restorable skill that is not installed locally.

**Architecture:** Reuse `src/core/skillRestoreExecutor.ts` as the only parser for restore-source input, add a focused stack-store upsert for already-formed `StackSkill` records, expose a small server endpoint, and add a compact Backup view form. Restore Preview and Profile Sync continue to consume the existing stack schema.

**Tech Stack:** TypeScript, Node HTTP server, Vitest, single-file HTML/CSS/JS UI in `src/ui/page.ts`.

---

## File Structure

- Modify `src/core/skillRestoreExecutor.ts`
  - Add `stackSkillFromInstallInput(input)` to normalize user input and infer a `StackSkill`.
  - Keep `normalizeInstallInput` as the parser source of truth.
- Modify `src/core/stackStore.ts`
  - Add `addStackSkillToStack(skill, options)` for upserting a `StackSkill` without requiring an installed local skill.
- Modify `src/server/server.ts`
  - Add `POST /api/stack/skills/manual`.
- Modify `src/ui/page.ts`
  - Add Backup view controls for manual source entry.
  - Add frontend submit handler that calls `/api/stack/skills/manual`.
- Modify `README.md`
  - Document adding a not-yet-installed skill by source.
- Modify tests:
  - `tests/core/skillRestoreExecutor.test.ts`
  - `tests/core/stackStore.test.ts`
  - `tests/server/server.test.ts`

---

### Task 1: Core Source Conversion

**Files:**
- Modify: `src/core/skillRestoreExecutor.ts`
- Test: `tests/core/skillRestoreExecutor.test.ts`

- [ ] **Step 1: Write failing tests for source conversion**

Add `stackSkillFromInstallInput` to the import list:

```ts
import {
  buildRestorePlan,
  normalizeInstallInput,
  parseInstallCommand,
  restoreMissingSkills,
  stackSkillFromInstallInput,
  type RestoreCommandRunner
} from "../../src/core/skillRestoreExecutor.js";
```

Add tests:

```ts
test("creates a stack skill from a GitHub skill directory URL", () => {
  expect(
    stackSkillFromInstallInput("https://github.com/zhangga/aihub/tree/main/skills/chatgpt-images-fallback")
  ).toEqual({
    id: "chatgpt-images-fallback",
    type: "skill",
    source: {
      type: "skills.sh",
      package: "zhangga/aihub",
      skill: "chatgpt-images-fallback"
    },
    desiredState: "enabled"
  });
});

test("creates a stack skill from a shorthand install command", () => {
  expect(stackSkillFromInstallInput("npx skills add owner/repo --skill skill-name")).toEqual({
    id: "skill-name",
    type: "skill",
    source: {
      type: "skills.sh",
      package: "owner/repo",
      skill: "skill-name"
    },
    desiredState: "enabled"
  });
});

test("returns undefined for unsupported manual source input", () => {
  expect(stackSkillFromInstallInput("npm install owner/repo")).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm test -- tests/core/skillRestoreExecutor.test.ts
```

Expected: fail because `stackSkillFromInstallInput` is not exported.

- [ ] **Step 3: Implement minimal source conversion**

Add to `src/core/skillRestoreExecutor.ts`:

```ts
export function stackSkillFromInstallInput(input: string): StackSkill | undefined {
  const restoreCommand = normalizeInstallInput(input);
  if (!restoreCommand) {
    return undefined;
  }

  const packageInput = restoreCommand.args[2];
  const skill = restoreCommand.args[4];
  if (!packageInput || !skill) {
    return undefined;
  }

  const packageName = normalizePackageInput(packageInput);
  if (!packageName) {
    return {
      id: skill,
      type: "skill",
      source: {
        type: "command",
        install: restoreCommand.display
      },
      desiredState: "enabled"
    };
  }

  return {
    id: skill,
    type: "skill",
    source: {
      type: "skills.sh",
      package: packageName,
      skill
    },
    desiredState: "enabled"
  };
}

function normalizePackageInput(input: string): string | undefined {
  const trimmed = input.trim();
  const githubPrefix = "https://github.com/";

  if (trimmed.startsWith(githubPrefix)) {
    return trimmed.slice(githubPrefix.length);
  }

  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(trimmed) ? trimmed : undefined;
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```bash
npm test -- tests/core/skillRestoreExecutor.test.ts
```

Expected: pass.

---

### Task 2: Stack Upsert For Non-Installed Skills

**Files:**
- Modify: `src/core/stackStore.ts`
- Test: `tests/core/stackStore.test.ts`

- [ ] **Step 1: Write failing stack-store tests**

Add `addStackSkillToStack` to the import list:

```ts
import {
  addSkillToStack,
  addStackSkillToStack,
  createStackFile,
  readStack,
  readStackFileState,
  removeSkillFromStack,
  updateSkillSourceInStack
} from "../../src/core/stackStore.js";
```

Add tests:

```ts
test("adds a stack skill without requiring a local install", async () => {
  const root = await makeTempRoot();
  const stackPath = join(root, "stack.json");

  const stack = await addStackSkillToStack(
    {
      id: "chatgpt-images-fallback",
      type: "skill",
      source: {
        type: "skills.sh",
        package: "zhangga/aihub",
        skill: "chatgpt-images-fallback"
      },
      desiredState: "enabled"
    },
    { stackPath }
  );

  expect(stack.skills).toEqual([
    {
      id: "chatgpt-images-fallback",
      type: "skill",
      source: {
        type: "skills.sh",
        package: "zhangga/aihub",
        skill: "chatgpt-images-fallback"
      },
      desiredState: "enabled"
    }
  ]);
});

test("upserts a manually added stack skill by type and id", async () => {
  const root = await makeTempRoot();
  const stackPath = join(root, "stack.json");

  await addStackSkillToStack(
    {
      id: "skill-name",
      type: "skill",
      source: {
        type: "command",
        install: "npx skills add old/repo --skill skill-name"
      },
      desiredState: "enabled"
    },
    { stackPath }
  );

  const stack = await addStackSkillToStack(
    {
      id: "skill-name",
      type: "skill",
      source: {
        type: "skills.sh",
        package: "owner/repo",
        skill: "skill-name"
      },
      desiredState: "enabled"
    },
    { stackPath }
  );

  expect(stack.skills).toHaveLength(1);
  expect(stack.skills[0]?.source).toEqual({
    type: "skills.sh",
    package: "owner/repo",
    skill: "skill-name"
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm test -- tests/core/stackStore.test.ts
```

Expected: fail because `addStackSkillToStack` is not exported.

- [ ] **Step 3: Implement stack upsert helper**

Add to `src/core/stackStore.ts` near `addSkillToStack`:

```ts
export async function addStackSkillToStack(
  skill: StackSkill,
  options: StackStoreOptions = {}
): Promise<AgentDockStack> {
  const stackPath = options.stackPath ?? getDefaultStackPath();
  const stack = await readStack({ stackPath });
  const existingIndex = stack.skills.findIndex((item) => stackSkillKey(item) === stackSkillKey(skill));

  if (existingIndex >= 0) {
    stack.skills[existingIndex] = skill;
  } else {
    stack.skills.push(skill);
  }

  stack.skills.sort((left, right) => left.id.localeCompare(right.id));
  await writeStack(stack, stackPath);
  return stack;
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```bash
npm test -- tests/core/stackStore.test.ts
```

Expected: pass.

---

### Task 3: Server Endpoint

**Files:**
- Modify: `src/server/server.ts`
- Test: `tests/server/server.test.ts`

- [ ] **Step 1: Write failing server tests**

Add tests near the existing `/api/stack/skills` tests:

```ts
test("saves a manual source to backup without a local install", async () => {
  const root = await makeTempRoot();
  const stackPath = join(root, ".agentdock", "stack.json");

  await withServer(
    [root],
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/stack/skills/manual`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          install: "https://github.com/zhangga/aihub/tree/main/skills/chatgpt-images-fallback"
        })
      });
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.skill).toEqual({ id: "chatgpt-images-fallback" });
      expect(payload.stack.skills).toEqual([
        {
          id: "chatgpt-images-fallback",
          type: "skill",
          source: {
            type: "skills.sh",
            package: "zhangga/aihub",
            skill: "chatgpt-images-fallback"
          },
          desiredState: "enabled"
        }
      ]);
      expect(payload.stackFile.exists).toBe(true);
    },
    { stackPath }
  );
});

test("rejects manual source saves without supported input", async () => {
  const root = await makeTempRoot();
  const stackPath = join(root, ".agentdock", "stack.json");

  await withServer(
    [root],
    async (baseUrl) => {
      const missingResponse = await fetch(`${baseUrl}/api/stack/skills/manual`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({})
      });
      const missingPayload = await missingResponse.json();

      const invalidResponse = await fetch(`${baseUrl}/api/stack/skills/manual`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ install: "npm install owner/repo" })
      });
      const invalidPayload = await invalidResponse.json();

      expect(missingResponse.status).toBe(400);
      expect(missingPayload).toEqual({
        error: "Install command or GitHub skill URL is required."
      });
      expect(invalidResponse.status).toBe(400);
      expect(invalidPayload).toEqual({
        error: "Enter a npx skills add command or a GitHub skill URL."
      });
    },
    { stackPath }
  );
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm test -- tests/server/server.test.ts
```

Expected: fail with `404` for `/api/stack/skills/manual`.

- [ ] **Step 3: Implement endpoint**

Update imports:

```ts
import {
  buildRestorePlan,
  normalizeInstallInput,
  restoreMissingSkills,
  stackSkillFromInstallInput,
  type RestoreCommandRunner
} from "../core/skillRestoreExecutor.js";
```

```ts
import {
  addSkillToStack,
  addStackSkillToStack,
  createStackFile,
  readStack,
  readStackFileState,
  removeSkillFromStack,
  updateSkillSourceInStack,
  writeStackFile,
  type StackSkillInstall
} from "../core/stackStore.js";
```

Add route before `DELETE /api/stack/skills`:

```ts
if (request.method === "POST" && url.pathname === "/api/stack/skills/manual") {
  const body = await readJsonBody(request);
  const install = typeof body.install === "string" ? body.install.trim() : "";

  if (!install) {
    sendJson(response, 400, { error: "Install command or GitHub skill URL is required." });
    return;
  }

  const skill = stackSkillFromInstallInput(install);
  if (!skill) {
    sendJson(response, 400, { error: "Enter a npx skills add command or a GitHub skill URL." });
    return;
  }

  const stackPath = await resolveStackPath(options);
  const stack = await addStackSkillToStack(skill, { stackPath });
  const stackFile = await readStackFileState({ stackPath });
  sendJson(response, 200, { stack, stackFile, skill: { id: skill.id } });
  return;
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```bash
npm test -- tests/server/server.test.ts
```

Expected: pass.

---

### Task 4: Backup UI

**Files:**
- Modify: `src/ui/page.ts`
- Test: `tests/server/server.test.ts`

- [ ] **Step 1: Write failing UI HTML test**

Extend `serves backup contents and location UI controls`:

```ts
expect(html).toContain("Add by source");
expect(html).toContain('id="manual-source-form"');
expect(html).toContain('id="manual-source-input"');
expect(html).toContain("addManualSource(");
expect(html).toContain('fetch("/api/stack/skills/manual"');
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm test -- tests/server/server.test.ts
```

Expected: fail because the page does not contain the new controls.

- [ ] **Step 3: Add UI controls and handler**

Add markup before the saved skills `stack-panel` in the Backup view:

```html
<section class="manual-source-panel" aria-labelledby="manual-source-heading">
  <div class="section-head">
    <div>
      <p class="kicker">Add by source</p>
      <h3 id="manual-source-heading">Save a skill before installing it</h3>
    </div>
  </div>
  <form id="manual-source-form" class="manual-source-form">
    <label class="backup-command-label" for="manual-source-input">
      Install command or GitHub skill URL
      <input id="manual-source-input" class="backup-command-input" type="text" autocomplete="off" placeholder="https://github.com/owner/repo/tree/main/skills/skill-name" />
    </label>
    <button id="manual-source-save" class="button" type="submit">Add source</button>
  </form>
</section>
```

Add DOM references:

```js
const manualSourceForm = document.querySelector("#manual-source-form");
const manualSourceInput = document.querySelector("#manual-source-input");
```

Add handler:

```js
async function addManualSource(install) {
  const command = String(install || "").trim();
  if (!command) {
    statusLine.textContent = "Enter an install command or GitHub skill URL";
    manualSourceInput.focus();
    return;
  }

  statusLine.textContent = "Saving skill source to backup...";
  const response = await fetch("/api/stack/skills/manual", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ install: command })
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    statusLine.textContent = payload.error || "Could not save skill source";
    manualSourceInput.focus();
    return;
  }

  state.stack = payload.stack || state.stack;
  state.stackFile = payload.stackFile || state.stackFile;
  manualSourceInput.value = "";
  statusLine.textContent = "Skill source saved to backup";
  render();
}
```

Add submit listener:

```js
manualSourceForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addManualSource(manualSourceInput.value);
});
```

Add CSS using the existing Backup/Profile style:

```css
.manual-source-panel {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.manual-source-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
}
```

Add a mobile rule:

```css
.manual-source-form {
  grid-template-columns: 1fr;
}
```

- [ ] **Step 4: Run UI test to verify GREEN**

Run:

```bash
npm test -- tests/server/server.test.ts
```

Expected: pass.

---

### Task 5: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update usage text**

In the backup workflow section, add one sentence explaining:

```md
如果某个 skill 还没有安装，也可以在 Backup 页的 `Add by source` 中直接粘贴 `npx skills add ... --skill ...` 命令或 GitHub skill 目录链接；AgentDock 会把它保存进备份，随后 Restore Preview 会把它显示为可恢复项。
```

- [ ] **Step 2: Check README diff**

Run:

```bash
git diff -- README.md
```

Expected: README documents the new manual source flow.

---

### Task 6: Full Verification And Commit

**Files:**
- Verify all touched files.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 3: Browser smoke**

Start the app:

```bash
npm run dev -- web --port 5173
```

Use Browser to open `http://localhost:5173`, switch to Backup, confirm the `Add by source` form is visible, submit a valid GitHub skill URL, and confirm the saved skill appears in Backup Contents.

- [ ] **Step 4: Review diff**

Run:

```bash
git diff -- src/core/skillRestoreExecutor.ts src/core/stackStore.ts src/server/server.ts src/ui/page.ts tests/core/skillRestoreExecutor.test.ts tests/core/stackStore.test.ts tests/server/server.test.ts README.md
```

Expected: changes match this plan and no unrelated edits are present.

- [ ] **Step 5: Commit implementation**

Run:

```bash
git add src/core/skillRestoreExecutor.ts src/core/stackStore.ts src/server/server.ts src/ui/page.ts tests/core/skillRestoreExecutor.test.ts tests/core/stackStore.test.ts tests/server/server.test.ts README.md
git commit -m "feat: add skill backup by source"
```

Expected: implementation is committed separately from design and plan.

---

## Self-Review

- Spec coverage: the plan includes core conversion, stack upsert, server endpoint, UI form, README, and full verification.
- Placeholder scan: the plan contains no unfinished implementation placeholders.
- Type consistency: `stackSkillFromInstallInput`, `addStackSkillToStack`, and `/api/stack/skills/manual` names are used consistently across tests, implementation, and UI.
