# Spec: user-config-api

## Requirements

### Requirement: UserConfigService owns .client_data/.user-config.json in the user's DIAL Core bucket

`UserConfigService` in `apps/chat-api/src/user-config/user-config.service.ts` is the single owner of a JSON file called `.user-config.json` stored at `.client_data/.user-config.json` in the user's personal DIAL Core bucket. No other service reads or writes this file directly.

The file format is versioned (current version: `2`):

```ts
interface ConversationsConfig {
  pinnedIds: string[];
}

interface ToolsetsConfig {
  installed: string[];
}

interface DeploymentsConfig {
  installed: string[];
}

interface UserConfig {
  version: number;
  conversations: ConversationsConfig;
  toolsets: ToolsetsConfig;
  deployments: DeploymentsConfig;
}
```

Default (missing file, parse error, or empty bucket path):
```json
{ "version": 2, "conversations": { "pinnedIds": [] }, "toolsets": { "installed": [] }, "deployments": { "installed": [] } }
```

`migrateConfig(raw)` upgrades any stored value to the current v2 shape:
- Null / non-object → default v2 config.
- v1 shape (top-level `pinnedConversationIds` present, no nested `conversations`) → lift `pinnedConversationIds` into `conversations.pinnedIds` (filtering non-strings), set `toolsets.installed = []`, `deployments.installed = []`, `version = 2`.
- v2+ shape → validate and sanitise each array (filter non-strings), set `version = 2`.

**File path migration (old → new):** On `readConfig`, the service first attempts to download `.client_data/.user-config.json`. If DIAL Core returns non-ok, it falls back to downloading `.user-config.json` (the legacy path). If the legacy file is found, `migrateConfig` is applied, the result is written to the new path, and the old path is deleted (best-effort; failure is logged with `logger.warn`, not thrown). If neither path yields data, the default config is returned.

**Upload format:** unchanged — `multipart/form-data` via `FormData`.

**SDK error field:** unchanged — `client.uploadFile` resolves with `{ error, response }`.

#### Scenario: Missing file falls back to default config

- **WHEN** `readConfig` is called and `.client_data/.user-config.json` does not exist and `.user-config.json` does not exist
- **THEN** `readConfig` returns the default v2 config without throwing

#### Scenario: Corrupt file falls back to default config

- **WHEN** `readConfig` is called and the stored file contains invalid JSON
- **THEN** `readConfig` returns the default v2 config without throwing

#### Scenario: Legacy v1 file is migrated to v2 on first read

- **WHEN** `readConfig` is called and `.client_data/.user-config.json` does not exist but `.user-config.json` exists with `{ "version": 1, "pinnedConversationIds": ["conv-1"] }`
- **THEN** the returned config is `{ "version": 2, "conversations": { "pinnedIds": ["conv-1"] }, "toolsets": { "installed": [] }, "deployments": { "installed": [] } }`
- **AND** the migrated config is written to `.client_data/.user-config.json`

#### Scenario: v2 file at new path is returned as-is

- **WHEN** `readConfig` is called and `.client_data/.user-config.json` contains a valid v2 config
- **THEN** the stored config is returned without falling back to the legacy path

#### Scenario: Non-string entries in any array are filtered during migration

- **WHEN** a stored file contains `{ "version": 2, "conversations": { "pinnedIds": ["valid", 42, null] }, "toolsets": { "installed": [] }, "deployments": { "installed": [] } }`
- **THEN** `conversations.pinnedIds` is `["valid"]` in the returned config

---

### Requirement: readConfig consolidates legacy installation files into the unified config

When `readConfig` is called, after the primary config is resolved (from new path, old path, or default), `UserConfigService` SHALL attempt to read and consolidate two legacy installation files stored at:

- `clientdata/installed_toolsets.json` — a plain JSON array of toolset ID strings
- `clientdata/installed_deployments.json` — a plain JSON array of deployment ID strings

Consolidation strategy: **new-config-wins union** — the existing `config.toolsets.installed` (or `config.deployments.installed`) array is the base; only IDs from the legacy file that are NOT already present in the base are appended. The merge is performed independently for each legacy file.

After consolidation the legacy file is deleted from the DIAL Core bucket (best-effort). If deletion fails the failure is logged with `logger.warn` and the method returns normally. If the next `readConfig` call finds the legacy file again, the merge is a no-op because all legacy IDs are already present — no duplicates are introduced.

If a legacy file is absent (DIAL Core returns non-ok), missing, or yields empty/malformed content:
- Absent or non-ok response: skip silently, no change to config.
- Empty JSON array `[]`: no IDs to merge; skip.
- Invalid JSON or non-array body: log `logger.warn`, skip; do not modify the config.
- Array containing non-string entries: filter to strings only, then merge the strings.

All config sections not touched by the merge (`conversations`, and any future sections) MUST be preserved unchanged.

If no IDs were added by either merge, `writeConfig` is NOT called.

#### Scenario: Only legacy toolset file exists — no user-config at any path

- **WHEN** `.client_data/.user-config.json` is absent, `.user-config.json` is absent, and `clientdata/installed_toolsets.json` contains `["toolset-a", "toolset-b"]`
- **THEN** `readConfig` returns `{ "version": 2, "conversations": { "pinnedIds": [] }, "toolsets": { "installed": ["toolset-a", "toolset-b"] }, "deployments": { "installed": [] } }`
- **AND** the merged config is written to `.client_data/.user-config.json`

#### Scenario: Only legacy deployment file exists — no user-config at any path

- **WHEN** `.client_data/.user-config.json` is absent, `.user-config.json` is absent, and `clientdata/installed_deployments.json` contains `["dep-1"]`
- **THEN** `readConfig` returns `{ "version": 2, "conversations": { "pinnedIds": [] }, "toolsets": { "installed": [] }, "deployments": { "installed": ["dep-1"] } }`

#### Scenario: Both legacy installation files exist — no user-config at any path

- **WHEN** `.client_data/.user-config.json` is absent and `clientdata/installed_toolsets.json` contains `["ts-1"]` and `clientdata/installed_deployments.json` contains `["dep-1"]`
- **THEN** `readConfig` returns a config with `toolsets.installed = ["ts-1"]` and `deployments.installed = ["dep-1"]`

#### Scenario: Legacy toolsets merged into existing new user-config that already has entries

- **WHEN** `.client_data/.user-config.json` contains `{ "toolsets": { "installed": ["ts-existing"] }, ... }` and `clientdata/installed_toolsets.json` contains `["ts-new"]`
- **THEN** `readConfig` returns a config with `toolsets.installed = ["ts-existing", "ts-new"]`

#### Scenario: New config wins — duplicate IDs in legacy file are not added again

- **WHEN** `.client_data/.user-config.json` contains `{ "toolsets": { "installed": ["ts-a"] }, ... }` and `clientdata/installed_toolsets.json` contains `["ts-a", "ts-b"]`
- **THEN** `readConfig` returns a config with `toolsets.installed = ["ts-a", "ts-b"]` (no duplicate `"ts-a"`)

#### Scenario: New config wins — legacy file entirely overlaps with existing config

- **WHEN** `.client_data/.user-config.json` contains `{ "toolsets": { "installed": ["ts-a", "ts-b"] }, ... }` and `clientdata/installed_toolsets.json` contains `["ts-a", "ts-b"]`
- **THEN** `readConfig` returns a config with `toolsets.installed = ["ts-a", "ts-b"]` (unchanged)
- **AND** `writeConfig` is NOT called because no new IDs were added

#### Scenario: Both legacy files absent — no migration attempted

- **WHEN** `.client_data/.user-config.json` exists and both `clientdata/installed_toolsets.json` and `clientdata/installed_deployments.json` are absent (DIAL Core returns non-ok for both)
- **THEN** `readConfig` returns the stored config unchanged and does NOT call `writeConfig`

#### Scenario: Empty legacy file — treated as no-op

- **WHEN** `clientdata/installed_toolsets.json` contains `[]`
- **THEN** `toolsets.installed` in the returned config is unchanged and `writeConfig` is NOT called

#### Scenario: Malformed legacy file — skipped with warning

- **WHEN** `clientdata/installed_toolsets.json` contains invalid JSON (e.g. `"not-an-array"` or `{bad json`)
- **THEN** `readConfig` logs a `logger.warn` and returns the config without modification
- **AND** the legacy file is NOT deleted

#### Scenario: Repeated migration is idempotent when legacy file deletion fails

- **WHEN** `clientdata/installed_toolsets.json` contains `["ts-a"]`, the legacy file deletion fails on the first `readConfig` call, and `readConfig` is called a second time with the same legacy file still present
- **THEN** the second call returns a config with `toolsets.installed` containing `"ts-a"` exactly once
- **AND** the second call does NOT call `writeConfig` because no new IDs were added

#### Scenario: Partial migration — only one legacy installation file exists

- **WHEN** `clientdata/installed_toolsets.json` contains `["ts-a"]` and `clientdata/installed_deployments.json` is absent
- **THEN** `toolsets.installed` in the returned config contains `"ts-a"` and `deployments.installed` is unchanged

#### Scenario: conversations section is preserved during installation file migration

- **WHEN** `.client_data/.user-config.json` contains `{ "conversations": { "pinnedIds": ["conv-1"] }, "toolsets": { "installed": [] }, "deployments": { "installed": [] } }` and `clientdata/installed_toolsets.json` contains `["ts-a"]`
- **THEN** the returned config has `conversations.pinnedIds = ["conv-1"]` and `toolsets.installed = ["ts-a"]`

#### Scenario: Non-string entries in legacy file are filtered before merging

- **WHEN** `clientdata/installed_toolsets.json` contains `["ts-valid", 42, null, "ts-also-valid"]`
- **THEN** only `"ts-valid"` and `"ts-also-valid"` are merged into `toolsets.installed`

---

### Requirement: GET /api/v1/user-config returns the full user configuration in v2 shape

`UserConfigController` SHALL expose `GET /api/v1/user-config` returning HTTP 200 with the current `UserConfig` v2 object for the authenticated user. The handler calls `userConfigService.readConfig(at, bucket)` and returns the result directly.

Response body shape:
```json
{
  "version": 2,
  "conversations": { "pinnedIds": ["conversations/bucket/gpt-4__chat__uuid"] },
  "toolsets": { "installed": ["toolset-abc"] },
  "deployments": { "installed": [] }
}
```

Error codes:
- `401 Unauthorized` — missing or invalid bearer token

#### Scenario: Returns the stored v2 config

- **WHEN** `GET /api/v1/user-config` is called
- **THEN** the response is 200 with body `{ "version": 2, "conversations": { "pinnedIds": [...] }, "toolsets": { "installed": [...] }, "deployments": { "installed": [...] } }`

---

### Requirement: PATCH /api/v1/user-config/pins persists a single pin toggle against conversations.pinnedIds

`UserConfigController` SHALL expose `PATCH /api/v1/user-config/pins` returning HTTP 204. The request body is validated by `UpdatePinsDto` (unchanged):

```ts
class UpdatePinsDto {
  path: string;     // Full DIAL Core resource URL
  isPinned: boolean;
}
```

The handler calls `userConfigService.updatePin(path, isPinned, at, bucket)`. `updatePin` reads the current config, adds or removes `path` from `config.conversations.pinnedIds` (idempotent), then writes back via `writeConfig`.

Error codes: unchanged from v1.

#### Scenario: Valid pin request returns 204 and updates conversations.pinnedIds

- **WHEN** `PATCH /api/v1/user-config/pins` is called with `{ "path": "conversations/bucket/gpt-4__chat__uuid", "isPinned": true }`
- **THEN** the response is 204 and `conversations.pinnedIds` contains the path in the stored config

#### Scenario: Unpin removes id from conversations.pinnedIds

- **WHEN** `PATCH /api/v1/user-config/pins` is called with `{ "path": "...", "isPinned": false }`
- **THEN** the response is 204 and the path is absent from `conversations.pinnedIds`

#### Scenario: Pinning an already-pinned id is idempotent

- **WHEN** `PATCH /api/v1/user-config/pins` is called twice with the same path and `isPinned: true`
- **THEN** `conversations.pinnedIds` contains the path exactly once

#### Scenario: Missing path returns 400

- **WHEN** `PATCH /api/v1/user-config/pins` is called with `{ "isPinned": true }` (no path)
- **THEN** the response is 400

#### Scenario: Non-boolean isPinned returns 400

- **WHEN** `PATCH /api/v1/user-config/pins` is called with `{ "path": "...", "isPinned": "yes" }`
- **THEN** the response is 400

---

### Requirement: UserConfigModule is imported by ConversationModule and AppModule

Unchanged. `UserConfigModule` SHALL be listed in `ConversationModule.imports` and `AppModule.imports`. `UserConfigModule` exports `UserConfigService`. `getPinnedIds` and `migratePin` now operate on `config.conversations.pinnedIds`.

#### Scenario: Pin cleanup on conversation delete uses conversations.pinnedIds

- **WHEN** `DELETE /api/v1/conversations?path=...` is called for a conversation that is in `conversations.pinnedIds`
- **THEN** `userConfigService.updatePin(id, false, ...)` is called, and after the delete the id is absent from `conversations.pinnedIds`

---

### Requirement: Frontend uses user-config.api.ts for pin operations

Unchanged. The frontend MUST call `PATCH /api/v1/user-config/pins` through `apps/chat/src/server-api/user-config.api.ts` wrapping the regenerated `@epam/chat-api-client` method. Frontend types are updated to match the new `UserConfigDto` v2 shape.

#### Scenario: Frontend pin call reaches the endpoint with the new response shape

- **WHEN** a user pins a conversation in the UI
- **THEN** `PATCH /api/v1/user-config/pins` is called and the subsequent `GET /api/v1/user-config` response contains the id under `conversations.pinnedIds`
