# Spec: conversation-list-path-filter

## Requirements

### Requirement: listConversations accepts an optional path parameter to scope the listing

`GET /api/v1/conversations/list` SHALL accept an optional `path` query parameter (string, max 512 characters). When `path` is omitted or is an empty string `''`, the endpoint returns all conversations recursively from the user's bucket root (existing behavior, semantically "My Files"). When `path` is a non-empty string, the endpoint returns only conversations stored under that DIAL Core subfolder path prefix.

`ListConversationsQueryDto` change:

```ts
@IsOptional()
@IsString()
@MaxLength(512)
path?: string;
```

The service MUST pass `path ?? ''` as the second argument to `client.getConversationMetadata(bucket, path ?? '', ...)`.

`@Throttle` rate limiting: inherits the existing `@Throttle({ default: { limit: 30, ttl: 60000 } })` already on the `list` handler. No change required.

Generated-client impact:
- OpenAPI operationId: `listConversations` (unchanged)
- Request DTO: `ListConversationsQueryDto` gains `path?: string`
- Response DTO: `ConversationListResponseDto` (unchanged)
- Frontend callers use the normal (non-Raw) generated method
- After updating the Swagger annotations, run `npm run openapi && npm run openapi:check` to regenerate `libs/chat-api-client`
- Update `apps/chat/src/server-api/conversations.api.ts` `listConversations` wrapper to accept and forward an optional `path?: string` argument

Error codes (additions):
- `400 Bad Request` — `path` exceeds 512 characters

#### Scenario: Omitting path returns all root conversations

- **WHEN** `GET /api/v1/conversations/list` is called without a `path` query parameter
- **THEN** the response is 200 and items include conversations from the entire bucket root (recursive)

#### Scenario: Empty string path behaves identically to omitting path

- **WHEN** `GET /api/v1/conversations/list?path=` is called
- **THEN** the response is 200 and items are the same as when `path` is omitted

#### Scenario: Non-empty path scopes the listing

- **WHEN** `GET /api/v1/conversations/list?path=work%2Fproject-x` is called
- **THEN** the response is 200 and items contain only conversations whose DIAL Core path starts with `work/project-x`

#### Scenario: path exceeding 512 characters returns 400

- **WHEN** `GET /api/v1/conversations/list?path=<513-char string>` is called
- **THEN** the response is 400 with a validation error
