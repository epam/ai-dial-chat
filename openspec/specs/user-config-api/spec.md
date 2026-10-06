# Spec: user-config-api

## Purpose

User configuration stored in the user's DIAL Core bucket: read consolidation, the versioned shape (current version 6), and pin persistence.

## Requirements

### Requirement: UserConfigService owns .client_data/.user-config.json in the user's DIAL Core bucket

`UserConfigService` in `apps/chat-api/src/user-config/user-config.service.ts` SHALL be the single owner of a JSON file called `.user-config.json` stored at `.client_data/.user-config.json` in the user's personal DIAL Core bucket. No other service reads or writes this file directly.

The file format is versioned (`CURRENT_CONFIG_VERSION = 6`, `apps/chat-api/src/user-config/dto/user-config.dto.ts`):

```ts
interface ConversationsConfig {
  pinnedIds: string[];
}

interface ToolsetsConfig {
  installed: string[];
}

interface DeploymentsConfig {
  installed: string[];
  selectedId: string | null;
}

interface PromptsConfig {
  installed: string[]; // favorited prompts/{bucket}/{path} ids
}

interface SkillsConfig {
  installed: string[]; // favorited skill resource URLs
}

interface UserConfig {
  version: number;
  conversations: ConversationsConfig;
  toolsets: ToolsetsConfig;
  deployments: DeploymentsConfig;
  prompts: PromptsConfig;
  skills: SkillsConfig;
  legacyMigrationDone?: boolean; // internal flag, see below
}
```

Default (`createDefaultUserConfig()`, a fresh object per call; missing file (`404`), parse error, or empty bucket path). Any other failed read — a non-ok status other than `404` (5xx, `429`, `403`) or a thrown network error — SHALL NOT fall back to the default: `readConfig` rethrows it through `handleDialSdkError` (context `user-config.readConfig`), so neither the read nor a mutation built on it writes a default config over the user's stored file:
```json
{ "version": 6, "conversations": { "pinnedIds": [] }, "toolsets": { "installed": [] }, "deployments": { "installed": [], "selectedId": null }, "prompts": { "installed": [] }, "skills": { "installed": [] } }
```

`migrateConfig(raw, userBucket)` upgrades any stored value to the current v6 shape:
- Null / non-object → default config.
- v1 shape (top-level `pinnedConversationIds` present, no nested `conversations`) → default config with `pinnedConversationIds` lifted into `conversations.pinnedIds` (filtering non-strings).
- v2+ shape → read each section's array, filtering non-strings; `deployments.selectedId` is kept only when it is a string (else `null`); a bare (non-`prompts/`-prefixed) `prompts.installed` entry is qualified as `prompts/{userBucket}/{entry}`; `legacyMigrationDone` is kept only when `true`; `version` is set to 6.

**File path migration (old → new):** On `readConfig`, the service first attempts to download `.client_data/.user-config.json`. If DIAL Core returns `404` (or the file is not valid JSON), it falls back to downloading `.user-config.json` (the legacy path). If the legacy file is found, `migrateConfig` is applied, the result is written to the new path, and the old path is deleted (best-effort; failure is logged with `logger.warn`, not thrown). Migration writes are best-effort too: a failed write is logged with `logger.warn`, the migrated config is still returned, and the legacy file is kept so the next read retries. If neither path yields data, the default config is returned.

**Upload format:** unchanged — `multipart/form-data` via `FormData`.

**SDK error field:** unchanged — `client.uploadFile` resolves with `{ error, response }`.

#### Scenario: Missing file falls back to default config

- **WHEN** `readConfig` is called and `.client_data/.user-config.json` does not exist and `.user-config.json` does not exist
- **THEN** `readConfig` returns the default v6 config without throwing

#### Scenario: A failed read is rethrown instead of overwriting the stored config

- **WHEN** DIAL Core answers the download of `.client_data/.user-config.json` with `503`, `429` or another non-`404` error, or the request throws
- **THEN** `readConfig` rethrows the mapped error and writes nothing, and a mutation such as `updatePin` fails without uploading a config

#### Scenario: Corrupt file falls back to default config

- **WHEN** `readConfig` is called and the stored file contains invalid JSON
- **THEN** `readConfig` returns the default v6 config without throwing

#### Scenario: Legacy v1 file is migrated to the current shape on first read

- **WHEN** `readConfig` is called and `.client_data/.user-config.json` does not exist but `.user-config.json` exists with `{ "version": 1, "pinnedConversationIds": ["conv-1"] }`
- **THEN** the returned config is the default v6 config with `conversations.pinnedIds = ["conv-1"]` (plus `legacyMigrationDone: true` once legacy installation files have been consolidated)
- **AND** the migrated config is written to `.client_data/.user-config.json`

#### Scenario: v6 file at new path is returned as-is

- **WHEN** `readConfig` is called and `.client_data/.user-config.json` contains a valid v6 config with `legacyMigrationDone: true`
- **THEN** the stored config is returned without falling back to the legacy path

#### Scenario: Non-string entries in any array are filtered during migration

- **WHEN** a stored file contains `{ "version": 2, "conversations": { "pinnedIds": ["valid", 42, null] }, "toolsets": { "installed": [] }, "deployments": { "installed": [] } }`
- **THEN** `conversations.pinnedIds` is `["valid"]` in the returned config

---

### Requirement: readConfig consolidates legacy installation files into the unified config

When `readConfig` is called, after the primary config is resolved (from new path, old path, or default), and only while the config does not carry `legacyMigrationDone: true`, `UserConfigService` SHALL attempt to read and consolidate two legacy installation files stored at:

- `clientdata/installed_toolsets.json` — a JSON array of toolset IDs (strings, or objects carrying a string `id`)
- `clientdata/installed_deployments.json` — a JSON array of deployment IDs (strings, or objects carrying a string `id`)

Consolidation strategy: **new-config-wins union** — the existing `config.toolsets.installed` (or `config.deployments.installed`) array is the base; only IDs from the legacy file that are NOT already present in the base are appended. The merge is performed independently for each legacy file.

After a legacy file is read as a valid array, it is deleted from the DIAL Core bucket (best-effort; a `404` is ignored). If deletion fails for another reason the failure is logged with `logger.warn` and the method returns normally. After the consolidation pass — whatever it found — the config is marked `legacyMigrationDone: true` and written, so later `readConfig` calls skip consolidation entirely and never re-read a legacy file whose deletion failed.

If a legacy file is absent (DIAL Core returns non-ok), missing, or yields empty/malformed content:
- Absent or non-ok response: skip silently, no change to config.
- Empty JSON array `[]`: no IDs to merge; skip.
- Invalid JSON or non-array body: log `logger.warn`, skip; do not modify the config.
- Array containing other entries: keep strings and the string `id` of object entries, drop everything else, then merge.

All config sections not touched by the merge (`conversations`, and any future sections) MUST be preserved unchanged.

The first consolidation pass always calls `writeConfig` once (to persist `legacyMigrationDone: true`, together with any merged IDs). Once the flag is stored, `readConfig` does NOT call `writeConfig` for consolidation.

#### Scenario: Only legacy toolset file exists — no user-config at any path

- **WHEN** `.client_data/.user-config.json` is absent, `.user-config.json` is absent, and `clientdata/installed_toolsets.json` contains `["toolset-a", "toolset-b"]`
- **THEN** `readConfig` returns the default v6 config with `toolsets.installed = ["toolset-a", "toolset-b"]` and `legacyMigrationDone: true`
- **AND** the merged config is written to `.client_data/.user-config.json`

#### Scenario: Only legacy deployment file exists — no user-config at any path

- **WHEN** `.client_data/.user-config.json` is absent, `.user-config.json` is absent, and `clientdata/installed_deployments.json` contains `["dep-1"]`
- **THEN** `readConfig` returns the default v6 config with `deployments.installed = ["dep-1"]` and `legacyMigrationDone: true`

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
- **AND** `writeConfig` is called only to persist `legacyMigrationDone: true`

#### Scenario: Both legacy files absent — only the flag is persisted

- **WHEN** `.client_data/.user-config.json` exists without `legacyMigrationDone` and both `clientdata/installed_toolsets.json` and `clientdata/installed_deployments.json` are absent (DIAL Core returns non-ok for both)
- **THEN** `readConfig` returns the stored config's sections unchanged, with `legacyMigrationDone: true`, and calls `writeConfig` once to persist the flag

#### Scenario: Consolidation already done — no legacy reads

- **WHEN** `.client_data/.user-config.json` carries `legacyMigrationDone: true`
- **THEN** `readConfig` does not download either legacy installation file and does NOT call `writeConfig`

#### Scenario: Empty legacy file — treated as no-op

- **WHEN** `clientdata/installed_toolsets.json` contains `[]`
- **THEN** `toolsets.installed` in the returned config is unchanged

#### Scenario: Malformed legacy file — skipped with warning

- **WHEN** `clientdata/installed_toolsets.json` contains invalid JSON (e.g. `"not-an-array"` or `{bad json`)
- **THEN** `readConfig` logs a `logger.warn` and returns the config without modification
- **AND** the legacy file is NOT deleted

#### Scenario: Repeated read is idempotent when legacy file deletion fails

- **WHEN** `clientdata/installed_toolsets.json` contains `["ts-a"]`, the legacy file deletion fails on the first `readConfig` call, and `readConfig` is called a second time with the same legacy file still present
- **THEN** the second call returns a config with `toolsets.installed` containing `"ts-a"` exactly once
- **AND** the second call skips consolidation (the stored `legacyMigrationDone: true`) and does NOT call `writeConfig`

#### Scenario: Partial migration — only one legacy installation file exists

- **WHEN** `clientdata/installed_toolsets.json` contains `["ts-a"]` and `clientdata/installed_deployments.json` is absent
- **THEN** `toolsets.installed` in the returned config contains `"ts-a"` and `deployments.installed` is unchanged

#### Scenario: conversations section is preserved during installation file migration

- **WHEN** `.client_data/.user-config.json` contains `{ "conversations": { "pinnedIds": ["conv-1"] }, "toolsets": { "installed": [] }, "deployments": { "installed": [] } }` and `clientdata/installed_toolsets.json` contains `["ts-a"]`
- **THEN** the returned config has `conversations.pinnedIds = ["conv-1"]` and `toolsets.installed = ["ts-a"]`

#### Scenario: Non-string entries in legacy file are filtered before merging

- **WHEN** `clientdata/installed_toolsets.json` contains `["ts-valid", 42, null, "ts-also-valid", { "id": "ts-object" }]`
- **THEN** only `"ts-valid"`, `"ts-also-valid"`, and `"ts-object"` are merged into `toolsets.installed`

---

### Requirement: GET /api/v1/user-config returns the full user configuration in the current shape

`UserConfigController` SHALL expose `GET /api/v1/user-config` returning HTTP 200 with the current `UserConfig` object (version 6, documented as `UserConfigDto`) for the authenticated user. The handler calls `userConfigService.readConfig(at, bucket)` and returns the result directly.

Response body shape:
```json
{
  "version": 6,
  "conversations": { "pinnedIds": ["conversations/bucket/gpt-4__chat__uuid"] },
  "toolsets": { "installed": ["toolset-abc"] },
  "deployments": { "installed": [], "selectedId": null },
  "prompts": { "installed": [] },
  "skills": { "installed": [] }
}
```

Error codes:
- `401 Unauthorized` — missing or invalid bearer token

#### Scenario: Returns the stored config

- **WHEN** `GET /api/v1/user-config` is called
- **THEN** the response is 200 with body `{ "version": 6, "conversations": { "pinnedIds": [...] }, "toolsets": { "installed": [...] }, "deployments": { "installed": [...], "selectedId": ... }, "prompts": { "installed": [...] }, "skills": { "installed": [...] } }`

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

`UserConfigModule` SHALL be listed in `ConversationModule.imports` and `AppModule.imports` (it is also imported by `DeploymentsModule` and `ToolsetsModule`). `UserConfigModule` exports `UserConfigService`. `getPinnedIds` and `updatePin` operate on `config.conversations.pinnedIds`.

#### Scenario: Pin cleanup on conversation delete uses conversations.pinnedIds

- **WHEN** `DELETE /api/v1/conversations?path=...` is called for a conversation that is in `conversations.pinnedIds`
- **THEN** after the DIAL Core delete, `ConversationLifecycleService` calls `userConfigService.updatePin(id, false, ...)` fire-and-forget (a failure is logged, not thrown), and the id is then absent from `conversations.pinnedIds`

---

### Requirement: Frontend uses user-config.api.ts for pin operations

The frontend MUST call `PATCH /api/v1/user-config/pins` through `apps/chat/src/server-api/user-config.api.ts` wrapping the generated `@epam/ai-dial-chat-api-client` method `userConfigApi.updatePin({ updatePinsDto })`. Frontend types come from the generated `UserConfigDto`.

#### Scenario: Frontend pin call reaches the endpoint with the new response shape

- **WHEN** a user pins a conversation in the UI
- **THEN** `PATCH /api/v1/user-config/pins` is called and the subsequent `GET /api/v1/user-config` response contains the id under `conversations.pinnedIds`
