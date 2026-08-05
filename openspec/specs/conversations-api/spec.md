# Spec: conversations-api

## Purpose

Define the versioned conversation REST API, DIAL Core persistence contract, path handling, generated-client integration, and conversation lifecycle behavior used by the chat frontend.

## Requirements

### Requirement: POST /api/v1/conversations creates and persists a new conversation

The backend SHALL expose `POST /api/v1/conversations` in `apps/chat-api/src/conversations/conversation.controller.ts`. The controller MUST be versioned (`version: '1'`), annotated with `@ApiTags('conversations')`, and delegate all logic to `ConversationService`. The endpoint accepts a JSON body validated by `CreateConversationDto`. On success it returns HTTP 201 with the created `Conversation`. The service generates a UUID via `crypto.randomUUID()`, constructs a `Conversation` object using the provided `deploymentId` for `model.id` and `assistantModelId`, and persists it to DIAL Core via the SDK client.

Request body (`CreateConversationDto`):

```
{
  "firstMessage": "<string, @IsString, @MaxLength(4000)>",
  "deploymentId": "<string, @IsString, @MinLength(1), @MaxLength(256), @Matches(/^(?:[\w.\-:@/]|%[\dA-Fa-f]{2})+$/)>",
  "custom_content"?: "<MessageCustomContentDto, optional>"
}
```

`firstMessage` may be an empty string when `custom_content` carries `attachments`, `form_value`, or `configuration_value`; at least one of `firstMessage` (non-empty) or a non-empty `custom_content` field MUST be present (enforced by `@IsMessageOrAttachmentsPresent`).

Response body (201 Created) — shape matches the `Conversation` type from `@epam/ai-dial-chat-shared`:

```
{
  "id": "<folder/path>",
  "model": { "id": "<deploymentId>" },
  "messages": [...],
  "createdAt": "<ISO-8601>"
}
```

Rate limiting: `@Throttle({ default: { limit: 20, ttl: 60000 } })` on the handler — stricter than the global 100 req/min default.

Error codes:

- `400 Bad Request` — body fails DTO validation (both `firstMessage` and `custom_content` absent/empty, `firstMessage` exceeds 4000 chars, missing `deploymentId`, empty `deploymentId`, `deploymentId` exceeds 256 chars, `deploymentId` contains disallowed characters)
- `401 Unauthorized` — missing or invalid bearer token
- `500 Internal Server Error` — unexpected server-side failure

#### Scenario: Valid request returns 201 with conversation

- **WHEN** `POST /api/v1/conversations` is called with `{ "firstMessage": "Hello", "deploymentId": "anthropic.claude-v3-sonnet" }`
- **THEN** the response status is 201 and the body contains a `Conversation` with `model.id === "anthropic.claude-v3-sonnet"`, `messages` array with one user message, and an `id` string

#### Scenario: Empty firstMessage without custom_content returns 400

- **WHEN** `POST /api/v1/conversations` is called with `{ "firstMessage": "", "deploymentId": "dep-1" }` and no `custom_content`
- **THEN** the response status is 400 with a validation error message

#### Scenario: Empty firstMessage with attachments returns 201

- **WHEN** `POST /api/v1/conversations` is called with `{ "firstMessage": "", "deploymentId": "dep-1", "custom_content": { "attachments": [...] } }`
- **THEN** the response status is 201 (custom_content with attachments satisfies the validation)

#### Scenario: Missing firstMessage returns 400

- **WHEN** `POST /api/v1/conversations` is called with `{ "deploymentId": "dep-1" }` and no `custom_content`
- **THEN** the response status is 400

#### Scenario: firstMessage exceeding 4000 chars returns 400

- **WHEN** `POST /api/v1/conversations` is called with `firstMessage` of length 4001 and a valid `deploymentId`
- **THEN** the response status is 400

#### Scenario: Missing deploymentId returns 400

- **WHEN** `POST /api/v1/conversations` is called with `{ "firstMessage": "Hello" }` and no `deploymentId`
- **THEN** the response status is 400 with a validation error referencing `deploymentId`

#### Scenario: deploymentId with disallowed characters returns 400

- **WHEN** `POST /api/v1/conversations` is called with `deploymentId` containing characters outside `[\w.\-:@/]` or invalid percent-encoding (e.g. `"bad id!"`)
- **THEN** the response status is 400 with a validation error referencing `deploymentId`

---

### Requirement: Shared Conversation and Message types live in libs/chat-shared

The `Conversation` and `Message` interfaces SHALL be declared in `libs/chat-shared/src/models/chat.ts` and re-exported from `libs/chat-shared/src/index.ts`. Both `apps/chat` (via `@epam/ai-dial-chat-shared`) and `apps/chat-api` (same import) MUST import these types from the shared lib. No duplicate type definitions are permitted in app-level files.

#### Scenario: Shared types are importable in both apps

- **WHEN** `apps/chat` imports `Conversation` from `@epam/ai-dial-chat-shared`
- **THEN** TypeScript resolves the type without error

#### Scenario: Shared types are importable in chat-api

- **WHEN** `apps/chat-api` imports `Conversation` from `@epam/ai-dial-chat-shared`
- **THEN** TypeScript resolves the type without error

---

### Requirement: ConversationsModule is registered in the root AppModule

`ConversationsModule` SHALL be listed in the `imports` array of `apps/chat-api/src/app/app.module.ts`. It MUST declare `ConversationController` in its `controllers` array and `ConversationService` in its `providers` array.

#### Scenario: Module is wired into the app

- **WHEN** the NestJS application bootstraps
- **THEN** `POST /api/v1/conversations` is reachable and returns a response (not 404)

---

### Requirement: GET /api/v1/conversations fetches a conversation from the correct DIAL Core bucket

The backend SHALL expose `GET /api/v1/conversations` accepting a `path` query parameter (`@IsString @MinLength(1)`). The `path` encodes both the DIAL Core bucket and the resource name as `{bucket}/{conversationName}`. The service MUST extract the bucket as the first `/`-delimited segment and the resource name as the remainder, for ALL paths — including those that begin with a bucket that is neither the session bucket nor the public bucket.

If `path` contains no `/`, the session bucket is used as a fallback (backward-compatible with legacy callers that strip the bucket before sending). This allows users to open their own conversations, as well as public and shared conversations whose bucket differs from the session bucket.

```
path = "userBucket/gpt-4o__title"   →  getConversation("userBucket", "gpt-4o__title")
path = "public/gpt-4o__title"       →  getConversation("public", "gpt-4o__title")
path = "otherBucket/name"           →  getConversation("otherBucket", "name")
path = "name"                       →  getConversation(sessionBucket, "name")  [legacy]
```

DIAL Core's sharing mechanism grants READ access to the resource at its original path using the requesting user's auth token, so no special headers or bucket substitution are needed for shared or public conversations.

`resolveConversationLocation` in `ConversationService` is the single implementation point for this routing logic. It MUST NOT fall back to the session bucket when the first path segment is neither the session bucket nor `public` — it SHALL extract and use that segment as the target bucket.

**Frontend behaviour.** `GET /api/v1/conversations?path=...`'s `path` query param MUST include the bucket — unlike `saveConversation`'s/`streamCompletion`'s `path` body field, which is bucket-stripped and operates on the user's own copy only. Callers MUST apply the normalization matching the target endpoint's contract:

- For `saveConversation`, `streamCompletion`, `stopCompletion`, `deleteConversation`, `watchConversation`, `renameConversation`, `generateConversationTitle`, `duplicateConversation` (every endpoint whose contract is bucket-stripped): `apps/chat/src/utils/conversation-path.ts`'s `getConversationPath(conversationId)` strips the bucket prefix, then decodes the remainder with the shared `safeDecodeURIComponent` (`apps/chat/src/utils/string-utils.ts` — try/catch, fall back to the original string on failure).
- For every `getConversation` call site (`useConversationStream`'s post-stream/resume refresh, `ConversationsContext`'s `watchForDisplayNameUpdate`, `useConversationExport`'s `toApiConversationPath`): call `safeDecodeURIComponent` directly on the **full** id (bucket included, no stripping), since `GET /api/v1/conversations` needs the bucket to resolve the correct DIAL Core bucket per the routing table above. There is no dedicated helper for this — a bare `safeDecodeURIComponent(conversationId)` is the whole normalization; introducing a same-signature wrapper (e.g. a `normalizeConversationIdEncoding`) around it would only rename the call with no behavior difference. The `Conversation` page's initial load passes the route's already-decoded wildcard param directly, since the router performs the equivalent single decode.

**Why the decode step exists at all.** `POST /api/v1/conversations`'s `deploymentId` MUST be percent-encoded by the caller when it contains reserved characters (see the `DEPLOYMENT_ID_PATTERN` requirement above); the response `id` field is built by concatenating that (possibly percent-encoded) `deploymentId` directly with an otherwise-raw message-derived name and uuid, without decoding it first — so `conversation.id` can contain a percent-encoded fragment mixed with raw text. Every caller passes the normalized result into an API client that percent-encodes the whole value exactly once. Without the decode step, an already-encoded fragment gets double-encoded on the wire (e.g. `%20` → `%2520`) and DIAL Core rejects the request with 400 — this mirrors the backend's own `encodeDialResourcePath` (decode-then-encode) normalization used when persisting. Passing the bucket-**stripped** `getConversationPath` result to `getConversation` is an equally invalid variant of this bug: it 400s specifically for Quick App conversations, whose deployment-id segment (`applications/{bucket}/{appName}`) itself contains a slash, so DIAL Core resolves the wrong resource once the leading session-bucket segment is missing.

#### Scenario: getConversationPath decodes an already-percent-encoded deployment-id fragment

- **WHEN** `conversation.id` is `"bucket/applications/catalog/My%20App__0.0.1__Hello there__uuid"` (the deploymentId segment was percent-encoded at create time; the message-derived segment is raw)
- **THEN** `getConversationPath` returns `"applications/catalog/My App__0.0.1__Hello there__uuid"` (fully decoded, bucket stripped), for use with `saveConversation`/`streamCompletion`/etc.

#### Scenario: getConversationPath leaves genuinely raw text with a literal "%" unchanged

- **WHEN** `conversation.id` is `"bucket/gpt-4o__50% off__uuid"` (the `%` is not part of a valid percent-encoding triple)
- **THEN** `decodeURIComponent` throws internally and `getConversationPath` falls back to returning the path unchanged: `"gpt-4o__50% off__uuid"`

#### Scenario: safeDecodeURIComponent decodes the full id for getConversation, keeping the bucket

- **WHEN** `conversation.id` is `"bucket/applications/bucket/My%20App__0.0.1__Hello there__uuid"`
- **THEN** `safeDecodeURIComponent(conversation.id)` returns `"bucket/applications/bucket/My App__0.0.1__Hello there__uuid"` (fully decoded, bucket retained), so `GET /api/v1/conversations?path=...` both resolves the correct bucket and encodes the value exactly once

**Building the `/conversations/:id` browser route.** `apps/chat/src/constants/routes.ts`'s `getConversationRoute(id)` builds the client-side navigable URL from a `conversation.id` that may contain the same mixed-encoding pattern described above. It SHALL decode each `/`-delimited segment with the same safe `decodeURIComponent` before re-encoding it once with `encodeURIComponent`, rather than encoding the raw segment directly — a raw segment can already be percent-encoded (the deployment-id fragment), and encoding it a second time produces a double-encoded URL that the router's single automatic decode-on-navigation cannot undo, so the subsequent `GET /api/v1/conversations?path=...` request 400s.

#### Scenario: getConversationRoute decodes a segment before re-encoding it once

- **WHEN** `getConversationRoute` is called with `"tenant/applications/catalog/Team%2FApp%20One__0.0.1__title"`
- **THEN** it returns `"/conversations/tenant/applications/catalog/Team%2FApp%20One__0.0.1__title"` — the segment is decoded then re-encoded exactly once, not compounded into `Team%252FApp%2520One`

#### Scenario: Own conversation is fetched from the session bucket

- **WHEN** the URL param is `"userBucket/gpt-4o__title__uuid"` and the session bucket equals `"userBucket"`
- **THEN** the service calls `client.getConversation("userBucket", "gpt-4o__title__uuid")` and returns 200

#### Scenario: Public conversation is fetched from the public bucket

- **WHEN** the path is `"public/gpt-4o__title__uuid"`
- **THEN** the service calls `client.getConversation("public", "gpt-4o__title__uuid")` and returns 200

#### Scenario: Shared conversation is fetched from the originating bucket

- **WHEN** the path is `"otherUserBucket/gpt-4o__title__uuid"` and the user has been granted access via the sharing mechanism
- **THEN** the service calls `client.getConversation("otherUserBucket", "gpt-4o__title__uuid")` and returns 200

#### Scenario: Path with no slash falls back to session bucket

- **WHEN** the path is `"some-conversation-name"` with no `/`
- **THEN** the service calls `client.getConversation(sessionBucket, "some-conversation-name")` and returns 200

---

### Requirement: Scheduler-created conversations are detected from their DIAL Core resource path

`apps/chat-api/src/conversations/utils/parse-scheduled-task-conversation-path.ts` SHALL export a pure function `parseScheduledTaskConversationPath(resourceId: string): { scheduleId: string; runId: string } | null` with no dependency injection, logging, or DIAL Core client access.

A conversation resource id matches the scheduler pattern **iff** the `/`-delimited segment immediately following the bucket segment is the literal `.scheduler`, followed by exactly two further segments read as `scheduleId` and `runId` (an optional filename segment may follow and is ignored by this function).

The function SHALL:
1. Split the id into `/`-delimited segments.
2. Return `null` if the segment after the bucket is not exactly `.scheduler`.
3. Read the next two segments as candidate `scheduleId` and `runId`.
4. Decode each candidate with the existing `safeDecodeURIComponent` helper (`apps/chat-api` equivalent used elsewhere in this spec for path segments).
5. Validate each decoded candidate against `^[A-Za-z0-9_-]{1,128}$` (the same allowlist used by the scheduled-tasks BFF routes — see the [scheduled-tasks-api spec](../scheduled-tasks-api/spec.md)).
6. Return `{ scheduleId, runId }` only when both candidates pass validation; return `null` in every other case (missing segments, empty segments, decode failure, validation failure). The function MUST NOT throw.

#### Scenario: Valid scheduler path returns scheduleId and runId

- **WHEN** `parseScheduledTaskConversationPath("conversations/test-bucket/.scheduler/sched_abc/run_001/gpt-4o__Morning briefing__uuid")` is called
- **THEN** it returns `{ scheduleId: "sched_abc", runId: "run_001" }`

#### Scenario: Normal conversation path returns null

- **WHEN** `parseScheduledTaskConversationPath("conversations/test-bucket/gpt-4o__Morning briefing__uuid")` is called
- **THEN** it returns `null`

#### Scenario: Missing runId segment returns null

- **WHEN** `parseScheduledTaskConversationPath("conversations/test-bucket/.scheduler/sched_abc")` is called
- **THEN** it returns `null`

#### Scenario: scheduleId or runId failing the allowlist returns null

- **WHEN** `parseScheduledTaskConversationPath("conversations/test-bucket/.scheduler/sched abc!/run_001/title")` is called (scheduleId contains a space and `!`, outside `^[A-Za-z0-9_-]{1,128}$`)
- **THEN** it returns `null`

#### Scenario: URL-encoded ids are decoded before validation

- **WHEN** `parseScheduledTaskConversationPath("conversations/test-bucket/.scheduler/sched%5Fabc/run%5F001/title")` is called
- **THEN** it returns `{ scheduleId: "sched_abc", runId: "run_001" }`

---

### Requirement: GET /api/v1/conversations/list returns a merged list from the user bucket, public bucket, and shared resources

The backend SHALL expose `GET /api/v1/conversations/list` in `apps/chat-api/src/conversations/conversation.controller.ts`. The endpoint is backed by DIAL Core metadata and the DIAL Core sharing API (not an in-memory store). It accepts the following query parameters validated by `ListConversationsQueryDto`:

- `limit` — integer, default 100, max 1000 (`@IsInt @Min(1) @Max(1000) @IsOptional`)
- `nextToken` — opaque pagination cursor from a previous response (`@IsString @MaxLength(512) @IsOptional`)

On success the endpoint returns HTTP 200 with `ConversationListResponseDto`:

```ts
class ConversationListItemDto {
  id: string;               // Full DIAL Core resource URL (e.g. "conversations/bucket/model__title__uuid")
  title: string;            // Human-readable conversation title extracted from the resource name
  updatedAt: number;        // Unix epoch milliseconds of the last update
  sharedWithMe: boolean;    // True when the conversation was shared with the current user
  publishedWithMe: boolean; // True when this conversation is from the public bucket (organisation content)
  isPinned: boolean;        // True when the user has pinned this conversation
  isReadonly: boolean;      // True when the caller does not have WRITE permission on this exact resource
  isScheduledTask: boolean; // True when the resource path matches the .scheduler reserved-segment pattern
  scheduleId?: string;      // Present only when isScheduledTask === true; the scheduler task id from the path
  runId?: string;           // Present only when isScheduledTask === true; the scheduler run id from the path
}

class ConversationListResponseDto {
  items: ConversationListItemDto[];
  nextToken?: string; // Compound cursor for the next page; absent when no more results
}
```

**Three-way parallel fetch.** The service issues all of the following in a single `Promise.all`, always against the bucket root (recursive, no folder scoping):
1. `getConversationMetadata(bucket, '', { recursive: true, limit, token: userCursor })` — user's own conversations
2. `getConversationMetadata('public', '', { recursive: true, limit, token: publicCursor })` — organisation-published conversations
3. `getSharedResources({ body: { resourceTypes: ['CONVERSATION'], with: 'me' } })` — conversations shared directly with the user
4. `UserConfigService.getPinnedIds(token, bucket)` — pinned conversation IDs

Items from all three sources are merged and sorted by `updatedAt` descending. `FOLDER` items are filtered out from bucket results. The `getSharedResources` response does not include `updatedAt`; shared items default to `updatedAt: 0`.

**Ownership flags.** Items from the `'public'` bucket always have `publishedWithMe: true` forced, regardless of the DIAL Core flag value. Items from `getSharedResources` always have `sharedWithMe: true` forced. User-bucket items pass through the DIAL Core `sharedWithMe`/`publishedWithMe` flags unchanged.

**No personal/public merging.** The service SHALL NOT attempt to match or merge a user-bucket item with a public-bucket item, even when a personal conversation has been published and both a personal copy and a public copy exist. Each is returned as its own independent list item with its own `id`: the personal copy keeps its user-bucket `id`, real `isReadonly` (from DIAL Core permissions), and `publishedWithMe: false` (unless DIAL Core itself reports otherwise); the public copy is a separate entry with its own `conversations/public/...` id, `isReadonly: true`, and `publishedWithMe: true`. This guarantees any link built from a returned `id` (conversation open/navigation links, and share links created via `POST /api/v1/share`) always resolves to the bucket that specific item actually represents, and that the personal copy's pin status and permissions are never affected by publishing.

**Scheduler metadata.** For every merged item (from any of the three sources), the service SHALL call `parseScheduledTaskConversationPath(item.id)` (see the "Scheduler-created conversations are detected from their DIAL Core resource path" requirement above). When it returns a non-null result, the item SHALL have `isScheduledTask: true`, `scheduleId` and `runId` set from the result. When it returns `null`, the item SHALL have `isScheduledTask: false` with `scheduleId`/`runId` omitted. This detection is independent per item — a scheduler-created conversation that also happens to be shared or published is still tagged using its own resource id, not any other copy's id.

**Compound `nextToken`.** Pagination state is tracked independently for the user bucket and public bucket (the `getSharedResources` endpoint returns all results at once and has no cursor). The response `nextToken` format is `ct1.<base64url(JSON)>` where the JSON object has optional fields `u` (user-bucket cursor) and `p` (public-bucket cursor). An incoming token without the `ct1.` prefix is treated as a legacy user-only cursor. The response `nextToken` is omitted when neither paginated source has more results.

**Resilience.** If the public bucket or shared resources call fails (throws or returns an error response), the endpoint logs a warning and continues — it still returns results from the other sources. If the user bucket call fails, the endpoint returns the error to the client.

`isPinned` is populated by `UserConfigService.getPinnedIds` against the user's DIAL Core bucket. See the [user-config-api spec](../user-config-api/spec.md). Errors fall back to `[]`.

Rate limiting: global default applies (no handler-level `@Throttle` override).

Generated-client impact:
- OpenAPI operationId: `listConversations`
- SDK method: `ConversationsApi.listConversations({ limit?, nextToken? })`
- Response type: `ConversationListResponseDto` (regenerated to include `isScheduledTask`/`scheduleId`/`runId` on `ConversationListItemDto`)
- Frontend callers use the normal (non-Raw) generated method via `apps/chat/src/server-api/conversations.api.ts`

Error codes:
- `400 Bad Request` — invalid `limit` (out of range [1–1000] or non-integer) or `nextToken` exceeds 512 chars
- `401 Unauthorized` — missing or invalid bearer token
- `502 Bad Gateway` — user bucket DIAL Core returned an error response

#### Scenario: Returns merged items from user bucket, public bucket, and shared resources

- **WHEN** `GET /api/v1/conversations/list` is called and each source has one conversation
- **THEN** the response is 200 with `items` containing all three entries

#### Scenario: Public bucket items always have publishedWithMe: true

- **WHEN** the public bucket returns an item with `publishedWithMe` absent or `false`
- **THEN** the response item SHALL have `publishedWithMe: true`

#### Scenario: Shared resource items always have sharedWithMe: true

- **WHEN** `getSharedResources` returns a conversation
- **THEN** the response item SHALL have `sharedWithMe: true` and `publishedWithMe: false`

#### Scenario: getSharedResources is called with CONVERSATION filter

- **WHEN** `GET /api/v1/conversations/list` is called
- **THEN** the service calls `getSharedResources({ body: { resourceTypes: ['CONVERSATION'], with: 'me' } })`

#### Scenario: Items are sorted by updatedAt descending

- **WHEN** items from all three sources are merged
- **THEN** the response `items` array is ordered by `updatedAt` descending (newest first)

#### Scenario: Returns compound nextToken when either paginated bucket has more results

- **WHEN** `GET /api/v1/conversations/list?limit=2` is called and both the user and public buckets return a next-page cursor
- **THEN** the response `nextToken` starts with `ct1.` and decodes to an object with both `u` and `p` cursor fields

#### Scenario: nextToken omitted when no paginated source has more results

- **WHEN** both the user and public buckets return fewer items than the limit
- **THEN** the response `nextToken` is absent

#### Scenario: Public bucket failure is non-fatal

- **WHEN** the public bucket call fails (network error or error response)
- **THEN** the response is 200 with user-bucket and shared items; the public bucket error is logged as a warning

#### Scenario: Shared resources failure is non-fatal

- **WHEN** the `getSharedResources` call fails
- **THEN** the response is 200 with user-bucket and public-bucket items; the error is logged as a warning

#### Scenario: FOLDER items are excluded from the response

- **WHEN** DIAL Core returns a mix of file items and items with `nodeType === 'FOLDER'` from either bucket
- **THEN** only file items appear in the response `items` array

#### Scenario: Invalid limit returns 400

- **WHEN** `GET /api/v1/conversations/list?limit=1001` is called (exceeds max 1000)
- **THEN** the response is 400 with a validation error

#### Scenario: Published conversation's personal and public copies both appear as independent items

- **WHEN** a user-bucket item and a public-bucket item — the personal and published copies of the same conversation — are both returned by DIAL Core in the same `listConversations` call, regardless of whether their relative paths coincide
- **THEN** the response `items` array contains two entries: one with the user-bucket item's own `id`, real `isReadonly`, and `publishedWithMe: false`, and one with the public-bucket item's own `id` (`conversations/public/...`), `isReadonly: true`, and `publishedWithMe: true`
- **AND** neither item's `id`, `isReadonly`, or `isPinned` is altered because of the other item's existence

#### Scenario: Publishing a pinned personal conversation does not change its pin status

- **WHEN** a user has pinned their own conversation (its user-bucket `id` is in the pinned-ids set) and that same conversation has also been published to the public bucket
- **THEN** the response item with the user-bucket `id` has `isPinned: true`
- **AND** the response item with the public-bucket `id` has `isPinned: false` (pins are never applied to a `publishedWithMe: true` item unless its own id was explicitly pinned)

#### Scenario: Scheduler-created conversation is tagged with schedule and run ids

- **GIVEN** a user-bucket item with `id: "conversations/test-bucket/.scheduler/sched_abc/run_001/gpt-4o__Morning briefing__uuid"`
- **WHEN** `GET /api/v1/conversations/list` is called
- **THEN** the matching response item has `isScheduledTask: true`, `scheduleId: "sched_abc"`, `runId: "run_001"`

#### Scenario: Normal conversation has isScheduledTask false with no ids

- **GIVEN** a user-bucket item with `id: "conversations/test-bucket/gpt-4o__Morning briefing__uuid"`
- **WHEN** `GET /api/v1/conversations/list` is called
- **THEN** the matching response item has `isScheduledTask: false` and no `scheduleId`/`runId` fields

---

### Requirement: ConversationController has integration tests

Integration tests SHALL cover key endpoints using supertest in `apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts`. Tests MUST follow the established pattern (mock service via `{ provide: ConversationService, useValue: service }`) and use HTTP status codes and response body assertions rather than implementation-specific selectors.

#### Scenario: Integration test covers POST 201 and 400 paths

- **WHEN** the integration test suite for `ConversationController` runs
- **THEN** it covers: 201 with valid body, 400 with empty `firstMessage`, 400 with missing body

---

### Requirement: DELETE /api/v1/conversations cleans up pin state

When a conversation is deleted, `deleteConversation` SHALL fire a fire-and-forget call to `userConfigService.updatePin(id, false, ...)` to remove the deleted id from `user-config.json`. The cleanup is non-fatal — errors are logged but do not affect the 204 response to the client. The conversation id for cleanup is reconstructed as `conversations/${bucket}/${conversationPath}`.

See the [user-config-api spec](../user-config-api/spec.md) for `updatePin` semantics.

#### Scenario: Deleting a pinned conversation removes it from the pins list

- **WHEN** `DELETE /api/v1/conversations?path=...` is called for a pinned conversation
- **THEN** the conversation is deleted from DIAL Core and its id is removed from `user-config.json`

---

### Requirement: PATCH /api/v1/conversations renames a conversation without changing its DIAL Core path

The backend SHALL expose `PATCH /api/v1/conversations` in `apps/chat-api/src/conversations/conversation.controller.ts`. The endpoint accepts query parameter `path` (validated by `RenameConversationDto` — `@IsString @MinLength(1) @MaxLength(512)`) and a JSON body `RenameConversationBodyDto`:

```ts
class RenameConversationBodyDto {
  @IsString()
  @MinLength(1)
  @MaxUtf8ByteLength(255)
  newTitle: string;
}
```

The service method `renameConversation(path, newTitle, at, bucket)` SHALL preserve the conversation identity — it MUST NOT change the storage path or filename, and MUST NOT call `client.moveResource`. It SHALL:
1. Sanitise `newTitle` through `prepareEntityName` to strip disallowed characters and truncate to 255 UTF-8 bytes.
2. Load the stored conversation body at the given `path` and `bucket` (404 if it does not exist).
3. Persist the conversation at the **same** `path` with `name` set to the sanitised title and `llmNamingDone: true`, leaving all other fields (including the filename-derived id) unchanged.
4. Return `{ name: string }` — the sanitised stored display name.

Because the path is unchanged, the rename flow MUST NOT perform pin migration (`migratePin`) and MUST NOT run a post-move display-name sync (`syncStoredDisplayNameAfterPathRename`); both existed only to compensate for the previous path change and are removed from this flow.

Response body (200 OK):

```ts
class RenameConversationResponseDto {
  name: string;
}
```

Rate limiting: `@Throttle({ default: { limit: 20, ttl: 60000 } })` on the handler.

Generated-client impact:
- OpenAPI operationId: `renameConversation`
- SDK method: `ConversationsApi.renameConversation({ path, renameConversationBodyDto })`
- Response type: `RenameConversationResponseDto` (`{ name }`)
- Frontend callers use the normal (non-Raw) generated method via `apps/chat/src/server-api/conversations.api.ts`

Error codes:
- `400 Bad Request` — `path` or `newTitle` fails DTO validation
- `401 Unauthorized` — missing or invalid bearer token
- `404 Not Found` — source conversation does not exist in DIAL Core
- `502 Bad Gateway` — DIAL Core returned an unexpected error
- `503 Service Unavailable` — DIAL Core unreachable

#### Scenario: Valid request returns 200 with name and unchanged path

- **WHEN** `PATCH /api/v1/conversations?path=model__Old+Title__uuid` is called with body `{ "newTitle": "New Title" }`
- **THEN** the response status is 200 and the body is `{ "name": "New Title" }`
- **AND** the conversation remains stored at `model__Old Title__uuid` (path/id unchanged)

#### Scenario: Rename persists name and llmNamingDone at the same path

- **WHEN** a rename succeeds
- **THEN** the stored conversation body has `name` set to the sanitised title and `llmNamingDone: true`
- **AND** no `moveResource` call is made

#### Scenario: Empty newTitle returns 400

- **WHEN** `PATCH /api/v1/conversations?path=...` is called with body `{ "newTitle": "" }`
- **THEN** the response status is 400

#### Scenario: newTitle exceeding 255 UTF-8 bytes returns 400

- **WHEN** `PATCH /api/v1/conversations?path=...` is called with `newTitle` of 256 UTF-8 bytes
- **THEN** the response status is 400

#### Scenario: Non-existent source path returns 404

- **WHEN** the conversation at `path` does not exist in DIAL Core
- **THEN** the response status is 404

#### Scenario: Integration test covers PATCH 200 and 400 paths

- **WHEN** the integration test suite for `ConversationController` runs
- **THEN** it covers: 200 with valid path and newTitle (id unchanged), 400 with empty newTitle, 400 with missing path

---

### Requirement: POST /api/v1/conversations sets unsuffixed message-derived name

On `POST /api/v1/conversations`, `ConversationService.createConversation` SHALL set `conversation.name` to the base name from `getConversationName('New chat', firstMessage)` without calling `resolveUniqueConversationName`.

The service SHALL always persist the conversation at `{deploymentId}__{baseName}__{uuid}`, where `{uuid}` is freshly generated for this conversation, while keeping `conversation.name` as the unsuffixed base name. The UUID segment is unconditional: creation SHALL NOT perform a path-existence check for `{deploymentId}__{baseName}`. For versioned or multi-segment deployment IDs, the invariant is the trailing UUID rather than a fixed total number of `__`-separated segments. See the [auto-index-duplicate-names spec](../auto-index-duplicate-names/spec.md).

`llmNamingDone` SHALL NOT be set on create (field absent or false).

#### Scenario: Create returns unsuffixed name when duplicate title exists

- **GIVEN** a conversation with `name: "Hello"` already exists in the user's bucket
- **WHEN** `POST /api/v1/conversations` is called with `firstMessage: "Hello"`
- **THEN** the response body has `name: "Hello"` (not `"Hello 1"`)

#### Scenario: Create always returns a fresh UUID-suffixed id

- **WHEN** `POST /api/v1/conversations` is called twice with `deploymentId: "gpt-4o"` and `firstMessage: "Hello"`
- **THEN** both response ids match `{bucket}/gpt-4o__Hello__<uuid>`
- **AND** the two response ids are different
- **AND** `getConversationMetadata` is NOT called to check the unsuffixed path

#### Scenario: Create does not invoke LLM naming

- **GIVEN** `features.llmConversationNaming` is enabled
- **WHEN** `POST /api/v1/conversations` succeeds
- **THEN** no utility-model chat completion is requested during create

---

### Requirement: saveConversation may trigger backend-only LLM rename after first reply

`ConversationService.saveConversation` SHALL, after a successful DIAL Core persist, optionally invoke LLM conversation naming as defined in the [llm-conversation-naming spec](../llm-conversation-naming/spec.md).

The rename is fire-and-forget: the `saveConversation` response MUST return immediately with the conversation as saved, without waiting for the LLM or rename to complete.

No new HTTP endpoint is added for LLM naming.

#### Scenario: saveConversation response is not delayed by LLM

- **GIVEN** `features.llmConversationNaming` is enabled
- **WHEN** `saveConversation` persists the first assistant reply
- **THEN** the HTTP response is sent before the utility-model call completes

#### Scenario: Client discovers renamed title on subsequent fetch

- **GIVEN** LLM naming succeeds asynchronously after the first save
- **WHEN** the client later calls `GET /api/v1/conversations` or `GET /api/v1/conversations/:id`
- **THEN** the response reflects the updated `name` and `llmNamingDone: true`

---

### Requirement: saveConversation preserves LLM display name from stale client saves

Before persisting, `ConversationService.saveConversation` SHALL call `preserveLlmDisplayName`: when the stored conversation already has `llmNamingDone: true` and a non-empty `name`, the save body MUST keep that server `name` and `llmNamingDone: true` even if the client sent a stale message-derived title.

#### Scenario: Stale client save does not overwrite LLM title

- **GIVEN** DIAL Core stores `name: "Docker networking basics"` and `llmNamingDone: true`
- **WHEN** `saveConversation` is called with `name: "How do I..."` and `llmNamingDone` unset
- **THEN** the persisted body keeps `name: "Docker networking basics"` and `llmNamingDone: true`

---

### Requirement: Conversation list uses stored display name for writable items

`ConversationService.listConversations` SHALL enrich writable user-owned list items with `conversation.name` from `getConversation` when available, so list `title` reflects the stored display name (including LLM-renamed and manually-renamed titles), not only the filename-derived title.

The display-name resolution (`resolveListDisplayTitle`, also used by `getConversation`) SHALL treat a non-empty stored `name` as authoritative for the display title whenever the conversation is finally named (`llmNamingDone === true`), even when the filename-derived title diverges from `name`. A manual rename sets `llmNamingDone: true`, so a manually renamed conversation whose filename still encodes the old title SHALL display the new `name`. The prior heuristic that fell back to the filename-derived title when the stored `name` differed from the message-derived title MUST NOT override an authoritative stored `name`.

#### Scenario: List title reflects LLM-renamed display name

- **GIVEN** a conversation is stored at `gpt-4o__Hello__<uuid>` with `name: "Docker networking basics"` and `llmNamingDone: true`
- **WHEN** `GET /api/v1/conversations` is called
- **THEN** the matching list item `title` is `"Docker networking basics"`

#### Scenario: List title reflects manually-renamed display name when filename diverges

- **GIVEN** a conversation is stored at `gpt-4o__Old Title__<uuid>` with `name: "New Title"` and `llmNamingDone: true` after a manual rename
- **WHEN** `GET /api/v1/conversations` is called
- **THEN** the matching list item `title` is `"New Title"` (not the filename-derived `"Old Title"`)

#### Scenario: GET reflects manually-renamed display name when filename diverges

- **GIVEN** the same manually-renamed conversation
- **WHEN** `GET /api/v1/conversations/:id` is called for it
- **THEN** the returned display title is `"New Title"`
