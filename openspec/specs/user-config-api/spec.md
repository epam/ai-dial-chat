# Spec: user-config-api

## Requirements

### Requirement: UserConfigService owns user-config.json in the user's DIAL Core bucket

`UserConfigService` in `apps/chat-api/src/user-config/user-config.service.ts` is the single owner of a JSON file called `user-config.json` stored in the user's personal DIAL Core bucket. No other service reads or writes this file directly.

The file format is versioned:

```ts
interface UserConfig {
  version: number;               // Incremented when the shape changes incompatibly
  pinnedConversationIds: string[]; // Full DIAL Core resource URLs of pinned conversations
}
```

Default (missing file or parse error): `{ version: 1, pinnedConversationIds: [] }`.

`migrateConfig(raw)` upgrades any stored value to the current shape. If `pinnedConversationIds` is missing or not an array it defaults to `[]`; non-string entries are filtered out. The current version is `1`.

**Upload format:** The DIAL Core Files API requires `multipart/form-data`. Passing a raw `Buffer` causes openapi-fetch to send a boundary-less header, which DIAL Core rejects with 400. `writeConfig` passes a `FormData` object so fetch generates `Content-Type: multipart/form-data; boundary=<generated>` automatically.

**SDK error field:** `client.uploadFile` resolves (does not throw) on DIAL Core errors — it returns `{ error, response }`. `writeConfig` checks `error !== undefined` and calls `handleDialError` accordingly.

#### Scenario: Missing file falls back to default config

- **WHEN** `readConfig` is called and `user-config.json` does not exist (DIAL Core returns non-ok)
- **THEN** `readConfig` returns `{ version: 1, pinnedConversationIds: [] }` without throwing

#### Scenario: Corrupt file falls back to default config

- **WHEN** `readConfig` is called and the stored file contains invalid JSON
- **THEN** `readConfig` returns the default config without throwing

#### Scenario: Legacy file without version field is migrated

- **WHEN** `readConfig` reads a file that has `pinnedConversationIds` but no `version` field
- **THEN** the returned config has `version: 1` and the original `pinnedConversationIds` list

---

### Requirement: GET /api/v1/user-config returns the full user configuration

`UserConfigController` SHALL expose `GET /api/v1/user-config` returning HTTP 200 with the current `UserConfig` object for the authenticated user. The handler calls `userConfigService.readConfig(at, bucket)` and returns the result directly.

Error codes:
- `401 Unauthorized` — missing or invalid bearer token

#### Scenario: Returns the stored config

- **WHEN** `GET /api/v1/user-config` is called
- **THEN** the response is 200 with a body of shape `{ version: number, pinnedConversationIds: string[] }`

---

### Requirement: PATCH /api/v1/user-config/pins persists a single pin toggle

`UserConfigController` SHALL expose `PATCH /api/v1/user-config/pins` returning HTTP 204. The request body is validated by `UpdatePinsDto`:

```ts
class UpdatePinsDto {
  path: string;     // Full DIAL Core resource URL — matches ConversationListItemDto.id
  isPinned: boolean;
}
```

The handler calls `userConfigService.updatePin(path, isPinned, at, bucket)`. `updatePin` reads the current config, adds or removes `path` from `pinnedConversationIds` (idempotent), then writes back via `writeConfig`.

Pin identifier format: the full DIAL Core resource URL as returned by `GET /conversations/list` (e.g. `conversations/bucket/gpt-4__chat__uuid`). No transformation is applied — `listConversations` matches with `pinnedSet.has(item.url)`.

Error codes:
- `400 Bad Request` — body fails DTO validation (missing `path`, missing or non-boolean `isPinned`); or DIAL Core rejected the file write
- `401 Unauthorized` — missing or invalid bearer token

#### Scenario: Valid pin request returns 204

- **WHEN** `PATCH /api/v1/user-config/pins` is called with `{ "path": "conversations/bucket/...", "isPinned": true }`
- **THEN** the response is 204 and the conversation id appears in `pinnedConversationIds` in `user-config.json`

#### Scenario: Unpin removes id from the config

- **WHEN** `PATCH /api/v1/user-config/pins` is called with `{ "path": "...", "isPinned": false }`
- **THEN** the response is 204 and the id is absent from `pinnedConversationIds`

#### Scenario: Pinning an already-pinned id is idempotent

- **WHEN** `PATCH /api/v1/user-config/pins` is called twice with the same `path` and `isPinned: true`
- **THEN** `pinnedConversationIds` contains the id exactly once

#### Scenario: Missing path returns 400

- **WHEN** `PATCH /api/v1/user-config/pins` is called with `{ "isPinned": true }` (no path)
- **THEN** the response is 400

#### Scenario: Non-boolean isPinned returns 400

- **WHEN** `PATCH /api/v1/user-config/pins` is called with `{ "path": "...", "isPinned": "yes" }`
- **THEN** the response is 400

---

### Requirement: UserConfigModule is imported by ConversationModule and AppModule

`UserConfigModule` SHALL be listed in:
- `ConversationModule.imports` — so `ConversationService` can inject `UserConfigService` for pin cleanup on delete
- `AppModule.imports` — so `UserConfigController` is registered and its routes are reachable

`UserConfigModule` exports `UserConfigService`.

#### Scenario: Pin cleanup on conversation delete

- **WHEN** `DELETE /api/v1/conversations?path=...` is called for a pinned conversation
- **THEN** `userConfigService.updatePin(id, false, ...)` is called fire-and-forget; the 204 response is not delayed by the pin cleanup

---

### Requirement: Frontend uses user-config.api.ts for pin operations

The frontend MUST NOT call `PATCH /api/v1/conversations/pin` (removed). Pin operations go through `apps/chat/src/server-api/user-config.api.ts` which wraps `userConfigApi.updatePin`. `ConversationsContext` imports `apiPinConversation` from that module.

#### Scenario: Frontend pin call reaches the new endpoint

- **WHEN** a user pins a conversation in the UI
- **THEN** `PATCH /api/v1/user-config/pins` is called (not `/conversations/pin`)
