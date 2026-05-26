# Profile v1 Design

## Goal

Add a minimal Profile Sync loop so users can export their current Backup as `agentdock-profile.json`, import a profile on another machine, preview what would change, and apply it into the current Backup before using the existing Restore flow.

## Scope

Profile v1 is a portable wrapper around the existing stack schema. It includes only the user's desired skill list and enough metadata to identify the export.

Included:

- Export current Backup to a profile JSON payload.
- Download or copy the generated profile from the Web UI.
- Paste/import profile JSON in the Web UI.
- Preview imported skills as new, existing, updated source, or invalid.
- Apply the preview into the current Backup.
- Reuse the existing Restore Preview and Start restore flow after import.

Deferred:

- Profile files with global/project/client snapshots.
- MCP, plugin, prompt, bundle, env, or client configuration import.
- Saving API keys, tokens, passwords, or environment variable values.
- Automatic opening of system file pickers for profile files.

## Profile Schema

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-05-26T00:00:00.000Z",
  "agentdockVersion": "0.1.0",
  "stack": {
    "schemaVersion": 1,
    "skills": [
      {
        "id": "find-skills",
        "type": "skill",
        "source": {
          "type": "skills.sh",
          "package": "vercel-labs/skills",
          "skill": "find-skills"
        },
        "desiredState": "enabled"
      }
    ]
  }
}
```

The profile should normalize imported stack entries using the same compact sync schema as `stackStore`. Invalid skills are reported in preview and ignored during apply.

## API

Add these local API endpoints:

- `GET /api/profile/export`
  - Reads the active Backup.
  - Returns `{ profile, fileName }`.
  - `fileName` defaults to `agentdock-profile.json`.

- `POST /api/profile/import/preview`
  - Accepts `{ profile: string | object }`.
  - Returns a preview with counts and rows:
    - `new`: skill id does not exist in current Backup.
    - `existing`: same skill id and same normalized source already exists.
    - `updated`: same skill id exists but imported source differs.
    - `invalid`: profile entry cannot be normalized.

- `POST /api/profile/import/apply`
  - Accepts `{ profile: string | object }`.
  - Applies valid imported skills into the active Backup.
  - Existing same-source skills stay unchanged.
  - Existing different-source skills are replaced by the imported source.
  - Returns updated `{ stack, stackFile, preview }`.

## Core Module

Create `src/core/profileStore.ts`.

Exports:

- `createProfileFromStack(stack, options)`.
- `parseProfileInput(input)`.
- `previewProfileImport(profile, currentStack)`.
- `applyProfileImport(profile, currentStack)`.

The module should be pure except for timestamp/version inputs. Server code handles reading and writing stack files.

## UI

Add a small Profile section in the Backup view:

- `Export profile` button.
- Generated JSON textarea.
- `Copy profile` button.
- Import textarea.
- `Preview import` button.
- Preview summary and rows.
- `Apply import` button enabled only when the preview has valid new or updated skills.

The UI should not hide or replace the existing Backup table. After apply, it updates state and the existing Restore tab immediately reflects the imported skills.

## Error Handling

- Invalid JSON returns a beginner-friendly parse error.
- Unsupported profile schema returns an error explaining that only Profile schema v1 is supported.
- Empty profile or no valid skills returns a preview with zero applicable changes.
- Apply should never write invalid entries to Backup.

## Tests

Core tests:

- Export wraps a stack with metadata.
- Parse accepts JSON string and object input.
- Preview detects new, existing, updated, and invalid entries.
- Apply merges valid entries and ignores invalid ones.

Server tests:

- `GET /api/profile/export` returns profile and filename.
- Preview endpoint returns import counts.
- Apply endpoint writes imported valid skills into the active Backup.

UI HTML tests:

- Backup view contains profile controls.
- UI has export, copy, preview, and apply handlers.
