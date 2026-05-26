# CLI Profile and Diagnostics Design

## Goal

Expose the existing Diagnostics and Profile v1 capabilities through terminal commands so advanced users can check restore prerequisites and move profiles without opening the Web UI.

## Commands

### `agentdock diagnostics`

Runs the same checks as the Restore page Diagnostics panel:

- Node.js
- npm
- npx
- git
- GitHub
- skills.sh
- active Backup file
- skill roots

Output is human-readable:

```text
Diagnostics: 8 ok / 0 warnings / 0 errors

ok      Node.js       Node.js is available.
ok      npm           npm is available.
```

The command exits with:

- `0` when there are no errors.
- `1` when at least one diagnostic check is `error`.

Warnings do not fail the command.

### `agentdock profile export [--output <path>]`

Reads the active Backup file and creates a Profile v1 payload.

- Without `--output`, prints JSON to stdout.
- With `--output`, writes the profile JSON to the provided path and prints a short confirmation.

### `agentdock profile import <file>`

Reads a Profile v1 JSON file and applies valid new or updated skills into the active Backup.

The command prints the same import summary shape as the Web UI:

```text
Profile import: 2 to import / 3 unchanged / 0 invalid
- new      skill-a
- updated  skill-b
```

It exits with:

- `0` when the profile was parsed and applied.
- `1` when the profile cannot be read, cannot be parsed, or uses an unsupported schema.

Invalid profile entries are reported and ignored, matching Web UI behavior.

## Stack Path

CLI commands use the same configured Backup path as the Web UI:

1. Read `~/.agentdock/config.json`.
2. Use `config.stackPath` if configured.
3. Fall back to `~/.agentdock/stack.json`.

## Options

Existing shared options remain supported where relevant:

- `--skill-root <path>` for `diagnostics`.

New option:

- `--output <path>` for `profile export`.

No profile file picker is added to CLI.

## Implementation

Create focused CLI helpers in `src/cli/commands.ts` so tests can cover formatting and command behavior without executing the process entrypoint.

`src/cli/index.ts` remains the process entrypoint and delegates to:

- `printDiagnostics`.
- `exportProfile`.
- `importProfile`.

## Tests

Add `tests/cli/commands.test.ts` covering:

- diagnostics formatting and exit code behavior.
- profile export to stdout payload.
- profile export to file.
- profile import from file writes to the active Backup.

Existing server and core tests continue to cover shared diagnostics/profile logic.
