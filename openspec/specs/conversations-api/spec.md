# Spec: conversations-api

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

**Frontend behaviour.** The `Conversation` page passes the full URL wildcard param (`{bucket}/{name}`) directly to `GET /api/v1/conversations?path=...` after `decodeURIComponent`. The same decoded path (with the bucket stripped) is used for `saveConversation` and `streamCompletion`, which operate on the user's own copy only.

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

### Requirement: GET /api/v1/conversations/list returns a merged list from the user bucket, public bucket, and shared resources

The backend SHALL expose `GET /api/v1/conversations/list` in `apps/chat-api/src/conversations/conversation.controller.ts`. The endpoint is backed by DIAL Core metadata and the DIAL Core sharing API (not an in-memory store). It accepts the following query parameters validated by `ListConversationsQueryDto`:

- `limit` — integer, default 100, max 1000 (`@IsInt @Min(1) @Max(1000) @IsOptional`)
- `nextToken` — opaque pagination cursor from a previous response (`@IsString @MaxLength(512) @IsOptional`)
- `path` — string subfolder path to scope the listing, default `''` (bucket root = "My Files") (`@IsString @MaxLength(512) @IsOptional`)

On success the endpoint returns HTTP 200 with `ConversationListResponseDto`:

```ts
class ConversationListItemDto {
  id: string;               // Full DIAL Core resource URL (e.g. "conversations/bucket/model__title__uuid")
  title: string;            // Human-readable conversation title extracted from the resource name
  updatedAt: number;        // Unix epoch milliseconds of the last update
  sharedWithMe: boolean;    // True when the conversation was shared with the current user
  publishedWithMe: boolean; // True when this conversation is from the public bucket (organisation content)
  isPinned: boolean;        // True when the user has pinned this conversation
}

class ConversationListResponseDto {
  items: ConversationListItemDto[];
  nextToken?: string; // Compound cursor for the next page; absent when no more results
}
```

**Three-way parallel fetch.** The service issues all of the following in a single `Promise.all`:
1. `getConversationMetadata(bucket, path, { recursive: true, limit, token: userCursor })` — user's own conversations
2. `getConversationMetadata('public', path, { recursive: true, limit, token: publicCursor })` — organisation-published conversations
3. `getSharedResources({ body: { resourceTypes: ['CONVERSATION'], with: 'me' } })` — conversations shared directly with the user
4. `UserConfigService.getPinnedIds(token, bucket)` — pinned conversation IDs

Items from all three sources are merged and sorted by `updatedAt` descending. `FOLDER` items are filtered out from bucket results. The `getSharedResources` response does not include `updatedAt`; shared items default to `updatedAt: 0`.

**Ownership flags.** Items from the `'public'` bucket always have `publishedWithMe: true` forced, regardless of the DIAL Core flag value. Items from `getSharedResources` always have `sharedWithMe: true` forced. User-bucket items pass through the DIAL Core `sharedWithMe`/`publishedWithMe` flags unchanged.

**Compound `nextToken`.** Pagination state is tracked independently for the user bucket and public bucket (the `getSharedResources` endpoint returns all results at once and has no cursor). The response `nextToken` format is `ct1.<base64url(JSON)>` where the JSON object has optional fields `u` (user-bucket cursor) and `p` (public-bucket cursor). An incoming token without the `ct1.` prefix is treated as a legacy user-only cursor. The response `nextToken` is omitted when neither paginated source has more results.

**Resilience.** If the public bucket or shared resources call fails (throws or returns an error response), the endpoint logs a warning and continues — it still returns results from the other sources. If the user bucket call fails, the endpoint returns the error to the client.

`isPinned` is populated by `UserConfigService.getPinnedIds` against the user's DIAL Core bucket. See the [user-config-api spec](../user-config-api/spec.md). Errors fall back to `[]`.

Rate limiting: global default applies (no handler-level `@Throttle` override).

Generated-client impact:
- OpenAPI operationId: `listConversations`
- SDK method: `ConversationsApi.listConversations({ limit?, nextToken?, path? })`
- Response type: `ConversationListResponseDto`
- Frontend callers use the normal (non-Raw) generated method via `apps/chat/src/server-api/conversations.api.ts`

Error codes:
- `400 Bad Request` — invalid `limit` (out of range [1–1000] or non-integer), `nextToken` or `path` exceeds 512 chars
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

#### Scenario: path scopes both metadata queries

- **WHEN** `GET /api/v1/conversations/list?path=work%2Fproject-x` is called
- **THEN** the service calls `getConversationMetadata(bucket, 'work/project-x', ...)` AND `getConversationMetadata('public', 'work/project-x', ...)` and returns only conversations under that path

#### Scenario: Invalid limit returns 400

- **WHEN** `GET /api/v1/conversations/list?limit=1001` is called (exceeds max 1000)
- **THEN** the response is 400 with a validation error

---

### Requirement: ConversationController has integration tests

Integration tests SHALL cover key endpoints using supertest in `apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts`. Tests MUST follow the established pattern (mock service via `{ provide: ConversationService, useValue: service }`) and use HTTP status codes and response body assertions rather than implementation-specific selectors.

#### Scenario: Integration test covers POST 201 and 400 paths

- **WHEN** the integration test suite for `ConversationController` runs
- **THEN** it covers: 201 with valid body, 400 with empty `firstMessage`, 400 with missing body

#### Scenario: Integration test covers GET /list path parameter

- **WHEN** `GET /api/v1/conversations/list?path=work` is called
- **THEN** the service is called with `path: 'work'` forwarded as the DIAL Core folder argument

---

### Requirement: DELETE /api/v1/conversations cleans up pin state

When a conversation is deleted, `deleteConversation` fires a fire-and-forget call to `userConfigService.updatePin(id, false, ...)` to remove the deleted id from `user-config.json`. The cleanup is non-fatal — errors are logged but do not affect the 204 response to the client. The conversation id for cleanup is reconstructed as `conversations/${bucket}/${conversationPath}`.

See the [user-config-api spec](../user-config-api/spec.md) for `updatePin` semantics.

#### Scenario: Deleting a pinned conversation removes it from the pins list

- **WHEN** `DELETE /api/v1/conversations?path=...` is called for a pinned conversation
- **THEN** the conversation is deleted from DIAL Core and its id is removed from `user-config.json`

---

### Requirement: PATCH /api/v1/conversations renames a conversation by moving it to a new DIAL Core path

The backend SHALL expose `PATCH /api/v1/conversations` in `apps/chat-api/src/conversations/conversation.controller.ts`. The endpoint accepts query parameter `path` (validated by `RenameConversationDto` — `@IsString @MinLength(1) @MaxLength(512)`) and a JSON body `RenameConversationBodyDto`:

```ts
class RenameConversationBodyDto {
  @IsString()
  @MinLength(1)
  @MaxUtf8ByteLength(255)
  newTitle: string;
}
```

The service method `renameConversation(path, newTitle, at, bucket)` SHALL:
1. Sanitise `newTitle` through `prepareEntityName` to strip disallowed characters and truncate to 255 UTF-8 bytes.
2. Construct `sourceUrl` as the full DIAL Core resource URL for the given `path` and `bucket`.
3. Replace the title segment (middle `__`-delimited part) of the filename to produce `destinationUrl`.
4. Call `client.moveResource({ sourceUrl, destinationUrl, overwrite: false })`.
5. Return `{ newPath: string }` — the relative path portion of `destinationUrl` (i.e., the part after the bucket prefix), which the frontend uses to update its local conversation id.

Response body (200 OK):

```ts
class RenameConversationResponseDto {
  newPath: string;
}
```

Rate limiting: `@Throttle({ default: { limit: 20, ttl: 60000 } })` on the handler.

Generated-client impact:
- OpenAPI operationId: `renameConversation`
- SDK method: `ConversationsApi.renameConversation({ path, renameConversationBodyDto })`
- Response type: `RenameConversationResponseDto`
- Frontend callers use the normal (non-Raw) generated method via `apps/chat/src/server-api/conversations.api.ts`

Error codes:
- `400 Bad Request` — `path` or `newTitle` fails DTO validation
- `401 Unauthorized` — missing or invalid bearer token
- `404 Not Found` — source conversation does not exist in DIAL Core
- `409 Conflict` — destination path already exists (DIAL Core 4xx when `overwrite=false`)
- `502 Bad Gateway` — DIAL Core returned an unexpected error
- `503 Service Unavailable` — DIAL Core unreachable

#### Scenario: Valid request returns 200 with newPath

- **WHEN** `PATCH /api/v1/conversations?path=model__Old+Title__uuid` is called with body `{ "newTitle": "New Title" }`
- **THEN** the response status is 200 and the body contains `{ "newPath": "conversations/bucket/model__New Title__uuid" }`

#### Scenario: Empty newTitle returns 400

- **WHEN** `PATCH /api/v1/conversations?path=...` is called with body `{ "newTitle": "" }`
- **THEN** the response status is 400

#### Scenario: newTitle exceeding 255 UTF-8 bytes returns 400

- **WHEN** `PATCH /api/v1/conversations?path=...` is called with `newTitle` of 256 UTF-8 bytes
- **THEN** the response status is 400

#### Scenario: Non-existent source path returns 404

- **WHEN** DIAL Core returns a 4xx for `moveResource` indicating the source does not exist
- **THEN** the response status is 404

#### Scenario: Integration test covers PATCH 200 and 400 paths

- **WHEN** the integration test suite for `ConversationController` runs
- **THEN** it covers: 200 with valid path and newTitle, 400 with empty newTitle, 400 with missing path

---

### Requirement: POST /api/v1/conversations sets unsuffixed message-derived name

On `POST /api/v1/conversations`, `ConversationService.createConversation` SHALL set `conversation.name` to the base name from `getConversationName('New chat', firstMessage)` without calling `resolveUniqueConversationName`.

When the 2-part storage path `{deploymentId}__{baseName}` collides with an existing resource, the service SHALL persist at `{deploymentId}__{baseName}__{uuid}` while keeping `conversation.name` as the unsuffixed base name. See the [auto-index-duplicate-names spec](../auto-index-duplicate-names/spec.md).

`llmNamingDone` SHALL NOT be set on create (field absent or false).

#### Scenario: Create returns unsuffixed name when duplicate title exists

- **GIVEN** a conversation with `name: "Hello"` already exists in the user's bucket
- **WHEN** `POST /api/v1/conversations` is called with `firstMessage: "Hello"`
- **THEN** the response body has `name: "Hello"` (not `"Hello 1"`)

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

`ConversationService.listConversations` SHALL enrich writable user-owned list items with `conversation.name` from `getConversation` when available, so list `title` reflects the stored display name (including LLM-renamed titles), not only the filename-derived title.

#### Scenario: List title reflects LLM-renamed display name

- **GIVEN** a conversation is stored at `gpt-4o__Hello__<uuid>` with `name: "Docker networking basics"`
- **WHEN** `GET /api/v1/conversations` is called
- **THEN** the matching list item `title` is `"Docker networking basics"`
