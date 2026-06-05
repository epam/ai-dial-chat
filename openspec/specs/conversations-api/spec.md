# Spec: conversations-api

## Requirements

### Requirement: POST /api/v1/conversations creates and persists a new conversation

The backend SHALL expose `POST /api/v1/conversations` in `apps/chat-api/src/conversations/conversation.controller.ts`. The controller MUST be versioned (`version: '1'`), annotated with `@ApiTags('conversations')`, and delegate all logic to `ConversationService`. The endpoint accepts a JSON body validated by `CreateConversationDto`. On success it returns HTTP 201 with the created `Conversation`. The service generates a UUID via `crypto.randomUUID()`, constructs a `Conversation` object, and persists it to DIAL Core via the SDK client.

Request body (`CreateConversationDto`):

```
{ "firstMessage": "<string, @IsString, @MinLength(1), @MaxLength(4000)>", "deploymentId": "<string>" }
```

Response body (201 Created) — shape matches the `Conversation` type from `@epam/ai-dial-chat-shared`.

Rate limiting: `@Throttle({ default: { limit: 20, ttl: 60000 } })` on the handler — stricter than the global 100 req/min default.

Error codes:

- `400 Bad Request` — body fails DTO validation (empty `firstMessage`, exceeds 4000 chars)
- `401 Unauthorized` — missing or invalid bearer token
- `502 Bad Gateway` — DIAL Core returned an error response
- `503 Service Unavailable` — DIAL Core unreachable

#### Scenario: Valid request returns 201 with conversation

- **WHEN** `POST /api/v1/conversations` is called with `{ "firstMessage": "Hello", "deploymentId": "gpt-4o" }`
- **THEN** the response status is 201 and the body contains a `Conversation` with `id` and `messages` array

#### Scenario: Empty firstMessage returns 400

- **WHEN** `POST /api/v1/conversations` is called with `{ "firstMessage": "", "deploymentId": "gpt-4o" }`
- **THEN** the response status is 400 with a validation error message

#### Scenario: Missing firstMessage returns 400

- **WHEN** `POST /api/v1/conversations` is called with an empty body `{}`
- **THEN** the response status is 400

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

### Requirement: GET /api/v1/conversations/list returns a cursor-paginated list of conversation metadata

The backend SHALL expose `GET /api/v1/conversations/list` in `apps/chat-api/src/conversations/conversation.controller.ts`. The endpoint is backed by DIAL Core metadata (not an in-memory store). It accepts the following query parameters validated by `ListConversationsQueryDto`:

- `limit` — integer, default 20, max 100 (`@IsInt @Min(1) @Max(100) @IsOptional`)
- `nextToken` — string cursor from a previous response, passed through to DIAL Core (`@IsString @MaxLength(512) @IsOptional`)
- `path` — string subfolder path to scope the listing, default `''` (bucket root = "My Files") (`@IsString @MaxLength(512) @IsOptional`)

On success the endpoint returns HTTP 200 with `ConversationListResponseDto`:

```ts
class ConversationListItemDto {
  id: string;               // Full DIAL Core resource URL (e.g. "conversations/bucket/model__title__uuid")
  title: string;            // Human-readable conversation title extracted from the resource name
  updatedAt: number;        // Unix epoch milliseconds of the last update
  sharedWithMe: boolean;    // True when another user shared this conversation with the current user
  publishedWithMe: boolean; // True when this conversation is published to the organisation
  isPinned: boolean;        // True when the user has pinned this conversation
}

class ConversationListResponseDto {
  items: ConversationListItemDto[];
  nextToken?: string; // Cursor for the next page; absent when no more results
}
```

`isPinned` is populated by calling `UserConfigService.getPinnedIds` in parallel with the metadata call (`Promise.all`). That service reads `user-config.json` from the user's DIAL Core bucket; see the [user-config-api spec](../user-config-api/spec.md) for the full file format. The read falls back to `[]` on any error so a missing file never breaks the list response.

The service calls `client.getConversationMetadata(bucket, path ?? '', { query: { recursive: true, limit, token: nextToken } })` and filters out items with `nodeType === 'FOLDER'`.

Rate limiting: `@Throttle({ default: { limit: 30, ttl: 60000 } })` on the handler.

Generated-client impact:
- OpenAPI operationId: `listConversations`
- SDK method: `ConversationsApi.listConversations({ limit?, nextToken?, path? })`
- Response type: `ConversationListResponseDto`
- Frontend callers use the normal (non-Raw) generated method via `apps/chat/src/server-api/conversations.api.ts`

Error codes:
- `400 Bad Request` — invalid `limit` (out of range or non-integer), `nextToken` or `path` exceeds 512 chars
- `401 Unauthorized` — missing or invalid bearer token
- `502 Bad Gateway` — DIAL Core returned an error response

#### Scenario: Returns paginated items with nextToken cursor

- **WHEN** `GET /api/v1/conversations/list?limit=2` is called and DIAL Core returns 3 conversations
- **THEN** the response is 200 with `items` containing 2 entries and a non-empty `nextToken`

#### Scenario: Last page has no nextToken

- **WHEN** `GET /api/v1/conversations/list` is called and DIAL Core returns fewer items than the limit
- **THEN** the response is 200 with `items` and `nextToken` is absent from the response body

#### Scenario: FOLDER items are excluded from the response

- **WHEN** DIAL Core returns a mix of file items and items with `nodeType === 'FOLDER'`
- **THEN** only file items appear in the response `items` array

#### Scenario: path scopes the DIAL Core query

- **WHEN** `GET /api/v1/conversations/list?path=work%2Fproject-x` is called
- **THEN** the service calls `getConversationMetadata(bucket, 'work/project-x', ...)` and returns only conversations under that path

#### Scenario: path omitted returns root listing

- **WHEN** `GET /api/v1/conversations/list` is called without a `path` parameter
- **THEN** the service queries DIAL Core with an empty path (bucket root) and returns all conversations

#### Scenario: Invalid limit returns 400

- **WHEN** `GET /api/v1/conversations/list?limit=200` is called (exceeds max 100)
- **THEN** the response is 400 with a validation error

---

### Requirement: ConversationController has integration tests

Integration tests SHALL cover key endpoints using supertest in `apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts`. Tests MUST follow the established pattern (mock service via `{ provide: ConversationService, useValue: service }`). No `data-testid` attributes; use HTTP status codes and response body assertions.

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
