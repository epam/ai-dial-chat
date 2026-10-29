## MODIFIED Requirements

### Requirement: PATCH /api/v1/conversations/viewed marks a conversation as viewed

The backend SHALL expose `PATCH /api/v1/conversations/viewed` in `apps/chat-api/src/conversations/conversation.controller.ts`, identifying the conversation via the same `path` query param convention already used by every other by-resource operation in this controller (`ConversationPathDto` — see `GET`, `PUT`, `PATCH` rename, `DELETE`), versioned (`version: '1'`), annotated with `@ApiTags('conversations')`. The handler requires no request body. `ConversationService.markConversationViewed(path, token, bucket)` resolves the relative `path` to the full DIAL Core resource id via `buildConversationUrl(bucket, path)` (matching the `id` format used in `ConversationListItemDto`) before delegating to `ScheduledTaskUnreadService.markViewed(fullId, token, bucket)`. A path that matches the scheduler run pattern is recorded in `.client_data/.viewed-scheduled-task-conversations.json`; any other path is recorded in `.client_data/.viewed-conversations.json` (see the `regular-conversation-read-state` spec). Either way the response and idempotency contract are identical. On success it returns HTTP 204 with no body. The endpoint SHALL be idempotent — calling it multiple times for the same path has the same effect as calling it once.

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

#### Scenario: Marking a regular chat viewed records it in the regular-chat file

- **WHEN** `PATCH /api/v1/conversations/viewed?path=gpt-4__My%20chat__uuid` is called for a path that is not a scheduler run
- **THEN** the response status is 204, its id is in `.client_data/.viewed-conversations.json`, and the scheduler viewed-ids file is not modified

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

### Requirement: Viewed state remains consistent across navigation and overlapping requests

The always-mounted `useActiveConversationSync` SHALL invoke the app-owned viewed callback when the active conversation's matching identity becomes available, using canonical id matching. This SHALL cover task History, sources History, the conversation panel, and direct URLs, including when the panel is closed. The shared hook SHALL receive matching and persistence behavior through injected callbacks; host routes, auth, and persistence SHALL remain app-owned.

`ConversationsContext` SHALL optimistically clear only the viewed chat's unread flag, deduplicate simultaneous views, and serialize writes within the provider. For scheduled-task runs, pending and successfully viewed canonical ids SHALL override stale unread list snapshots for the current user, and a failed write SHALL restore unread state without automatically retrying on list updates; leaving and revisiting the chat SHALL allow another attempt. For regular chats a local view is not monotonic, because a new answer makes the same chat unread again: a regular chat's local view SHALL NOT be remembered across list snapshots, and a failed write SHALL leave it read locally so the next list that still reports it unread retries once. Identity changes SHALL reset local tracking and retire previous-user asynchronous results. Serialization is scoped to one provider, not an atomicity guarantee across tabs or server instances.

List loading and refresh SHALL reject responses older than the last successfully applied request. Merely starting or failing a newer request SHALL NOT invalidate an older successful response.

#### Scenario: Open a run through any navigation entry point

- **WHEN** a run conversation becomes active and its matching list metadata is available, including after delayed loading or with the panel closed
- **THEN** only that chat is marked viewed and its indicators become read in every shared view

#### Scenario: Stale list response follows a viewed write

- **WHEN** a list response still says unread while a viewed write is pending or has succeeded
- **THEN** the conversation remains read and no duplicate write is issued

#### Scenario: A regular chat turns unread again after a new answer

- **GIVEN** a regular chat was marked viewed earlier in the session
- **WHEN** a later list response reports it unread again
- **THEN** the chat shows as unread and is not suppressed by the earlier local view

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
