## ADDED Requirements

### Requirement: PATCH /api/v1/conversations renames a conversation by moving it to a new DIAL Core path

The backend SHALL expose `PATCH /api/v1/conversations` in `apps/chat-api/src/conversations/conversation.controller.ts`. The endpoint accepts query parameter `path` (validated by `RenameConversationDto` — `@IsString @MinLength(1) @MaxLength(512)`) and a JSON body `RenameConversationBodyDto`:

```ts
class RenameConversationBodyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  newTitle: string;
}
```

The service method `renameConversation(path, newTitle, at, bucket)` SHALL:
1. Sanitise `newTitle` through `prepareEntityName` to strip disallowed characters and truncate to 200 chars.
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
- `400 Bad Request` — `path` or `newTitle` fails DTO validation; or source conversation does not exist (DIAL Core returns 400 for missing source instead of 404)
- `401 Unauthorized` — missing or invalid bearer token
- `409 Conflict` — destination path already exists (DIAL Core 4xx when `overwrite=false`)
- `502 Bad Gateway` — DIAL Core returned an unexpected error
- `503 Service Unavailable` — DIAL Core unreachable

#### Scenario: Valid request returns 200 with newPath

- **WHEN** `PATCH /api/v1/conversations?path=model__Old+Title__uuid` is called with body `{ "newTitle": "New Title" }`
- **THEN** the response status is 200 and the body contains `{ "newPath": "conversations/bucket/model__New Title__uuid" }`

#### Scenario: Empty newTitle returns 400

- **WHEN** `PATCH /api/v1/conversations?path=...` is called with body `{ "newTitle": "" }`
- **THEN** the response status is 400

#### Scenario: newTitle exceeding 200 chars returns 400

- **WHEN** `PATCH /api/v1/conversations?path=...` is called with `newTitle` of 201 characters
- **THEN** the response status is 400

#### Scenario: Non-existent source path returns 400

- **WHEN** DIAL Core returns 400 for `moveResource` with message containing "does not exist"
- **THEN** the response status is 400

#### Scenario: Integration test covers PATCH 200 and 400 paths

- **WHEN** the integration test suite for `ConversationController` runs
- **THEN** it covers: 200 with valid path and newTitle, 400 with empty newTitle, 400 with missing path
