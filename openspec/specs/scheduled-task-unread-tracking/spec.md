# Spec: scheduled-task-unread-tracking

## Purpose

Track which scheduler-created conversations the current user has opened, persisted in the user's DIAL Core bucket, so `GET /api/v1/conversations/list` can derive an `isUnread` flag per scheduler-created conversation and the frontend can mark a conversation as viewed.

## Requirements

### Requirement: Viewed scheduled-task conversation ids are persisted in a dedicated bucket file

The backend SHALL persist which scheduler-created conversation ids the current user has opened in `.client_data/.viewed-scheduled-task-conversations.json` inside the user's DIAL Core bucket — a dedicated file, separate from `.client_data/.user-config.json`, owned by the `apps/chat-api/src/scheduled-task-unread/` domain (`ScheduledTaskUnreadService`, `ScheduledTaskUnreadModule`, and `dto/viewed-scheduled-task-conversations.dto.ts` with `DEFAULT_VIEWED_SCHEDULED_TASK_CONVERSATIONS` and `parseViewedScheduledTaskConversations`). The domain has no controller of its own: the module only provides and exports the service, and the HTTP endpoint lives in `ConversationController`.

File schema:

```ts
interface ViewedScheduledTaskConversations {
  version: 1;
  conversationIds: string[]; // full DIAL Core conversation resource ids the user has opened
}
```

Read path SHALL follow the same pattern as `UserConfigService.readConfigFromPath` (`apps/chat-api/src/user-config/user-config.service.ts`): `DialClientService.client.downloadFile(bucket, path, { headers: getBearerAuthHeaders(token), parseAs: 'stream' })`; only a `404` (or invalid JSON, logged with `logger.warn`) SHALL be treated as "file does not exist yet" and fall back to `{ version: 1, conversationIds: [] }`. Any other non-ok status or a thrown error SHALL be rethrown through `handleDialSdkError` (context `scheduled-task-unread.readConfig`), so `markViewed` never writes an empty list over the stored ids; the read-only `getViewedIds` catches that error, logs a warning and returns `[]`. A parsed body that is not an object, or whose `conversationIds` is not an array, SHALL silently normalize to an empty list, and non-string entries SHALL be dropped.

Write path SHALL follow `UserConfigService.writeConfig`: `DialClientService.client.uploadFile(bucket, path, { headers: getBearerAuthHeaders(token), body })` where `body` is a `FormData` with a `Blob` of `JSON.stringify(...)` appended (a plain string/Buffer body produces a boundary-less `Content-Type` that DIAL Core rejects). Errors from `uploadFile` SHALL be mapped via `handleDialSdkError`.

#### Scenario: Reading a missing viewed-ids file returns an empty default

- **WHEN** `.client_data/.viewed-scheduled-task-conversations.json` does not exist in the user's bucket and `getViewedIds` is called
- **THEN** the service returns `[]` without throwing

#### Scenario: Reading a malformed viewed-ids file returns an empty default

- **WHEN** `.client_data/.viewed-scheduled-task-conversations.json` contains invalid JSON
- **THEN** the service logs a warning and returns `[]` without throwing

#### Scenario: A non-array conversationIds normalizes to empty

- **WHEN** the file parses but `conversationIds` is not an array
- **THEN** the service returns `[]` without throwing and without logging

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

### Requirement: Discovered run conversations refresh shared unread metadata

`ConversationsContext` SHALL own unread metadata shared by task History, sources History, and conversation rows. Under the existing `scheduledTasksEnabled` gating, the app's history adapter SHALL refresh this metadata when a successful history response contains conversation ids, including unchanged polls. Start now SHALL refresh it when an accepted run first exposes a conversation id or its status changes. Callers SHALL pass expected conversation ids to `refreshConversations(expectedIds?)`; missing metadata SHALL NOT be interpreted as proof that a chat was viewed.

The provider-owned `useConversationDiscovery` SHALL retry missing expected ids up to five additional times, two seconds after each request settles. Pending canonical ids SHALL share one retry timer without overlapping retry requests or resetting the pending budget for duplicate callers. Discovery SHALL survive run completion and page navigation, stopping when metadata arrives, the budget is exhausted, the user changes, or the provider unmounts. Ordinary refreshes without expected ids SHALL NOT start retries. This synchronization introduces no new endpoints, persistent caches, strings, UI, RTL, accessibility, or telemetry contracts.

#### Scenario: A manual or scheduled run exposes a chat

- **WHEN** Start now or a history response exposes a run conversation
- **THEN** the app refreshes the shared conversation metadata and displays its backend unread state without reloading the page or marking it viewed

#### Scenario: Completed run metadata is temporarily missing

- **WHEN** the refreshed list omits an expected chat or fails, even after the run has finished
- **THEN** bounded discovery retries continue independently of run-status polling
- **AND** all shared indicators update when the chat becomes available

#### Scenario: Navigate before run metadata becomes visible

- **WHEN** the user opens an expected chat before its metadata arrives
- **THEN** provider-owned discovery continues after leaving task History and the active chat is marked viewed once its matching metadata loads

### Requirement: Viewed state remains consistent across navigation and overlapping requests

The always-mounted `useActiveConversationSync` SHALL invoke the app-owned viewed callback when the active conversation's matching identity becomes available, using canonical id matching. This SHALL cover task History, sources History, the conversation panel, and direct URLs, including when the panel is closed. The shared hook SHALL receive matching and persistence behavior through injected callbacks; host routes, auth, and persistence SHALL remain app-owned.

`ConversationsContext` SHALL optimistically clear only the viewed chat's unread flag, deduplicate simultaneous views, and serialize writes within the provider. Pending and successfully viewed canonical ids SHALL override stale unread list snapshots for the current user. A failed write SHALL restore unread state without automatically retrying on list updates; leaving and revisiting the chat SHALL allow another attempt. Identity changes SHALL reset local tracking and retire previous-user asynchronous results. Serialization is scoped to one provider, not an atomicity guarantee across tabs or server instances.

List loading and refresh SHALL reject responses older than the last successfully applied request. Merely starting or failing a newer request SHALL NOT invalidate an older successful response.

#### Scenario: Open a run through any navigation entry point

- **WHEN** a run conversation becomes active and its matching list metadata is available, including after delayed loading or with the panel closed
- **THEN** only that chat is marked viewed and its indicators become read in every shared view

#### Scenario: Stale list response follows a viewed write

- **WHEN** a list response still says unread while a viewed write is pending or has succeeded
- **THEN** the conversation remains read and no duplicate write is issued

#### Scenario: Viewed write fails

- **WHEN** the viewed endpoint rejects a request
- **THEN** the indicator returns to unread without a request loop, and a later visit can retry

#### Scenario: Rapidly opening different run chats

- **WHEN** the user opens several run chats before their viewed writes finish
- **THEN** their indicators update immediately and writes are serialized within the provider

#### Scenario: Identity changes during discovery or persistence

- **WHEN** the authenticated identity changes while a list read, discovery retry, or viewed write is pending
- **THEN** old-user results cannot modify the new user's conversation state and remaining old-user discovery retries are cancelled

#### Scenario: Conversation list responses complete out of order

- **WHEN** an older list request completes after a newer request successfully updates the list
- **THEN** it cannot replace that snapshot or remove its newly discovered run conversation

#### Scenario: Newer overlapping list request fails

- **WHEN** one list request succeeds and a newer overlapping request fails, in either completion order
- **THEN** the successful snapshot remains eligible for display, including during initial loading and run-chat discovery
