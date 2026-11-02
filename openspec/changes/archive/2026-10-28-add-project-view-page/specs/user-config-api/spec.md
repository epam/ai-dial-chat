## RENAMED Requirements

FROM: ### Requirement: PATCH /api/v1/user-config/pins persists a single pin toggle against conversations.pinnedIds
TO: ### Requirement: PATCH /api/v1/user-config/pins persists a single pin toggle for a conversation or a project

FROM: ### Requirement: UserConfigModule is imported by ConversationModule and AppModule
TO: ### Requirement: UserConfigModule is imported by ConversationModule, ProjectsModule and AppModule

## MODIFIED Requirements

### Requirement: UserConfigService owns .client_data/.user-config.json in the user's DIAL Core bucket

`UserConfigService` in `apps/chat-api/src/user-config/user-config.service.ts` SHALL be the single owner of a JSON file called `.user-config.json`, stored at `.client_data/.user-config.json` in the user's personal DIAL Core bucket. No other service reads or writes this file directly.

The file format is versioned (`CURRENT_CONFIG_VERSION = 7`, `apps/chat-api/src/user-config/dto/user-config.dto.ts`):

```ts
interface ConversationsConfig {
  pinnedIds: string[];
}

interface ProjectsConfig {
  pinnedIds: string[]; // pinned projects/{bucket}/{path} ids
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
  projects: ProjectsConfig;
  toolsets: ToolsetsConfig;
  deployments: DeploymentsConfig;
  prompts: PromptsConfig;
  skills: SkillsConfig;
  legacyMigrationDone?: boolean; // internal flag, see below
}
```

**Default config.** `createDefaultUserConfig()` returns a fresh object per call. It is used for a missing file (`404`), a parse error, or an empty bucket path.

Any other failed read SHALL NOT fall back to the default: a non-ok status other than `404` (5xx, `429`, `403`), or a thrown network error. `readConfig` rethrows it through `handleDialSdkError` (context `user-config.readConfig`), so neither the read nor a mutation built on it writes a default config over the user's stored file.

The default:

```json
{ "version": 7, "conversations": { "pinnedIds": [] }, "projects": { "pinnedIds": [] }, "toolsets": { "installed": [] }, "deployments": { "installed": [], "selectedId": null }, "prompts": { "installed": [] }, "skills": { "installed": [] } }
```

`migrateConfig(raw, userBucket)` upgrades any stored value to the current v7 shape:

- **Null / non-object:** the default config.
- **v1 shape** (top-level `pinnedConversationIds` present, no nested `conversations`): the default config, with `pinnedConversationIds` lifted into `conversations.pinnedIds` (filtering non-strings).
- **v2+ shape:** each section's array is read, filtering non-strings. In addition:
  - `projects.pinnedIds` is read when present, and is `[]` otherwise, so a v6 file gains an empty `projects` section;
  - `deployments.selectedId` is kept only when it is a string (else `null`);
  - a bare (non-`prompts/`-prefixed) `prompts.installed` entry is qualified as `prompts/{userBucket}/{entry}`;
  - `legacyMigrationDone` is kept only when `true`;
  - `version` is set to 7.

**File path migration (old → new):**

1. On `readConfig`, the service first tries to download `.client_data/.user-config.json`.
2. If DIAL Core returns `404`, or the file is not valid JSON, it falls back to downloading `.user-config.json` (the legacy path).
3. If the legacy file is found, `migrateConfig` is applied, the result is written to the new path, and the old path is deleted. The delete is best effort: a failure is logged with `logger.warn`, not thrown.
4. Migration writes are best effort too. A failed write is logged with `logger.warn`, the migrated config is still returned, and the legacy file is kept so the next read retries.
5. If neither path yields data, the default config is returned.

**Upload format:** unchanged — `multipart/form-data` via `FormData`.

**SDK error field:** unchanged — `client.uploadFile` resolves with `{ error, response }`.

#### Scenario: Missing file falls back to default config

- **WHEN** `readConfig` is called, `.client_data/.user-config.json` does not exist, and `.user-config.json` does not exist
- **THEN** `readConfig` returns the default v7 config without throwing

#### Scenario: A failed read is rethrown instead of overwriting the stored config

- **WHEN** DIAL Core answers the download of `.client_data/.user-config.json` with `503`, `429` or another non-`404` error, or the request throws
- **THEN** `readConfig` rethrows the mapped error and writes nothing, and a mutation such as `updatePin` fails without uploading a config

#### Scenario: Corrupt file falls back to default config

- **WHEN** `readConfig` is called and the stored file contains invalid JSON
- **THEN** `readConfig` returns the default v7 config without throwing

#### Scenario: Legacy v1 file is migrated to the current shape on first read

- **WHEN** `readConfig` is called, `.client_data/.user-config.json` does not exist, and `.user-config.json` exists with `{ "version": 1, "pinnedConversationIds": ["conv-1"] }`
- **THEN** the returned config is the default v7 config with `conversations.pinnedIds = ["conv-1"]` (plus `legacyMigrationDone: true` once legacy installation files have been consolidated)
- **AND** the migrated config is written to `.client_data/.user-config.json`

#### Scenario: v6 file gains an empty projects section

- **WHEN** `.client_data/.user-config.json` contains a valid v6 config without `projects`
- **THEN** the returned config has `version: 7` and `projects: { pinnedIds: [] }`, and every other section is unchanged

#### Scenario: v7 file at new path is returned as-is

- **WHEN** `readConfig` is called and `.client_data/.user-config.json` contains a valid v7 config with `legacyMigrationDone: true`
- **THEN** the stored config is returned without falling back to the legacy path

#### Scenario: Non-string entries in any array are filtered during migration

- **WHEN** a stored file contains `{ "version": 2, "conversations": { "pinnedIds": ["valid", 42, null] }, "toolsets": { "installed": [] }, "deployments": { "installed": [] } }`
- **THEN** `conversations.pinnedIds` is `["valid"]` in the returned config

### Requirement: GET /api/v1/user-config returns the full user configuration in the current shape

`UserConfigController` SHALL expose `GET /api/v1/user-config`, returning HTTP 200 with the current `UserConfig` object (version 7, documented as `UserConfigDto`) for the authenticated user. The handler calls `userConfigService.readConfig(at, bucket)` and returns the result directly. `UserConfigDto` gains `projects: ProjectsConfigDto` (`pinnedIds: string[]`, with `@ApiProperty`).

Response body shape:

```json
{
  "version": 7,
  "conversations": { "pinnedIds": ["conversations/bucket/gpt-4__chat__uuid"] },
  "projects": { "pinnedIds": ["projects/bucket/q4-launch"] },
  "toolsets": { "installed": ["toolset-abc"] },
  "deployments": { "installed": [], "selectedId": null },
  "prompts": { "installed": [] },
  "skills": { "installed": [] }
}
```

Error codes:

- `401 Unauthorized`: missing or invalid bearer token.

**Generated-client impact:** `UserConfigDto.projects` and `ProjectsConfigDto` are emitted by `npm run openapi`.

#### Scenario: Returns the stored config

- **WHEN** `GET /api/v1/user-config` is called
- **THEN** the response is 200 with body `{ "version": 7, "conversations": { "pinnedIds": [...] }, "projects": { "pinnedIds": [...] }, "toolsets": { "installed": [...] }, "deployments": { "installed": [...], "selectedId": ... }, "prompts": { "installed": [...] }, "skills": { "installed": [...] } }`

### Requirement: PATCH /api/v1/user-config/pins persists a single pin toggle for a conversation or a project

`UserConfigController` SHALL expose `PATCH /api/v1/user-config/pins`, returning HTTP 204. The request body is validated by `UpdatePinsDto`:

```ts
class UpdatePinsDto {
  path: string;     // Full DIAL Core resource URL of a conversation or a project
  isPinned: boolean;
}
```

The validation is unchanged. Only the Swagger descriptions widen from "conversation" to "conversation or project".

The handler calls `userConfigService.updatePin(path, isPinned, at, bucket)`. `updatePin` reads the current config and picks the list:

- `config.projects.pinnedIds` when `path` starts with `projects/`;
- `config.conversations.pinnedIds` otherwise.

It adds `path` to that list or removes it (idempotent), then writes back via `writeConfig`.

`UserConfigService` SHALL also expose two helpers. Both read, mutate and write the config, and both are no-ops (no write) when `oldId` / `id` is not pinned:

- `replaceProjectPin(oldId, newId, token, bucket)`: replaces `oldId` with `newId` in place, so the pin order is kept.
- `removeProjectPin(id, token, bucket)`.

Error codes: unchanged from v1.

#### Scenario: Valid pin request returns 204 and updates conversations.pinnedIds

- **WHEN** `PATCH /api/v1/user-config/pins` is called with `{ "path": "conversations/bucket/gpt-4__chat__uuid", "isPinned": true }`
- **THEN** the response is 204, and `conversations.pinnedIds` contains the path in the stored config

#### Scenario: Project id goes to projects.pinnedIds

- **WHEN** `PATCH /api/v1/user-config/pins` is called with `{ "path": "projects/bucket/q4-launch", "isPinned": true }`
- **THEN** the response is 204, `projects.pinnedIds` contains the path, and `conversations.pinnedIds` is unchanged

#### Scenario: Unpin removes id from conversations.pinnedIds

- **WHEN** `PATCH /api/v1/user-config/pins` is called with `{ "path": "...", "isPinned": false }`
- **THEN** the response is 204, and the path is absent from `conversations.pinnedIds`

#### Scenario: Pinning an already-pinned id is idempotent

- **WHEN** `PATCH /api/v1/user-config/pins` is called twice with the same path and `isPinned: true`
- **THEN** the matching list contains the path exactly once

#### Scenario: Rename keeps the pin position

- **WHEN** `projects.pinnedIds` is `["projects/b/a", "projects/b/q4"]` and `replaceProjectPin("projects/b/q4", "projects/b/Q4 launch")` runs
- **THEN** `projects.pinnedIds` is `["projects/b/a", "projects/b/Q4 launch"]`

#### Scenario: Missing path returns 400

- **WHEN** `PATCH /api/v1/user-config/pins` is called with `{ "isPinned": true }` (no path)
- **THEN** the response is 400

#### Scenario: Non-boolean isPinned returns 400

- **WHEN** `PATCH /api/v1/user-config/pins` is called with `{ "path": "...", "isPinned": "yes" }`
- **THEN** the response is 400

### Requirement: UserConfigModule is imported by ConversationModule, ProjectsModule and AppModule

`UserConfigModule` SHALL be listed in `ConversationModule.imports`, `ProjectsModule.imports` and `AppModule.imports`. It is also imported by `DeploymentsModule` and `ToolsetsModule`. `UserConfigModule` exports `UserConfigService`.

- `getPinnedIds` operates on `config.conversations.pinnedIds`.
- `updatePin` routes by prefix, as above.
- `replaceProjectPin` and `removeProjectPin` operate on `config.projects.pinnedIds`.

#### Scenario: Pin cleanup on conversation delete uses conversations.pinnedIds

- **WHEN** `DELETE /api/v1/conversations?path=...` is called for a conversation that is in `conversations.pinnedIds`
- **THEN** after the DIAL Core delete, `ConversationLifecycleService` calls `userConfigService.updatePin(id, false, ...)` fire-and-forget (a failure is logged, not thrown), and the id is then absent from `conversations.pinnedIds`

#### Scenario: Pin cleanup on project delete uses projects.pinnedIds

- **WHEN** `DELETE /api/v1/projects/:id` succeeds for a pinned project
- **THEN** `ProjectsService` calls `userConfigService.removeProjectPin(id, ...)`, a failure is logged and not thrown, and the id is then absent from `projects.pinnedIds`

## ADDED Requirements

### Requirement: UserConfigContext exposes project pins

`UserConfigContext` (`apps/chat/src/context/UserConfigContext.tsx`) SHALL expose three members:

- **`pinnedProjectIds: string[]`**, loaded from `config.projects?.pinnedIds ?? []` and reset with the other sections.
- **`setPinnedProject(id, isPinned): Promise<void>`**:
  - optimistic: it updates the state first, then calls `pinProject(id, isPinned)` in `apps/chat/src/server-api/user-config.api.ts`, which wraps `userConfigApi.updatePin({ updatePinsDto: { path: id, isPinned } })`;
  - it reverts to the snapshot on failure and rethrows, as `setPinnedConversation` does.
- **`replacePinnedProjectId(oldId, newId): void`**: a local-state update used after the BFF migrated a pin during a rename. It sends no request.

The new callbacks are wrapped in `useCallback`, and the context value stays in `useMemo`, with the new members in its dependency list.

#### Scenario: Optimistic pin reverts on failure

- **WHEN** `setPinnedProject('projects/b/q4', true)` is called and the request fails
- **THEN** `pinnedProjectIds` first contains the id, then no longer does, and the error is rethrown to the caller

#### Scenario: Pin survives a reload

- **WHEN** a project is pinned and the page reloads
- **THEN** `GET /api/v1/user-config` returns it under `projects.pinnedIds`, and `pinnedProjectIds` contains it
