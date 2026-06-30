## MODIFIED Requirements

### Requirement: GET /api/v1/conversations/list returns a cursor-paginated list of conversation metadata

The backend SHALL expose `GET /api/v1/conversations/list` (not `GET /api/v1/conversations`) in `apps/chat-api/src/conversations/conversation.controller.ts`. The controller MUST be versioned (`version: '1'`), annotated with `@ApiTags('conversations')`, and delegate all logic to `ConversationService`. The endpoint is backed by DIAL Core metadata (not an in-memory store). It accepts the following query parameters validated by `ListConversationsQueryDto`:

- `limit` — integer, default 100, max 1000 (`@IsInt @Min(1) @Max(1000) @IsOptional`)
- `nextToken` — string cursor from a previous response, passed through to DIAL Core (`@IsString @MaxLength(512) @IsOptional`)
- `path` — string subfolder path to scope the listing, default `''` (bucket root = "My Files") (`@IsString @MaxLength(512) @IsOptional`)

On success the endpoint returns HTTP 200 with `ConversationListResponseDto`:

```ts
class ConversationListItemDto {
  id: string;        // Full DIAL Core resource URL (e.g. "conversations/bucket/model__title__uuid")
  title: string;     // Human-readable conversation title extracted from the resource name
  updatedAt: number; // Unix epoch milliseconds of the last update
}

class ConversationListResponseDto {
  items: ConversationListItemDto[];
  nextToken?: string; // Cursor for the next page; absent when no more results
}
```

The service calls `client.getConversationMetadata(bucket, path ?? '', { query: { recursive: true, limit, token: nextToken } })` and filters out items with `nodeType === 'FOLDER'`.

Rate limiting: `@Throttle({ default: { limit: 30, ttl: 60000 } })` on the handler.

Error codes:
- `400 Bad Request` — invalid `limit` (out of range or non-integer), `nextToken` exceeds 512 chars, or `path` exceeds 512 chars
- `401 Unauthorized` — missing or invalid bearer token
- `502 Bad Gateway` — DIAL Core returned an error response

Generated-client impact:
- OpenAPI operationId: `listConversations`
- SDK method: `ConversationsApi.listConversations({ limit?, nextToken?, path? })`
- Response type: `ConversationListResponseDto`
- Frontend callers use the normal (non-Raw) generated method via `apps/chat/src/server-api/conversations.api.ts`

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

#### Scenario: Invalid limit returns 400

- **WHEN** `GET /api/v1/conversations/list?limit=1001` is called (exceeds max 1000)
- **THEN** the response is 400 with a validation error

## REMOVED Requirements

### Requirement: GET /api/v1/conversations lists conversation metadata

**Reason**: The list endpoint was implemented at `GET /api/v1/conversations/list` (using the `@Get('list')` decorator to avoid a route conflict with the existing `@Get()` handler). The offset-based pagination model was replaced with DIAL Core cursor-based pagination (`nextToken`). The in-memory store backing was replaced with DIAL Core metadata.

**Migration**: Use `GET /api/v1/conversations/list` with `limit` and `nextToken` parameters.
