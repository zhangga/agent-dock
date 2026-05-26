# CLI Profile and Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add terminal commands for diagnostics and Profile v1 export/import.

**Architecture:** Create `src/cli/commands.ts` for testable CLI command behavior and keep `src/cli/index.ts` as the process entrypoint. CLI commands reuse existing core modules for diagnostics, profile parsing, and stack file reads/writes.

**Tech Stack:** TypeScript, Node.js standard library, Vitest, existing AgentDock core modules.

---

## File Structure

- Create `src/cli/commands.ts`: command helpers for diagnostics and profile export/import.
- Create `tests/cli/commands.test.ts`: TDD coverage for command outputs and file effects.
- Modify `src/cli/index.ts`: parse `diagnostics`, `profile export`, and `profile import <file>`.
- Modify `README.md`: document CLI commands.

### Task 1: CLI Command Helpers

- [ ] **Step 1: Write failing command tests**

Create `tests/cli/commands.test.ts` covering:

- diagnostics returns exit code `0` with all ok checks.
- diagnostics returns exit code `1` when a check has status `error`.
- profile export returns JSON on stdout when no output path is provided.
- profile export writes a file when `outputPath` is provided.
- profile import reads a file, applies valid skills, and writes the active stack.

- [ ] **Step 2: Run failing command tests**

Run `npm test -- tests/cli/commands.test.ts`.

Expected: fail because `src/cli/commands.ts` does not exist.

- [ ] **Step 3: Implement `src/cli/commands.ts`**

Implement:

- `runDiagnosticsCommand(options)`.
- `runProfileExportCommand(options)`.
- `runProfileImportCommand(options)`.
- formatting helpers for diagnostics and profile import preview.

- [ ] **Step 4: Run passing command tests**

Run `npm test -- tests/cli/commands.test.ts`.

Expected: pass.

### Task 2: CLI Entrypoint Parsing

- [ ] **Step 1: Add failing parser/entrypoint test coverage**

Extend CLI tests to cover parser behavior through exported `parseArgs` or by testing a new pure parser helper:

- `diagnostics`.
- `profile export --output out.json`.
- `profile import profile.json`.

- [ ] **Step 2: Run failing tests**

Run `npm test -- tests/cli/commands.test.ts`.

Expected: fail until parsing support is implemented.

- [ ] **Step 3: Wire `src/cli/index.ts`**

Update parsing and `main()` dispatch to call the new helpers.

- [ ] **Step 4: Run passing CLI tests**

Run `npm test -- tests/cli/commands.test.ts`.

Expected: pass.

### Task 3: README and Verification

- [ ] **Step 1: Update README**

Document:

- `npm run dev -- diagnostics`
- `npm run dev -- profile export`
- `npm run dev -- profile export --output agentdock-profile.json`
- `npm run dev -- profile import agentdock-profile.json`

- [ ] **Step 2: Run full tests**

Run `npm test`.

Expected: all tests pass.

- [ ] **Step 3: Run build**

Run `npm run build`.

Expected: TypeScript build completes without errors.

- [ ] **Step 4: CLI smoke test**

Run:

```bash
npm run dev -- diagnostics
npm run dev -- profile export
```

Expected: diagnostics prints a summary and profile export prints JSON.
