# Design: bulk-conversation-deletion

## REST API Contract Evaluation

### Options considered

| Option | Problem |
|---|---|
| `DELETE /api/v1/conversations` with a JSON body | Request bodies on DELETE are technically valid but widely unsupported by proxies, caches, and HTTP client libraries. NestJS/Express support it, but the `openapi-generator` client does not reliably emit a typed `body` parameter for DELETE operations, producing `any` or omitting it entirely. |
| `DELETE /api/v1/conversations?ids=a,b,c` | URL-length limit (~2 KB practical ceiling after encoding). 100 UUIDs-length IDs would saturate the limit on many proxies. No request body on DELETE is the safer default. |
| `POST /api/v1/conversations/bulk-delete` (verb path) | Verb paths are RPC-style. The resource convention of the existing API is noun paths (`/conversations`, `/conversation-deletions`). |
| **`POST /api/v1/conversation-deletions`** (selected) | Creates a *deletion request* resource. Resource-oriented, no DELETE-body interoperability problems, fully typed request and response body through the generator, clearly distinct from `DELETE /api/v1/conversations`. |
| `POST /api/v1/conversation-deletions/all` (selected) | Explicit sub-resource for "delete all". Separate from the by-IDs endpoint — they cannot be confused. The `confirm: true` body field acts as a deliberate confirmation gate. |

### Why not a single overloaded endpoint?

Omitting `ids` to mean "delete all" is a footgun. An empty array, a `null` body, or a future client bug should never accidentally trigger a total bucket wipe. Two distinct endpoints make the intent unambiguous at the HTTP level.

---

## 1. DTOs

### `apps/chat-api/src/conversations/dto/delete-conversations.dto.ts`

```ts
export class ConversationDeletionFailureDto {
  @ApiProperty({ description: 'Conversation ID that failed to delete' })
  id!: string;

  @ApiProperty({
    description: 'Stable application error code',
    enum: ['NOT_FOUND', 'FORBIDDEN', 'UPSTREAM_ERROR', 'UNKNOWN'],
  })
  code!: string;
}

export class ConversationDeletionResultDto {
  @ApiProperty({ description: 'Total number of IDs received in the request (after deduplication)' })
  requested!: number;

  @ApiProperty({ description: 'Number of conversations successfully deleted from DIAL Core' })
  deleted!: number;

  @ApiProperty({ description: 'Number of IDs that were already absent from DIAL Core (counted as success)' })
  alreadyAbsent!: number;

  @ApiProperty({ description: 'Items that could not be deleted', type: [ConversationDeletionFailureDto] })
  failed!: ConversationDeletionFailureDto[];
}
```

### `apps/chat-api/src/conversations/dto/delete-conversations-body.dto.ts`

```ts
export class DeleteConversationsBodyDto {
  @ApiProperty({
    description: 'Stable DIAL Core conversation IDs to delete. 1–100 IDs. Duplicates are silently deduplicated.',
    type: [String],
    minItems: 1,
    maxItems: 100,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  ids!: string[];
}
```

### `apps/chat-api/src/conversations/dto/delete-all-conversations-body.dto.ts`

```ts
export class DeleteAllConversationsBodyDto {
  @ApiProperty({
    description: 'Must be `true` to confirm intentional deletion of all conversations.',
    example: true,
  })
  @IsBoolean()
  @Equals(true)
  confirm!: boolean;
}
```

---

## 2. Service methods — `ConversationService`

### Ownership validation helper

```ts
private isOwnedBySessionBucket(id: string, sessionBucket: string): boolean {
  // IDs are DIAL Core resource URLs: conversations/{bucket}/{path}
  // Example: "conversations/user123/gpt-4o__My Chat__uuid"
  const prefix = `conversations/${sessionBucket}/`;
  return id.startsWith(prefix);
}
```

IDs that do not start with `conversations/{sessionBucket}/` are rejected with code `'FORBIDDEN'` without calling DIAL Core.

### `deleteConversations(ids: string[], token: string, bucket: string): Promise<ConversationDeletionResultDto>`

1. Deduplicate `ids` via `new Set(ids)`.
2. Validate ownership for each ID — IDs failing ownership validation collect as `{ id, code: 'FORBIDDEN' }` failures immediately.
3. For each owned ID, extract `conversationPath` (everything after `conversations/{bucket}/`) and call `this.client.deleteConversation(bucket, encodeDialResourcePath(conversationPath), { headers: getBearerAuthHeaders(token) })`.
4. All DIAL Core calls run in parallel via `Promise.allSettled`.
5. Classify each result:
   - `error == null` → `deleted++`; queue fire-and-forget pin cleanup.
   - SDK/HTTP 404 → `alreadyAbsent++` (idempotent).
   - SDK/HTTP 403 → `failed` with code `'FORBIDDEN'`.
   - SDK/HTTP 5xx or network → `failed` with code `'UPSTREAM_ERROR'`; `logger.error` with the error stack (no raw message exposed to client).
   - Unexpected shape → `failed` with code `'UNKNOWN'`; `logger.error`.
6. Return `ConversationDeletionResultDto`.

**Never throw.** The service accumulates per-item outcomes and always returns the result DTO. A complete upstream failure (all items failed) still returns 200 with `deleted: 0, failed: [...]`.

### `deleteAllConversations(token: string, bucket: string): Promise<ConversationDeletionResultDto>`

1. Paginate through `client.getConversationMetadata(bucket, '', { headers, params: { query: { recursive: true, limit: 1000 } } })` until `nextToken` is exhausted. Collect all non-FOLDER item IDs.
2. Call `deleteConversations(ids, token, bucket)` with the collected IDs. Reuses all ownership/error logic.
3. If `getConversationMetadata` throws or returns an error → throw `BadGatewayException` (metadata is required to know what to delete; without it the operation cannot proceed at all).
4. Empty bucket (`ids.length === 0`) → return `{ requested: 0, deleted: 0, alreadyAbsent: 0, failed: [] }` immediately without calling `deleteConversations`.

### Pin cleanup (fire-and-forget)

After each successful individual deletion, fire:
```ts
void this.pinConversation(id, false, token, bucket)
  .catch((err) => this.logger.error('Failed to clean up pin on bulk delete', err));
```

`id` is the full resource URL (`conversations/{bucket}/{path}`), matching the format used by single `deleteConversation`.

---

## 3. Controller handlers

Both handlers live in `ConversationController` (versioned `v1`), following the `ThemeController` pattern (see `AGENTS.md §3`).

### `POST /api/v1/conversation-deletions`

```ts
@Post('deletions')
@HttpCode(200)
@Throttle({ default: { limit: 5, ttl: 60000 } })
@ApiOperation({
  operationId: 'deleteConversations',
  summary: 'Delete selected conversations',
  description:
    'Deletes up to 100 owned conversations in one request. Returns a result counting deleted, already-absent, and failed items. Already-absent IDs are treated as success. IDs outside the authenticated bucket are rejected with code FORBIDDEN.',
})
@ApiResponse({ status: 200, description: 'Deletion result', type: ConversationDeletionResultDto })
@ApiResponse({ status: 400, description: 'ids is empty, exceeds 100, contains non-strings, or body is missing' })
@ApiResponse({ status: 401, description: 'Not authenticated' })
@ApiResponse({ status: 429, description: 'Rate limit exceeded' })
@ApiResponse({ status: 500, description: 'Unexpected internal error' })
deleteConversations(@Req() req: Request, @Body() body: DeleteConversationsBodyDto) {
  const { at, bucket } = req.user as SessionUser;
  return this.conversationService.deleteConversations(body.ids, at, bucket);
}
```

**HTTP 200 always on service success** — even if every item failed. The caller inspects the DTO to determine per-item outcomes. This avoids 207 Multi-Status, which `openapi-generator` handles poorly.

### `POST /api/v1/conversation-deletions/all`

```ts
@Post('deletions/all')
@HttpCode(200)
@Throttle({ default: { limit: 2, ttl: 60000 } })
@ApiOperation({
  operationId: 'deleteAllConversations',
  summary: 'Delete all conversations in the user bucket',
  description:
    'Deletes every conversation in the authenticated user\'s bucket. Requires { confirm: true } in the request body to prevent accidental deletion. Returns a result counting deleted, already-absent, and failed items.',
})
@ApiResponse({ status: 200, description: 'Deletion result', type: ConversationDeletionResultDto })
@ApiResponse({ status: 400, description: 'confirm is missing, false, or non-boolean' })
@ApiResponse({ status: 401, description: 'Not authenticated' })
@ApiResponse({ status: 429, description: 'Rate limit exceeded' })
@ApiResponse({ status: 502, description: 'DIAL Core metadata listing failed (bucket unreadable)' })
@ApiResponse({ status: 503, description: 'DIAL Core unreachable during metadata listing' })
@ApiResponse({ status: 500, description: 'Unexpected internal error' })
deleteAllConversations(@Req() req: Request, @Body() body: DeleteAllConversationsBodyDto) {
  const { at, bucket } = req.user as SessionUser;
  return this.conversationService.deleteAllConversations(at, bucket);
}
```

---

## 4. Generated-client impact

After running `npm run openapi`:

```ts
// libs/chat-api-client/src/generated/src/apis/ConversationsApi.ts
class ConversationsApi extends BaseAPI {
  // Existing methods...
  deleteConversations(req: DeleteConversationsRequest): Promise<ConversationDeletionResultDto>;
  deleteAllConversations(req: DeleteAllConversationsRequest): Promise<ConversationDeletionResultDto>;
}

interface DeleteConversationsRequest {
  deleteConversationsBodyDto: DeleteConversationsBodyDto;
}

interface DeleteAllConversationsRequest {
  deleteAllConversationsBodyDto: DeleteAllConversationsBodyDto;
}
```

The `operationId` values (`deleteConversations`, `deleteAllConversations`) drive the generated method names. Verify these are present and clean after generation (no `ConversationsController_deleteConversations_v1` mangling).

---

## 5. Frontend server-api wrappers

### `apps/chat/src/server-api/conversations.api.ts`

```ts
import type { DeleteAllConversationsBodyDto, DeleteConversationsBodyDto } from '@epam/chat-api-client';

export const deleteConversations = (ids: string[]) =>
  conversationsApi.deleteConversations({
    deleteConversationsBodyDto: { ids },
  });

export const deleteAllConversations = () =>
  conversationsApi.deleteAllConversations({
    deleteAllConversationsBodyDto: { confirm: true },
  });
```

No new API singleton entry in `api-client.ts` — `conversationsApi` already exists.

---

## 6. Logging and observability

- Per-item DIAL Core errors are logged with `logger.error(message, error.stack)` before being mapped to a `ConversationDeletionFailureDto`. No conversation IDs, bucket names, tokens, or raw upstream error messages are included in the log message — only counts and error codes.
- The `deleteAllConversations` metadata listing failure is logged with `logger.error` before the `BadGatewayException` is thrown.
- The `MetricsInterceptor` (`common/interceptors/`) already tracks request duration and error rate for all endpoints; no additional metrics instrumentation is needed.

---

## 7. Rate limiting rationale

| Endpoint | Limit | Reason |
|---|---|---|
| `POST /api/v1/conversation-deletions` | 5 req/min | Each request can delete up to 100 items. 5 × 100 = 500 deletes/min is already generous and protects DIAL Core. |
| `POST /api/v1/conversation-deletions/all` | 2 req/min | "Delete all" triggers O(n) DIAL Core calls. The extra restriction discourages scripted abuse. |

---

## 8. Synchronous vs. asynchronous

Both operations are synchronous. DIAL Core's `DELETE /v1/conversations/{bucket}/{path}` is a point-in-time operation with no observable side effect beyond deletion. Introducing an asynchronous job queue adds operational complexity (job storage, polling or push notification) that is not justified for the expected conversation counts (<10 000 per user). If DIAL Core latency becomes a problem, the delete-all endpoint can be made asynchronous in a future change without breaking the contract (same request shape, different response status / polling endpoint added alongside).

---

## 9. Idempotency and retry semantics

| Scenario | Treatment |
|---|---|
| ID was already deleted before the request | DIAL Core returns 404 → counted as `alreadyAbsent`, not a failure |
| Same request retried after a partial failure | The already-deleted IDs resolve as `alreadyAbsent`; only still-present IDs are deleted again |
| `deleteAllConversations` retried on a partially-cleared bucket | The remaining conversations are deleted; already-absent ones are counted |
| Two concurrent `deleteAllConversations` calls | Both succeed; the second call may observe 404s and counts them as `alreadyAbsent` |

---

## 10. Error code mapping

| DIAL Core response | `ConversationDeletionFailureDto.code` |
|---|---|
| 404 Not Found | `alreadyAbsent` (not a failure) |
| 403 Forbidden | `'FORBIDDEN'` |
| 4xx (other) | `'UPSTREAM_ERROR'` |
| 5xx | `'UPSTREAM_ERROR'` |
| Network / timeout | `'UPSTREAM_ERROR'` |
| Unexpected / unknown | `'UNKNOWN'` |
| Ownership check failed (wrong bucket) | `'FORBIDDEN'` (no DIAL Core call made) |

---

## 11. Backend conventions

For all implementation details follow `apps/chat-api/AGENTS.md`:
- URI versioning on the controller (`version: '1'`).
- `@Injectable()` service extending `AppService`.
- `private readonly logger = new Logger(ConversationService.name)` — no `console.log`.
- `ConfigService<EnvironmentVariables>` injected via constructor — no `process.env` reads.
- `@epam/ai-dial-typescript-sdk` for all DIAL Core calls.
- DTOs in `<domain>/dto/<action>.dto.ts`; no inline anonymous types.
- Global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform` already configured in `main.ts`.
