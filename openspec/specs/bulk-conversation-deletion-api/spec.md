# Spec: bulk-conversation-deletion-api

## Purpose

Endpoints for deleting selected conversations and for clearing the entire user bucket, with typed partial-failure results.

## Requirements

---

### Requirement: POST /api/v1/conversation-deletions — delete selected owned conversations

The backend SHALL expose `POST /api/v1/conversation-deletions` in `apps/chat-api/src/conversations/conversation.controller.ts`. The handler MUST be named `deleteConversations` so the generator produces an identically-named SDK method. The controller MUST be versioned (`version: '1'`), annotated `@ApiTags('conversations')`, and delegate all logic to `ConversationService`.

Request body validated by `DeleteConversationsBodyDto`:

```ts
class DeleteConversationsBodyDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  ids: string[]; // DIAL Core resource URLs: "conversations/{bucket}/{path}"
}
```

Rate limiting: `@Throttle({ default: { limit: 5, ttl: 60000 } })` on the handler.

On success the handler returns HTTP 200 with `ConversationDeletionResultDto`:

```ts
class ConversationDeletionFailureDto {
  id: string;
  code: 'NOT_FOUND' | 'FORBIDDEN' | 'UPSTREAM_ERROR' | 'UNKNOWN';
}

class ConversationDeletionResultDto {
  requested: number;    // number of unique IDs in the request (after dedup)
  deleted: number;      // successfully deleted from DIAL Core
  alreadyAbsent: number; // IDs that returned 404 from DIAL Core (treated as success)
  failed: ConversationDeletionFailureDto[]; // per-item failures with stable code
}
```

The service SHALL:
1. Deduplicate `ids` via `new Set(ids)`.
2. For each unique ID, validate ownership: the ID MUST start with `conversations/{sessionBucket}/`. IDs that fail ownership validation collect immediately as `{ id, code: 'FORBIDDEN' }` without contacting DIAL Core.
3. For each owned ID, extract the bucket-relative path (everything after `conversations/{sessionBucket}/`) and call `client.deleteConversation(bucket, encodeDialResourcePath(path), { headers: getBearerAuthHeaders(token) })`.
4. All DIAL Core calls run concurrently via `Promise.allSettled`.
5. Classify each result per §10 of design.md.
6. For each successfully deleted conversation, fire a fire-and-forget call to remove the pin state.
7. Return `ConversationDeletionResultDto`. The service MUST NOT throw — all outcomes are encoded in the DTO.

HTTP 200 is returned even when every item failed. The caller inspects `failed` to determine per-item outcomes.

Generated-client impact:
- OpenAPI operationId: `deleteConversations`
- SDK method: `ConversationsApi.deleteConversations({ deleteConversationsBodyDto })`
- Response type: `ConversationDeletionResultDto`
- Frontend callers use the normal (non-Raw) generated method via `apps/chat/src/server-api/conversations.api.ts`

Error codes:
- `400 Bad Request` — `ids` is missing, empty array, exceeds 100, or any element is not a non-empty string
- `401 Unauthorized` — missing or invalid session
- `429 Too Many Requests` — rate limit exceeded
- `500 Internal Server Error` — unexpected error outside per-item handling

#### Scenario: All owned IDs deleted successfully

- **GIVEN** the user owns conversations `["conversations/b/id-1", "conversations/b/id-2"]`
- **WHEN** `POST /api/v1/conversation-deletions` is called with `{ "ids": ["conversations/b/id-1", "conversations/b/id-2"] }` and DIAL Core deletes both
- **THEN** the response is 200 with `{ requested: 2, deleted: 2, alreadyAbsent: 0, failed: [] }`

#### Scenario: Duplicate IDs are deduplicated before processing

- **GIVEN** the user owns conversation `"conversations/b/id-1"`
- **WHEN** `POST /api/v1/conversation-deletions` is called with `{ "ids": ["conversations/b/id-1", "conversations/b/id-2", "conversations/b/id-1"] }` (id-1 duplicated; id-2 already absent from DIAL Core)
- **THEN** the service deduplicates to 2 unique IDs; the response has `requested: 2`

#### Scenario: Already-absent IDs are treated as success

- **GIVEN** `"conversations/b/id-1"` no longer exists in DIAL Core (returns 404)
- **WHEN** `POST /api/v1/conversation-deletions` is called with `{ "ids": ["conversations/b/id-1"] }`
- **THEN** the response is 200 with `{ requested: 1, deleted: 0, alreadyAbsent: 1, failed: [] }`

#### Scenario: Retrying the same request is idempotent

- **GIVEN** a previous request deleted `"conversations/b/id-1"` successfully
- **WHEN** the same request is sent again
- **THEN** the response is 200 with `alreadyAbsent: 1` and `failed: []`

#### Scenario: Empty IDs array returns 400

- **WHEN** `POST /api/v1/conversation-deletions` is called with `{ "ids": [] }`
- **THEN** the response is 400 with a validation error referencing `ids`

#### Scenario: More than 100 IDs returns 400

- **WHEN** `POST /api/v1/conversation-deletions` is called with 101 IDs
- **THEN** the response is 400 with a validation error referencing `ids`

#### Scenario: Missing body returns 400

- **WHEN** `POST /api/v1/conversation-deletions` is called with no body
- **THEN** the response is 400

#### Scenario: Malformed IDs (non-string elements) returns 400

- **WHEN** `POST /api/v1/conversation-deletions` is called with `{ "ids": [123] }`
- **THEN** the response is 400 with a validation error

#### Scenario: IDs from another user's bucket are rejected as FORBIDDEN

- **GIVEN** the session bucket is `"my-bucket"` and the request contains `"conversations/other-bucket/id-1"`
- **WHEN** `POST /api/v1/conversation-deletions` is called
- **THEN** the response is 200 with `failed: [{ id: "conversations/other-bucket/id-1", code: "FORBIDDEN" }]` and no DIAL Core delete call is made for that ID

#### Scenario: Shared conversation IDs are rejected as FORBIDDEN

- **GIVEN** `"conversations/shared-bucket/id-1"` is shared with the user but not owned by them (different bucket)
- **WHEN** the user sends this ID in the request
- **THEN** the item appears in `failed` with `code: "FORBIDDEN"`

#### Scenario: Public conversation IDs are rejected as FORBIDDEN

- **GIVEN** `"conversations/public/id-1"` is a public conversation
- **WHEN** the session bucket is `"my-bucket"` and the user sends `"conversations/public/id-1"`
- **THEN** the item appears in `failed` with `code: "FORBIDDEN"`

#### Scenario: Partial upstream failure returns 200 with mixed result

- **GIVEN** the user owns `["conversations/b/id-1", "conversations/b/id-2"]` and DIAL Core deletes `id-1` but returns 5xx for `id-2`
- **WHEN** `POST /api/v1/conversation-deletions` is called with both IDs
- **THEN** the response is 200 with `{ requested: 2, deleted: 1, alreadyAbsent: 0, failed: [{ id: "conversations/b/id-2", code: "UPSTREAM_ERROR" }] }`

#### Scenario: Complete upstream failure returns 200 with all items failed

- **GIVEN** DIAL Core returns 5xx for every ID in the request
- **WHEN** `POST /api/v1/conversation-deletions` is called with 3 IDs
- **THEN** the response is 200 with `{ requested: 3, deleted: 0, alreadyAbsent: 0, failed: [<3 items with code UPSTREAM_ERROR>] }`

#### Scenario: Pin state is cleaned up for deleted conversations

- **GIVEN** `"conversations/b/id-1"` is successfully deleted from DIAL Core and was pinned
- **WHEN** `POST /api/v1/conversation-deletions` is called
- **THEN** `userConfigService.updatePin("conversations/b/id-1", false, ...)` is called (fire-and-forget; result does not affect the HTTP response)

#### Scenario: Rate limit is enforced

- **GIVEN** 5 requests have already been processed within the current 60-second window
- **WHEN** a 6th `POST /api/v1/conversation-deletions` is sent
- **THEN** the response is 429

#### Scenario: Raw DIAL Core error details are not exposed

- **GIVEN** DIAL Core returns an error response with a message containing bucket/token details
- **WHEN** the item lands in `failed`
- **THEN** the `ConversationDeletionFailureDto.code` is a stable application code (`UPSTREAM_ERROR`, `FORBIDDEN`, etc.) and no raw upstream message appears in the response body

---

### Requirement: POST /api/v1/conversation-deletions/all — delete every conversation in the user bucket

The backend SHALL expose `POST /api/v1/conversation-deletions/all`. The handler MUST be named `deleteAllConversations`. The endpoint requires explicit confirmation to prevent accidental collection deletion.

Request body validated by `DeleteAllConversationsBodyDto`:

```ts
class DeleteAllConversationsBodyDto {
  @IsBoolean()
  @Equals(true)
  confirm: boolean; // must be exactly `true`
}
```

Rate limiting: `@Throttle({ default: { limit: 2, ttl: 60000 } })` — more restrictive than the by-IDs endpoint because "delete all" triggers O(n) DIAL Core calls.

The service SHALL:
1. Call `client.getConversationMetadata(bucket, '', { headers, params: { query: { recursive: true, limit: 1000 } } })` and paginate until `nextToken` is exhausted.
2. Collect all non-FOLDER item IDs.
3. If the bucket is empty (0 IDs), return `{ requested: 0, deleted: 0, alreadyAbsent: 0, failed: [] }` immediately.
4. Otherwise, call `deleteConversations(ids, token, bucket)` and return its result.
5. If the metadata listing call fails (throws or returns an error response), throw `BadGatewayException` (or `ServiceUnavailableException` for network errors). The metadata listing MUST succeed for the operation to proceed.

On success returns HTTP 200 with `ConversationDeletionResultDto` (same DTO as by-IDs endpoint).

Generated-client impact:
- OpenAPI operationId: `deleteAllConversations`
- SDK method: `ConversationsApi.deleteAllConversations({ deleteAllConversationsBodyDto })`
- Response type: `ConversationDeletionResultDto`
- Frontend callers use the normal (non-Raw) generated method via `apps/chat/src/server-api/conversations.api.ts`

Error codes:
- `400 Bad Request` — `confirm` is missing, `false`, or not a boolean
- `401 Unauthorized` — missing or invalid session
- `429 Too Many Requests` — rate limit exceeded
- `502 Bad Gateway` — DIAL Core metadata listing returned a non-OK response
- `503 Service Unavailable` — DIAL Core unreachable during metadata listing
- `500 Internal Server Error` — unexpected error

#### Scenario: All conversations deleted when bucket is non-empty

- **GIVEN** the user has 3 conversations in their bucket
- **WHEN** `POST /api/v1/conversation-deletions/all` is called with `{ "confirm": true }` and DIAL Core deletes all 3
- **THEN** the response is 200 with `{ requested: 3, deleted: 3, alreadyAbsent: 0, failed: [] }`

#### Scenario: Empty bucket returns 200 with zero counts

- **GIVEN** the user's bucket contains no conversations
- **WHEN** `POST /api/v1/conversation-deletions/all` is called with `{ "confirm": true }`
- **THEN** the response is 200 with `{ requested: 0, deleted: 0, alreadyAbsent: 0, failed: [] }` and no delete calls are made

#### Scenario: confirm missing returns 400

- **WHEN** `POST /api/v1/conversation-deletions/all` is called with `{}`
- **THEN** the response is 400 with a validation error referencing `confirm`

#### Scenario: confirm false returns 400

- **WHEN** `POST /api/v1/conversation-deletions/all` is called with `{ "confirm": false }`
- **THEN** the response is 400

#### Scenario: Metadata listing failure returns 502

- **GIVEN** DIAL Core returns a 5xx when listing the user's bucket metadata
- **WHEN** `POST /api/v1/conversation-deletions/all` is called
- **THEN** the response is 502 and no delete calls are made

#### Scenario: Metadata listing unreachable returns 503

- **GIVEN** DIAL Core is unreachable (network timeout) during metadata listing
- **WHEN** `POST /api/v1/conversation-deletions/all` is called
- **THEN** the response is 503

#### Scenario: Partial upstream failure during all-delete returns 200 with mixed result

- **GIVEN** the bucket has 3 conversations and DIAL Core deletes 2 but returns 5xx for 1
- **WHEN** `POST /api/v1/conversation-deletions/all` is called
- **THEN** the response is 200 with `{ requested: 3, deleted: 2, alreadyAbsent: 0, failed: [{ code: "UPSTREAM_ERROR" }] }`

#### Scenario: Retrying all-delete on partially-cleared bucket

- **GIVEN** a first call deleted 5 of 8 conversations; 3 remain
- **WHEN** `POST /api/v1/conversation-deletions/all` is called again
- **THEN** only the 3 remaining conversations are listed and deleted; the previously-deleted 5 are no longer in the bucket and are not counted

#### Scenario: Pin state is cleaned up for all deleted conversations

- **GIVEN** 2 of the 3 conversations were pinned
- **WHEN** `POST /api/v1/conversation-deletions/all` is called and all 3 are deleted
- **THEN** `userConfigService.updatePin` is called for all 3 IDs (fire-and-forget; result does not affect the HTTP response)

#### Scenario: Rate limit is enforced

- **GIVEN** 2 requests have already been processed within the current 60-second window
- **WHEN** a 3rd `POST /api/v1/conversation-deletions/all` is sent
- **THEN** the response is 429

---

### Requirement: ConversationDeletionResultDto and failure DTOs carry Swagger annotations for strong generated types

`ConversationDeletionResultDto` and `ConversationDeletionFailureDto` SHALL have `@ApiProperty` or `@ApiPropertyOptional` decorators on every field, including `type` on the `failed` array field (`type: [ConversationDeletionFailureDto]`). The `@ApiResponse({ status: 200, type: ConversationDeletionResultDto })` annotation on both handlers SHALL reference the DTO class (not an inline schema) so the generator emits strongly-typed return types. No `any` may appear in the generated methods or request/response types outside of `runtime.ts`.

#### Scenario: Generated methods are strongly typed

- **WHEN** `npm run openapi` is run after both endpoints are added
- **THEN** `ConversationsApi.ts` contains `deleteConversations` and `deleteAllConversations` methods that return `Promise<ConversationDeletionResultDto>` (not `Promise<any>` or `Promise<void>`)

#### Scenario: openapi:check passes

- **WHEN** `npm run openapi:check` is run
- **THEN** the check exits 0 (no endpoint-level `any` detected)

---

### Requirement: Frontend wrappers in conversations.api.ts delegate to the generated client

`apps/chat/src/server-api/conversations.api.ts` SHALL export:
- `deleteConversations(ids: string[]): Promise<ConversationDeletionResultDto>` — delegates to `conversationsApi.deleteConversations({ deleteConversationsBodyDto: { ids } })`
- `deleteAllConversations(): Promise<ConversationDeletionResultDto>` — delegates to `conversationsApi.deleteAllConversations({ deleteAllConversationsBodyDto: { confirm: true } })`

Neither wrapper SHALL call `base.ts` helpers or construct `/api/v1/...` strings directly.

`apps/chat/src/server-api/api-client.ts` SHALL NOT change — the `conversationsApi` singleton already exists.

#### Scenario: deleteConversations wrapper delegates to generated client

- **WHEN** `deleteConversations(["conversations/b/id-1"])` is called from the frontend wrapper
- **THEN** `conversationsApi.deleteConversations({ deleteConversationsBodyDto: { ids: ["conversations/b/id-1"] } })` is called

#### Scenario: deleteAllConversations wrapper always sends confirm: true

- **WHEN** `deleteAllConversations()` is called
- **THEN** `conversationsApi.deleteAllConversations({ deleteAllConversationsBodyDto: { confirm: true } })` is called

#### Scenario: No new base.ts endpoint entry

- **WHEN** both wrappers are implemented
- **THEN** `apps/chat/src/server-api/base.ts` does not gain a new `CONVERSATION_DELETIONS` constant or `del()`/`post()` call for these endpoints

---

### Requirement: Controller integration tests cover both endpoints

Integration tests in `apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts` SHALL cover:

- `POST /api/v1/conversation-deletions` — 200 with valid body, 400 with empty array, 400 with array of 101 IDs, 400 with non-string element, 400 with missing body
- `POST /api/v1/conversation-deletions/all` — 200 with `{ confirm: true }`, 400 with `{ confirm: false }`, 400 with missing `confirm`

Tests follow the existing pattern: mock `ConversationService` via `{ provide: ConversationService, useValue: service }`, stub service methods with `vi.fn()`, and assert HTTP status codes and response body shapes.

#### Scenario: deleteConversations returns 200 with mocked result

- **GIVEN** the service mock returns `{ requested: 2, deleted: 2, alreadyAbsent: 0, failed: [] }`
- **WHEN** `POST /api/v1/conversation-deletions` is called with `{ "ids": ["conversations/b/id-1", "conversations/b/id-2"] }`
- **THEN** the response is 200 and the body matches the mocked result

#### Scenario: Empty ids array returns 400

- **WHEN** `POST /api/v1/conversation-deletions` is called with `{ "ids": [] }`
- **THEN** the response is 400 and the service is never called

#### Scenario: deleteAllConversations returns 200 with mocked result

- **GIVEN** the service mock returns `{ requested: 5, deleted: 5, alreadyAbsent: 0, failed: [] }`
- **WHEN** `POST /api/v1/conversation-deletions/all` is called with `{ "confirm": true }`
- **THEN** the response is 200 and the body matches the mocked result

#### Scenario: confirm false returns 400 and service is never called

- **WHEN** `POST /api/v1/conversation-deletions/all` is called with `{ "confirm": false }`
- **THEN** the response is 400 and the service mock is never called

---

### Requirement: ConversationLifecycleService unit tests cover deletion logic

Unit tests in `apps/chat-api/src/conversations/lifecycle/tests/conversation-lifecycle.service.spec.ts` SHALL cover the service deletion methods:

- `deleteConversations`: deduplication; ownership rejection (FORBIDDEN); DIAL Core 404 → alreadyAbsent; DIAL Core success → deleted; DIAL Core 5xx → UPSTREAM_ERROR in failed; mixed outcomes; fire-and-forget pin cleanup called for deleted IDs only
- `deleteAllConversations`: empty bucket returns zero counts immediately; non-empty bucket delegates to `deleteConversations`; metadata listing error throws BadGatewayException

#### Scenario: Service deduplicates before counting

- **GIVEN** `deleteConversations` is called with `["conversations/b/id-1", "conversations/b/id-1"]`
- **WHEN** DIAL Core deletes `id-1` successfully
- **THEN** `requested` is 1, `deleted` is 1

#### Scenario: Ownership validation rejects wrong-bucket IDs without DIAL Core call

- **GIVEN** the session bucket is `"b"` and the ID is `"conversations/other/id-1"`
- **WHEN** `deleteConversations` is called
- **THEN** `client.deleteConversation` is never called and `failed` contains `{ code: "FORBIDDEN" }`

#### Scenario: 404 from DIAL Core maps to alreadyAbsent

- **GIVEN** DIAL Core returns `{ error: { status: 404 } }` for `"conversations/b/id-1"`
- **WHEN** `deleteConversations` is called
- **THEN** `alreadyAbsent` is 1 and `failed` is empty

#### Scenario: Empty bucket in deleteAllConversations bypasses deletion

- **GIVEN** `client.getConversationMetadata` returns `{ items: [] }`
- **WHEN** `deleteAllConversations` is called
- **THEN** `client.deleteConversation` is never called and the result is `{ requested: 0, deleted: 0, alreadyAbsent: 0, failed: [] }`

#### Scenario: Metadata error in deleteAllConversations throws BadGatewayException

- **GIVEN** `client.getConversationMetadata` throws a network error
- **WHEN** `deleteAllConversations` is called
- **THEN** a `BadGatewayException` (or `ServiceUnavailableException` for timeout) is thrown, not a partial result

#### Scenario: Pin cleanup is not called for failed deletions

- **GIVEN** DIAL Core returns 5xx for `"conversations/b/id-1"`
- **WHEN** `deleteConversations` is called
- **THEN** `userConfigService.updatePin` is NOT called for that ID
