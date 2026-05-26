# Update Check Design

## Goal

Add a read-only update check surface for backed-up skills. AgentDock should show whether each saved skill is installed locally, whether an update probe can report a newer version, and the command a user can run to refresh the skill.

## Non-Goals

- Do not automatically install or update skills.
- Do not call remote services from tests.
- Do not claim a skill is up to date when the local install has no reliable version or revision metadata.
- Do not change the stack/profile schema for this first version.

## Behavior

AgentDock reads the current backup stack and installed skills, then returns an update report.

Each report item includes:

- `id`: skill id.
- `installed`: whether a matching local skill is installed.
- `status`: one of `update_available`, `up_to_date`, `unknown`, `not_installed`, or `needs_source`.
- `currentVersion`: optional local version or revision.
- `latestVersion`: optional probed latest version or revision.
- `suggestedCommand`: optional install command to refresh or install the skill.
- `message`: short user-facing explanation.

Default behavior is conservative. Since `SKILL.md` installs currently do not expose a standard version field, AgentDock returns `unknown` for installed skills with restorable sources unless a probe provides version data. Skills without restore sources return `needs_source`. Missing skills with a restore command return `not_installed`.

## API

`POST /api/check-updates`

Response:

```json
{
  "updates": {
    "items": [],
    "summary": {
      "update_available": 0,
      "up_to_date": 0,
      "unknown": 0,
      "not_installed": 0,
      "needs_source": 0
    }
  }
}
```

The endpoint must be read-only. It scans installed skills and reads the current stack only.

## UI

Add an Update Check panel in the Backup view:

- Button: `Check updates`.
- Summary text with counts.
- Result rows showing status, message, and refresh command where available.

The UI should explain uncertainty through item messages rather than a long static help block.

## Testing

- Core tests cover missing source, missing install, default unknown status, and injected probe results.
- Server tests verify `POST /api/check-updates` returns the update report and does not mutate the stack file.
- HTML tests verify the Backup view contains update controls and calls the new endpoint.
