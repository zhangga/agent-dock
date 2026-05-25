# Diagnostics Health Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a restore-focused diagnostics API and UI panel for the current skills backup/restore workflow.

**Architecture:** A new core diagnostics module performs injectable command, network, stack-file, and skill-root checks. The local server exposes the results at `GET /api/diagnostics`, and the existing single-page UI renders the checks inside the Restore tab.

**Tech Stack:** TypeScript, Node.js standard library, native `fetch`, Vitest, existing HTML string UI.

---

## File Structure

- Create `src/core/diagnostics.ts`: diagnostic types, command/network/filesystem checks, summary helper.
- Create `tests/core/diagnostics.test.ts`: unit coverage for ok, warning, and error states.
- Modify `src/server/server.ts`: inject and expose diagnostics through `GET /api/diagnostics`.
- Modify `tests/server/server.test.ts`: API and HTML expectations.
- Modify `src/ui/page.ts`: Diagnostics panel, fetch handler, render helpers, event listener.

### Task 1: Core Diagnostics

- [ ] **Step 1: Write failing core tests**

Add tests covering all-ok checks, missing commands, network failures, missing backup file, and unwritable skill roots.

- [ ] **Step 2: Verify tests fail**

Run `npm test -- tests/core/diagnostics.test.ts`. Expected: fail because `src/core/diagnostics.ts` does not exist.

- [ ] **Step 3: Implement core diagnostics**

Create `src/core/diagnostics.ts` with injectable command, fetch, stack path, and skill root checks.

- [ ] **Step 4: Verify core tests pass**

Run `npm test -- tests/core/diagnostics.test.ts`. Expected: pass.

### Task 2: Server API

- [ ] **Step 1: Write failing server test**

Add a test for `GET /api/diagnostics` using injected command/network behavior.

- [ ] **Step 2: Verify server test fails**

Run `npm test -- tests/server/server.test.ts`. Expected: fail because the endpoint is missing.

- [ ] **Step 3: Implement API route**

Add `diagnostics` injection options and route `GET /api/diagnostics`.

- [ ] **Step 4: Verify server tests pass**

Run `npm test -- tests/server/server.test.ts`. Expected: pass.

### Task 3: UI Panel

- [ ] **Step 1: Write failing UI HTML test**

Assert the page contains the Diagnostics panel, button, render helper, and `/api/diagnostics` call.

- [ ] **Step 2: Verify UI test fails**

Run `npm test -- tests/server/server.test.ts`. Expected: fail until the HTML is updated.

- [ ] **Step 3: Implement UI**

Add the panel in the Restore tab with summary, list, loading state, and a `Run diagnostics` button.

- [ ] **Step 4: Verify UI tests pass**

Run `npm test -- tests/server/server.test.ts`. Expected: pass.

### Task 4: Full Verification

- [ ] **Step 1: Run all tests**

Run `npm test`. Expected: all tests pass.

- [ ] **Step 2: Run TypeScript build**

Run `npm run build`. Expected: completes without errors.
