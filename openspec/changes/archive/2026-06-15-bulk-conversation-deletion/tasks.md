# Tasks: bulk-conversation-deletion

## 1. Backend — DTOs

- [x] 1.1 Create `apps/chat-api/src/conversations/dto/delete-conversations.dto.ts` with:
  - `ConversationDeletionFailureDto` (`id: string`, `code: string` enum `NOT_FOUND | FORBIDDEN | UPSTREAM_ERROR | UNKNOWN`) — `@ApiProperty` on both fields
  - `ConversationDeletionResultDto` (`requested: number`, `deleted: number`, `alreadyAbsent: number`, `failed: ConversationDeletionFailureDto[]`) — `@ApiProperty` on all fields; `type: [ConversationDeletionFailureDto]` on `failed`
  - All fields use `class-validator` decorators; the DTO is a proper class (not an interface) so Swagger runtime metadata is emitted

- [x] 1.2 Create `apps/chat-api/src/conversations/dto/delete-conversations-body.dto.ts` with `DeleteConversationsBodyDto`:
  - `ids: string[]` with `@IsArray()`, `@ArrayMinSize(1)`, `@ArrayMaxSize(100)`, `@IsString({ each: true })`, `@MinLength(1, { each: true })`
  - `@ApiProperty({ type: [String], minItems: 1, maxItems: 100, description: '...' })`

- [x] 1.3 Create `apps/chat-api/src/conversations/dto/delete-all-conversations-body.dto.ts` with `DeleteAllConversationsBodyDto`:
  - `confirm: boolean` with `@IsBoolean()`, `@Equals(true)`
  - `@ApiProperty({ example: true, description: '...' })`

- [x] 1.4 Run `npm exec nx typecheck chat-api` — no errors

## 2. Backend — Service

- [x] 2.1 Add private helper `isOwnedBySessionBucket(id: string, sessionBucket: string): boolean` to `ConversationService` in `apps/chat-api/src/conversations/conversation.service.ts`. The ID is a DIAL Core resource URL (`conversations/{bucket}/{path}`); the helper checks `id.startsWith('conversations/' + sessionBucket + '/')`.

- [x] 2.2 Add `async deleteConversations(ids: string[], token: string, bucket: string): Promise<ConversationDeletionResultDto>` to `ConversationService`:
  - Deduplicate `ids` with `new Set(ids)`
  - Validate ownership for each ID; collect ownership failures as `{ id, code: 'FORBIDDEN' }` immediately
  - Call `this.client.deleteConversation(bucket, encodeDialResourcePath(path), { headers: getBearerAuthHeaders(token) })` per owned ID using `Promise.allSettled` for concurrency
  - Classify each settled result: `error == null` → `deleted++`, DIAL Core 404 → `alreadyAbsent++`, 403 → `FORBIDDEN` in `failed`, other errors → `UPSTREAM_ERROR` in `failed` with `logger.error(msg, error.stack)` (no conversation IDs, bucket names, or tokens in the log message), unexpected shape → `UNKNOWN` in `failed` with `logger.error`
  - For each deleted ID fire `void this.pinConversation(id, false, token, bucket).catch((err) => this.logger.error('Failed to clean up pin on bulk delete', err))`  where `id` is the full resource URL (`conversations/{bucket}/{path}`)
  - Return `ConversationDeletionResultDto` — **never throw**

- [x] 2.3 Add `async deleteAllConversations(token: string, bucket: string): Promise<ConversationDeletionResultDto>` to `ConversationService`:
  - Paginate `this.client.getConversationMetadata(bucket, '', { headers: getBearerAuthHeaders(token), params: { query: { recursive: true, limit: 1000, ...(cursor ? { token: cursor } : {}) } } })` until `nextToken` is exhausted; collect non-FOLDER item IDs
  - If the metadata call throws or returns `error != null`, throw `BadGatewayException` (network timeout → `ServiceUnavailableException`); log with `logger.error` before throwing
  - If collected IDs count is 0, return `{ requested: 0, deleted: 0, alreadyAbsent: 0, failed: [] }` immediately without calling `deleteConversations`
  - Otherwise delegate to `this.deleteConversations(ids, token, bucket)` and return its result

- [x] 2.4 Run `npm exec nx typecheck chat-api` — no errors
- [x] 2.5 Run `npm exec nx lint chat-api` — no errors

## 3. Backend — Controller

- [x] 3.1 Add handler `deleteConversations` to `ConversationController` in `apps/chat-api/src/conversations/conversation.controller.ts`:
  - `@Post('deletions')`, `@HttpCode(200)`, `@Throttle({ default: { limit: 5, ttl: 60000 } })`
  - `@ApiOperation({ operationId: 'deleteConversations', summary: 'Delete selected conversations', description: '...' })`
  - `@ApiResponse({ status: 200, description: 'Deletion result', type: ConversationDeletionResultDto })`
  - `@ApiResponse` for 400, 401, 429, 500
  - Extracts `{ at, bucket }` from `req.user as SessionUser`; delegates to `this.conversationService.deleteConversations(body.ids, at, bucket)`

- [x] 3.2 Add handler `deleteAllConversations` to `ConversationController`:
  - `@Post('deletions/all')`, `@HttpCode(200)`, `@Throttle({ default: { limit: 2, ttl: 60000 } })`
  - `@ApiOperation({ operationId: 'deleteAllConversations', summary: 'Delete all conversations in the user bucket', description: '...' })`
  - `@ApiResponse({ status: 200, description: 'Deletion result', type: ConversationDeletionResultDto })`
  - `@ApiResponse` for 400, 401, 429, 502, 503, 500
  - Extracts `{ at, bucket }` from `req.user as SessionUser`; delegates to `this.conversationService.deleteAllConversations(at, bucket)`

- [x] 3.3 Run `npm exec nx typecheck chat-api` — no errors
- [x] 3.4 Run `npm exec nx lint chat-api` — no errors

## 4. Backend — Service unit tests

- [x] 4.1 Update `apps/chat-api/src/conversations/tests/conversation.service.spec.ts` with unit tests for the new service methods. Each test uses `@nestjs/testing`'s `TestingModule`; `client.deleteConversation` and `client.getConversationMetadata` are mocked via `vi.fn()`. Cover:
  - `deleteConversations` — deduplication (2 identical IDs → `requested: 1`); ownership check rejects wrong-bucket ID with `FORBIDDEN`, never calls `client.deleteConversation` for it; DIAL Core `{ error: null }` → `deleted: 1`; DIAL Core `{ error: { status: 404 } }` → `alreadyAbsent: 1`; DIAL Core `{ error: { status: 500 } }` → `failed` with `UPSTREAM_ERROR`; mixed results; `pinConversation` is called only for deleted IDs
  - `deleteAllConversations` — metadata returns `[]` → result is zero counts, no `deleteConversation` calls; metadata returns 2 items → delegates and returns result; metadata throws → `BadGatewayException` thrown; FOLDER items excluded from deletion

- [x] 4.2 Run `npm exec nx test chat-api` — all tests pass

## 5. Backend — Controller integration tests

- [x] 5.1 Add integration tests to `apps/chat-api/src/conversations/tests/conversation.controller.integration.spec.ts` following the existing `supertest` pattern (mock service, `ValidationPipe` wired, fake `req.user`). Cover:
  - `POST /conversations/deletions` — 200 with valid body and mocked result; 400 with `ids: []`; 400 with 101 IDs; 400 with non-string element in ids; 400 with missing body
  - `POST /conversations/deletions/all` — 200 with `{ confirm: true }` and mocked result; 400 with `{ confirm: false }`; 400 with missing `confirm`

- [x] 5.2 Run `npm exec nx test chat-api` — all tests pass

## 6. OpenAPI generation and generated client

- [x] 6.1 Run `npm run openapi` — verifies that `libs/chat-api-client/openapi.json` is updated and `libs/chat-api-client/src/generated/src/apis/ConversationsApi.ts` contains `deleteConversations` and `deleteAllConversations` methods with `Promise<ConversationDeletionResultDto>` return types (not `Promise<any>` or `Promise<void>`)

- [x] 6.2 Inspect the generated `ConversationsApi.ts` to confirm:
  - No `ConversationsController_deleteConversations_v1` method name mangling (operationIds drive clean names)
  - `ConversationDeletionResultDto`, `DeleteConversationsBodyDto`, and `DeleteAllConversationsBodyDto` are present in `libs/chat-api-client/src/generated/src/models/`

- [x] 6.3 Run `npm run openapi:check` — exits 0 (no endpoint-level `any`)

- [x] 6.4 Run `npm exec nx build chat-api-client -- --skip-nx-cache` — no build errors

- [x] 6.5 Run `npm exec nx lint chat-api-client` — no lint errors

## 7. Frontend — server-api wrappers

- [x] 7.1 Add to `apps/chat/src/server-api/conversations.api.ts`:

  ```ts
  export const deleteConversations = (ids: string[]) =>
    conversationsApi.deleteConversations({
      deleteConversationsBodyDto: { ids },
    });

  export const deleteAllConversations = () =>
    conversationsApi.deleteAllConversations({
      deleteAllConversationsBodyDto: { confirm: true },
    });
  ```

  Import types (`DeleteConversationsBodyDto`, `DeleteAllConversationsBodyDto`, `ConversationDeletionResultDto`) from `@epam/chat-api-client`.

- [x] 7.2 Verify `apps/chat/src/server-api/api-client.ts` is unchanged — `conversationsApi` singleton already exists; no new entry needed.

- [x] 7.3 Verify `apps/chat/src/server-api/base.ts` gains no new endpoint constants for these paths.

- [x] 7.4 Run `npm exec nx typecheck chat` — no errors
- [x] 7.5 Run `npm exec nx lint chat` — no errors

## 8. Final verification

- [x] 8.1 Run `npm exec nx test chat-api` — all tests green
- [x] 8.2 Run `npm exec nx lint chat-api` — no errors
- [x] 8.3 Run `npm exec nx build chat-api` — no build errors
- [x] 8.4 Run `npm exec nx affected --target=typecheck --base=origin/development-1.0` — no type errors across affected projects
- [x] 8.5 Run `npm exec nx affected --target=test --base=origin/development-1.0` — all affected tests pass
