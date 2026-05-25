# Skills Backup and Restore Wizard MVP

## Background

AgentDock can already scan installed skills, save selected skills into My Stack, switch the stack file, show which saved skills are installed or missing, and generate a copyable install script. This is useful for technical users, but it still asks ordinary users to understand stack files, install plans, install sources, and terminal commands.

The next product step is to wrap the existing My Stack model in a beginner-friendly backup and restore flow. The underlying data model can stay small for now; the user-facing experience should feel like moving a skill backup from one computer to another.

## Goals

- Let a user create or choose a skill backup file without learning the term My Stack.
- Let a user add installed skills to that backup from the local inventory.
- Let a user open the backup on a new computer and see a restore preview.
- Let a user restore installable missing skills from the UI without copying commands into a terminal.
- Give clear next steps when a saved skill has no install source.
- Give clear failure messages and retry actions when restore installation fails.

## Non-Goals

- Cloud sync.
- Drag-and-drop import.
- Real-time streaming logs.
- Private local skill folder packaging.
- MCP, plugin, or prompt restore.
- A full profile schema separate from the existing stack JSON.
- Environment variable setup flows.

## User-Facing Model

The UI should describe the workflow as backup and restore:

- "Backup file" is the user-facing name for the current stack JSON file.
- "Add to backup" is the user-facing action for saving an installed skill to the stack.
- "Restore preview" is the user-facing name for the current install plan.
- "Needs attention" is the user-facing state for skills without a usable install source.

The internal My Stack model remains valid. The UI should avoid making ordinary users reason about stack, source, or install script unless they open advanced paths.

## Page Structure

### Left Status Area

Replace technical stack wording with backup wording:

- Installed skills count.
- Skills in backup count.
- Current backup file path.
- `Create backup file`.
- `Choose backup file`.
- `Enter path manually`.

The manual path fallback remains available because the system picker is only implemented for macOS.

### Main Area

The main page has three sections:

1. `My Skills`
   - Shows installed skills on this machine.
   - Keeps search and refresh.
   - Each unsaved row has `Add to backup`.
   - Saved rows show `In backup`.

2. `Backup Contents`
   - Shows saved skills from the backup file.
   - Shows whether each one is installed or missing on this machine.
   - Shows source detail only as secondary information.
   - Allows removing a skill from the backup.

3. `Restore Preview`
   - Shows counts for installed, restorable, and needs attention.
   - Has primary action `Start restore`.
   - Keeps `Copy install script` as an advanced fallback, not the main path.
   - Shows restore results after an apply run.

## Restore Preview Data

The restore preview classifies each saved skill into one of three groups:

- `alreadyInstalled`: a saved skill whose id is present in the local installed skill scan.
- `installable`: a saved skill that is missing locally and has a supported install command.
- `needsAttention`: a saved skill that is missing locally and has no supported install source.

The UI can continue computing this preview from the loaded skills and stack, but the backend should also expose equivalent plan logic before restore execution so apply behavior is not dependent on client-side classification.

## Server API

Keep the current stack APIs:

- `GET /api/skills`
- `GET /api/stack`
- `POST /api/stack/create`
- `POST /api/stack/path`
- `POST /api/stack/choose-file`
- `POST /api/stack/skills`
- `DELETE /api/stack/skills`

Add restore-focused APIs:

### `POST /api/restore/skills/plan`

Returns the backend restore preview for the current backup file and current machine state.

Response shape:

```json
{
  "plan": {
    "alreadyInstalled": [],
    "installable": [],
    "needsAttention": []
  }
}
```

### `POST /api/restore/skills/apply`

Restores missing installable skills. By default, it restores all installable skills. The request may optionally pass a list of skill ids to restore.

Response shape:

```json
{
  "results": [
    {
      "id": "find-skills",
      "status": "success",
      "message": "Installed successfully."
    }
  ]
}
```

Supported statuses:

- `success`
- `failed`
- `skipped`

After a restore completes, the UI reloads skills and stack state to refresh installed and missing statuses.

### `POST /api/stack/skills/source`

Saves a manual install command for a saved skill that needs attention.

Request shape:

```json
{
  "id": "custom-skill",
  "install": "npx skills add https://github.com/owner/repo --skill custom-skill"
}
```

The server validates that the command is a supported `npx skills add ...` command before saving it as a command source.

## Skill Restore Executor

Add a focused module:

```text
src/core/skillRestoreExecutor.ts
```

Responsibilities:

- Build a restore plan from installed skills and stack skills.
- Convert supported skill sources into argv arrays.
- Execute restore commands.
- Normalize success, failure, skipped, and timeout results for the UI.

### Command Sources

Supported sources:

- `source.type === "skills.sh"` generates:
  - `npx skills add https://github.com/{package} --skill {skill}`
- `source.type === "command"` executes a validated manual command.

Unsupported sources:

- `source.type === "unknown"` is never executed and is classified as needs attention.

### Command Safety

The executor must not pass raw user strings to a shell.

Manual commands are parsed and accepted only if they match one of these forms:

```bash
npx skills add https://github.com/owner/repo --skill skill-name
npx skills add owner/repo --skill skill-name
```

Rejected examples include shell separators, pipes, redirects, command substitution, and additional unsupported arguments. Execution uses `execFile` or `spawn` with explicit argv.

### Execution Strategy

- Execute skills serially.
- Use a per-skill timeout of 120 seconds.
- Capture stdout and stderr short summaries.
- Return one result per requested skill.
- Skip already installed skills and needs-attention skills.

## Error Handling

Map common failures to beginner-friendly messages:

- Missing `npx`: "Node.js/npm is required before AgentDock can restore skills."
- Network or GitHub failure: "Could not reach the skill source. Check your network and try again."
- Unsupported command format: "AgentDock can only restore commands that start with `npx skills add ...`."
- Timeout: "This skill took too long to install. You can retry it."
- Unknown failure: show a short stderr or error summary.

The UI should show:

- Success count.
- Failure count.
- A row per failed skill.
- A `Retry` action for failed installable skills.
- An `Edit install command` action when the failure is caused by unsupported command format.

## Needs Attention Flow

For a saved skill with no usable install source, show:

- Skill name.
- Reason: "This skill does not have a restore source yet."
- `Add install command`.
- `Handle later`.

The add command form has:

- Placeholder: `npx skills add https://github.com/owner/repo --skill skill-name`
- Save action: `Save and add to restore`
- Validation error: `Only npx skills add ... commands are supported right now.`

After a valid command is saved, the skill moves from needs attention to restorable.

## Advanced Install Script

Keep the generated install script as an advanced fallback. It should no longer be the heading or primary path for restore.

The primary action is `Start restore`. The script action can remain visible as `Copy install script` with an advanced label.

## Testing Plan

### Core Tests

- Build restore plan with installed, installable, and needs-attention groups.
- Generate argv for `skills.sh` sources.
- Accept valid manual `npx skills add ...` commands.
- Reject shell injection attempts such as `;`, `&&`, pipes, redirects, and unsupported extra arguments.
- Return normalized success, failure, skipped, and timeout results.

### Server Tests

- `POST /api/restore/skills/plan` returns expected groups.
- `POST /api/restore/skills/apply` restores only installable skills.
- Already installed skills are skipped.
- Unknown source skills are skipped with a needs-attention message.
- `POST /api/stack/skills/source` saves a valid manual command.
- Invalid manual commands return `400`.

### UI HTML Tests

Using the current server HTML test style, assert the page includes:

- `Create backup file`
- `Choose backup file`
- `Add to backup`
- `Restore Preview`
- `Start restore`
- `Add install command`
- `Retry`

Also assert that `Copy install script` remains available but is no longer the primary restore heading.

### Manual Acceptance

- A user can create a backup file.
- A user can add installed skills to the backup.
- A user can choose that backup file on another machine.
- The restore preview shows installed, restorable, and needs-attention counts.
- A user can restore restorable skills without opening a terminal.
- A needs-attention skill can be given a valid manual install command and then restored.
- An invalid manual install command is rejected with a clear message.
- Restore completion triggers a rescan and refreshed statuses.

## Implementation Order

1. Add restore planning and command parsing in `skillRestoreExecutor`.
2. Add source update support to the stack store.
3. Add restore plan, restore apply, and manual source APIs.
4. Update UI labels from stack/install-plan language to backup/restore language.
5. Add restore apply UI and restore result rendering.
6. Add needs-attention command form and retry flow.
7. Update README with the new backup and restore workflow.

## Open Product Decisions Deferred

- Whether to rename the physical `stack.json` file to a backup-specific default name.
- Whether to introduce a formal `agentdock-profile.json` schema.
- Whether backup import should support drag and drop.
- Whether private local skills should be packaged into a portable archive.
- Whether install logs should stream live.
