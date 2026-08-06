## ADDED Requirements

### Requirement: Viewed scheduled-task conversation ids are persisted in a dedicated bucket file

The backend SHALL persist which scheduler-created conversation ids the current user has opened in `.client_data/.viewed-scheduled-task-conversations.json` inside the user's DIAL Core bucket — a dedicated file, separate from `.client_data/.user-config.json`, owned by a new `apps/chat-api/src/scheduled-task-unread/` domain (`ScheduledTaskUnreadService`, `ScheduledTaskUnreadController`, `ScheduledTaskUnreadModule`, `dto/`).

File schema:

```ts
interface ViewedScheduledTaskConversations {
  version: 1;
  conversationIds: string[]; // full DIAL Core conversation resource ids the user has opened
}
```

Read path SHALL follow the same pattern as `UserConfigService.readConfigFromPath` (`apps/chat-api/src/user-config/user-config.service.ts`): `DialClientService.client.downloadFile(bucket, path, { headers: getBearerAuthHeaders(token), parseAs: 'stream' })`; a non-ok response or any thrown error SHALL be treated as "file does not exist yet" and fall back to `{ version: 1, conversationIds: [] }` without throwing, logging a `logger.warn` on unexpected failures.

Write path SHALL follow `UserConfigService.writeConfig`: `DialClientService.client.uploadFile(bucket, path, { headers: getBearerAuthHeaders(token), body })` where `body` is a `FormData` with a `Blob` of `JSON.stringify(...)` appended (a plain string/Buffer body produces a boundary-less `Content-Type` that DIAL Core rejects). Errors from `uploadFile` SHALL be mapped via `handleDialSdkError`.

#### Scenario: Reading a missing viewed-ids file returns an empty default

- **WHEN** `.client_data/.viewed-scheduled-task-conversations.json` does not exist in the user's bucket and `getViewedIds` is called
- **THEN** the service returns `[]` without throwing

#### Scenario: Reading a malformed viewed-ids file returns an empty default

- **WHEN** `.client_data/.viewed-scheduled-task-conversations.json` contains invalid JSON or a non-array `conversationIds`
- **THEN** the service logs a warning and returns `[]` without throwing

#### Scenario: Marking a conversation as viewed persists its id

- **GIVEN** the viewed-ids file currently contains `{ "version": 1, "conversationIds": ["conversations/bucket/a"] }`
- **WHEN** `markViewed("conversations/bucket/b", token, bucket)` is called
- **THEN** the file is rewritten with `conversationIds: ["conversations/bucket/a", "conversations/bucket/b"]`

#### Scenario: Marking an already-viewed conversation is a no-op write

- **GIVEN** the viewed-ids file already contains a given conversation id
- **WHEN** `markViewed` is called again with that same id
- **THEN** the resulting `conversationIds` array contains that id exactly once (no duplicate entries), and the file is still rewritten (idempotent, not skipped)

### Requirement: PATCH /api/v1/conversations/viewed marks a conversation as viewed

The backend SHALL expose `PATCH /api/v1/conversations/viewed` in `apps/chat-api/src/conversations/conversation.controller.ts`, identifying the conversation via the same `path` query param convention already used by every other by-resource operation in this controller (`ConversationPathDto` — see `GET`, `PUT`, `PATCH` rename, `DELETE`), versioned (`version: '1'`), annotated with `@ApiTags('conversations')`. The handler requires no request body. `ConversationService.markConversationViewed(path, token, bucket)` resolves the relative `path` to the full DIAL Core resource id via `buildConversationUrl(bucket, path)` (matching the `id` format used in `ConversationListItemDto`) before delegating to `ScheduledTaskUnreadService.markViewed(fullId, token, bucket)`. On success it returns HTTP 204 with no body. The endpoint SHALL be idempotent — calling it multiple times for the same path has the same effect as calling it once.

Authorization: any authenticated user may mark their own bucket's conversation ids as viewed; the conversation is scoped to the caller's `bucket` from `SessionUser` — no cross-user access is possible since the file lives in the caller's own bucket.

Rate limiting: global default applies (no handler-level `@Throttle` override — this is a lightweight idempotent write, not resource creation).

Generated-client impact:
- OpenAPI operationId: `markConversationViewed`
- SDK method: `ConversationsApi.markConversationViewed({ path })`
- Frontend callers use the normal (non-Raw) generated method via `apps/chat/src/server-api/conversations.api.ts`

Error codes:
- `400 Bad Request` — `path` query param fails validation (empty/missing)
- `401 Unauthorized` — missing or invalid bearer token
- `502 Bad Gateway` — DIAL Core write to the viewed-ids file failed

#### Scenario: Marking a conversation viewed returns 204

- **WHEN** `PATCH /api/v1/conversations/viewed?path=gpt-4__My%20task__uuid` is called with a valid bearer token
- **THEN** the response status is 204 with an empty body, and a subsequent `GET /api/v1/conversations/list` marks that conversation's `isUnread` as `false`

#### Scenario: Marking an already-viewed conversation returns 204

- **GIVEN** a conversation path already present in the viewed-ids file
- **WHEN** `PATCH .../viewed` is called again for that same path
- **THEN** the response status is still 204 and no duplicate entry is created

#### Scenario: Missing bearer token returns 401

- **WHEN** `PATCH .../viewed` is called without an `Authorization` header
- **THEN** the response status is 401

#### Scenario: Missing path query param returns 400

- **WHEN** `PATCH /api/v1/conversations/viewed` is called without a `path` query param
- **THEN** the response status is 400
