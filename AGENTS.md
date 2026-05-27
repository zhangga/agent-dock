# AGENTS.md

Guidance for coding agents working in this repository.

## Project Overview

AgentDock is a local TypeScript tool for managing installed Agent capabilities, currently focused on skills. It provides:

- A CLI entrypoint.
- A local HTTP server.
- A single rendered Web console.
- Core modules for scanning installed skills, maintaining a portable backup stack, restoring missing skills, diagnostics, profile import/export, local uninstall, and update checks.

The product model distinguishes local machine state from the user's desired portable state. The backup stack should remain a long-term desired-state file, not a dump of local scan details.

## Tech Stack

- Runtime: Node.js `>=20`.
- Language: TypeScript ESM.
- Test runner: Vitest.
- Frontend: plain HTML/CSS/JavaScript returned by `renderConsoleHtml()` in `src/ui/page.ts`; there is no frontend build framework.
- Keep the dependency footprint small unless a new dependency is clearly justified.

Use `.js` extensions in TypeScript import specifiers for local modules, matching the existing ESM style.

## Common Commands

```bash
npm install
npm run dev
npm run dev -- --port 3790
npm run dev -- status
npm run dev -- diagnostics
npm run dev -- profile export
npm run dev -- profile import agentdock-profile.json
npm test
npm run build
```

Vitest in this project does not accept Jest-only flags such as `--runInBand`; use `npm test` for the normal full suite.

## Source Map

- `src/cli/index.ts`: CLI argument handling and server startup.
- `src/cli/commands.ts`: terminal-facing diagnostics and profile commands.
- `src/server/server.ts`: HTTP routing and orchestration of core modules.
- `src/server/listen.ts`: port binding and fallback behavior.
- `src/ui/page.ts`: complete Web console HTML, CSS, and browser-side JavaScript.
- `src/core/skillScanner.ts`: finds installed `SKILL.md` files and classifies locations.
- `src/core/stackStore.ts`: reads and writes the portable backup stack.
- `src/core/skillInstallResolver.ts`: resolves installed skills to portable install sources.
- `src/core/skillRestoreExecutor.ts`: parses install inputs, builds restore plans, and applies restores.
- `src/core/skillRemover.ts`: local skill uninstall behavior.
- `src/core/diagnostics.ts`: local environment and restore-readiness checks.
- `src/core/profileStore.ts`: profile v1 export/import and preview logic.
- `src/core/updateChecker.ts`: read-only update state checks.
- `src/system/stackFilePicker.ts`: system file picker integration.
- `tests/core`, `tests/server`, `tests/cli`: test coverage organized by layer.
- `docs/superpowers`: historical specs and implementation plans; check these when extending existing feature areas.

## Development Rules

- Keep changes scoped to the feature or bug at hand. The worktree may contain unrelated user changes; inspect `git status --short` before editing and do not revert changes you did not make.
- Prefer adding injectable runners/probes/options for filesystem, process, network, and OS side effects so tests can stay deterministic.
- Preserve stack/profile privacy: do not store API keys, tokens, passwords, environment variable values, or unnecessary local machine paths in portable files.
- Stack/profile data should describe desired restore state. Avoid persisting scan-only details such as descriptions, local install paths, source root paths, or scan timestamps.
- Mutating operations should have explicit user intent and should return enough detail for the UI to explain what happened.
- Update checks must stay read-only and conservative. If a source cannot be compared reliably, report an unknown-style state instead of guessing.
- Use structured parsing helpers that already exist in `skillRestoreExecutor` and `stackStore`; avoid ad hoc command or JSON string manipulation when a local parser/model is available.

## UI Guidance

The Web console is an operational tool, not a marketing page. Keep it quiet, direct, and workflow-first.

- Edit UI in `src/ui/page.ts`.
- Keep the common path obvious; put less common maintenance actions behind clearly labeled disclosure controls.
- Maintain accessible labels, focus styles, disabled states, and responsive behavior.
- Escape user-controlled content with `escapeHtml()` before injecting it into HTML strings.
- Avoid adding frontend dependencies or a bundling step without a strong reason.
- For substantial UI changes, update server HTML tests and manually verify the local console in a browser at `http://127.0.0.1:3789` or an alternate port.
- Check mobile behavior around `390px` width and ensure there is no horizontal overflow.

## Testing Expectations

- Core logic changes: add or update focused tests in `tests/core`.
- Server API or rendered HTML changes: update `tests/server/server.test.ts`.
- CLI behavior changes: update `tests/cli`.
- Port binding/help changes: update `tests/server/listen.test.ts` or `tests/cli/portHelp.test.ts` as appropriate.
- Before handing off meaningful code changes, run:

```bash
npm test
npm run build
```

For documentation-only changes, at minimum run a quick diff check such as:

```bash
git diff --check
```

## Local Runtime Notes

- Default Web console port: `3789`.
- Use `npm run dev -- --port <port>` when the default port is occupied.
- Default stack path: `~/.agentdock/stack.json`.
- Skill roots can be provided with `--skill-root` or `AGENTDOCK_SKILL_DIRS`.
- `SKILLS_SH_API_KEY` can improve skill source resolution, but the app must keep working without it.

