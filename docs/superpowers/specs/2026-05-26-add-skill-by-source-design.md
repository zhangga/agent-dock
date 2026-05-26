# Add Skill by Source Design

## Goal

Let users save a restorable skill into Backup even when that skill is not installed on the current machine. The user pastes either a supported `npx skills add ... --skill ...` command or a GitHub skill directory URL, AgentDock validates it, infers the skill id, writes it to the active backup file, and the Restore view can immediately classify it as missing and installable.

## Scope

In scope:

- Add one manual source form to the Backup view.
- Accept the same source formats already supported by restore-source repair:
  - `npx skills add owner/repo --skill skill-name`
  - `npx skills add https://github.com/owner/repo --skill skill-name`
  - `https://github.com/owner/repo/tree/<branch>/skills/skill-name`
- Infer the backup skill id from the normalized `--skill` value.
- Upsert the inferred skill into the active backup file as a desired enabled skill.
- Reuse Restore Preview and Profile Sync behavior without changing their data contracts.

Out of scope:

- Browsing or searching remote catalogs.
- Downloading or installing the skill during backup add.
- Supporting arbitrary shell commands.
- Letting users override the inferred id in the first version.

## Approach

Use the existing restore-source parser as the source of truth, then add a small helper that converts a normalized install input into a `StackSkill`:

1. Parse and normalize the pasted input with `normalizeInstallInput`.
2. Derive `id` from the normalized command's `--skill` argument.
3. Prefer a structured `skills.sh` source when the command uses `owner/repo` or `https://github.com/owner/repo`.
4. Fall back to a command source only if parsing cannot safely produce a structured package.
5. Upsert by `type:id`, preserving the existing sorted backup file behavior.

This keeps command validation in one place and avoids adding a second parser in the server or UI.

## API

Add `POST /api/stack/skills/manual`.

Request:

```json
{
  "install": "https://github.com/owner/repo/tree/main/skills/skill-name"
}
```

Success response:

```json
{
  "stack": {
    "schemaVersion": 1,
    "skills": [
      {
        "id": "skill-name",
        "type": "skill",
        "source": {
          "type": "skills.sh",
          "package": "owner/repo",
          "skill": "skill-name"
        },
        "desiredState": "enabled"
      }
    ]
  },
  "stackFile": {
    "path": "/Users/example/.agentdock/stack.json",
    "exists": true
  },
  "skill": {
    "id": "skill-name"
  }
}
```

Validation errors:

- Missing `install`: `400` with `Install command or GitHub skill URL is required.`
- Unsupported format: `400` with `Enter a npx skills add command or a GitHub skill URL.`

## UI

Add a compact `Add by source` section near the top of the Backup view, before the saved skills list. It includes:

- One text input for command or URL.
- One primary `Add source` button.
- A short status line using the existing page status pattern.

On success, the UI clears the input, updates `state.stack` and `state.stackFile`, re-renders Backup, and reports `Skill source saved to backup`. The saved skill appears in Backup Contents and in Restore Preview as installable when it is not installed locally.

## Testing

Core tests:

- Convert a normalized GitHub skill URL into a stack skill with a structured `skills.sh` source.
- Convert a shorthand install command into a stack skill with a structured `skills.sh` source.
- Upsert an existing manually added skill instead of duplicating it.

Server tests:

- `POST /api/stack/skills/manual` saves a valid GitHub URL without an installed local skill.
- The endpoint rejects missing or unsupported input.

UI tests:

- The served page contains the Add by source controls and calls `/api/stack/skills/manual`.

Verification:

- `npm test`
- `npm run build`
- Browser smoke on the Backup view after the frontend change.
