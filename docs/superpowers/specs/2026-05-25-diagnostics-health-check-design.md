# Diagnostics Health Check Design

## Goal

Add a restore-focused Diagnostics view that tells users whether AgentDock has the local tools, network access, and writable files needed to back up and restore skills.

## Scope

This first version covers checks that directly affect the current skills backup and restore workflow:

- Node.js runtime availability.
- npm availability.
- npx availability.
- git availability.
- GitHub network reachability.
- skills.sh network reachability.
- Current backup file state and writability.
- Configured or default skill roots, including whether at least one existing root is writable.

It does not manage MCP servers, plugins, prompts, profile import/export, update detection, or client configuration health.

## API

Expose `GET /api/diagnostics`.

The response shape is:

```ts
{
  checks: DiagnosticCheck[];
  summary: {
    ok: number;
    warning: number;
    error: number;
  };
}

interface DiagnosticCheck {
  id: string;
  label: string;
  status: "ok" | "warning" | "error";
  message: string;
  detail?: string;
}
```

The API should run quickly and degrade gracefully. Command checks use short timeouts and return warnings or errors instead of throwing. Network checks use `fetch` with an abort timeout.

## Core Module

Add `src/core/diagnostics.ts`.

The module should export:

- `runDiagnostics(options)` for the server.
- `summarizeDiagnostics(checks)` for tests and UI payloads.
- dependency-injection hooks for command execution, network fetching, stack path, skill roots, and current working directory.

Checks:

- `runtime.node`: current `process.version`.
- `runtime.npm`: `npm --version`.
- `runtime.npx`: `npx --version`.
- `tools.git`: `git --version`.
- `network.github`: `HEAD https://github.com`.
- `network.skillsSh`: `HEAD https://skills.sh`.
- `stack.file`: missing file is a warning with a create-file suggestion; existing readable/writable file is ok; inaccessible file is error.
- `skills.roots`: ok when at least one existing root is writable, warning when no roots exist yet, error when roots exist but none are writable.

## UI

Add a compact Diagnostics panel in the Restore view, near Restore Preview. It should include:

- A `Run diagnostics` button.
- A summary line such as `All checks passed`, `2 warnings`, or `1 issue found`.
- A list of checks with status, message, and optional detail.

The UI should not block restore. It is an explanatory tool and should be useful before or after a restore failure.

## Error Handling

Diagnostics failures should be beginner-friendly:

- Missing npm/npx: tell the user Node.js/npm is needed before restore can install skills.
- Missing git: warn that some skill installs may fail.
- Network failure: tell the user to check network access to GitHub or skills.sh.
- Missing backup file: tell the user to create or choose a backup file.
- Unwritable roots: tell the user AgentDock may not be able to restore into the configured roots.

## Tests

Add core tests for:

- all checks passing with injected command/network/filesystem behavior.
- missing npm/npx/git command results.
- network failures.
- missing backup file warning.
- unwritable skill roots error.

Add server tests for `GET /api/diagnostics`.

Add UI HTML tests for the Diagnostics panel and rendering helpers.
