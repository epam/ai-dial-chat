# Spec: conversation-list-path-filter

## Purpose

Define how `GET /api/v1/conversations/list` scopes results to an optional DIAL Core subfolder, including the folder-path normalization required by the metadata SDK.

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

Before calling DIAL Core, the service MUST normalize the query value as a folder path: omitted or empty `path` becomes `''`; a non-empty path without a trailing slash gains one; and an already trailing-slashed path remains unchanged. The normalized path is then segment-encoded and passed as the second argument to both user-bucket and public-bucket `client.getConversationMetadata` calls. This is internal SDK normalization only; the external query parameter and generated-client contract remain unchanged.

When a non-empty `path` is given and DIAL Core returns `404` for the user-bucket metadata call, the service MUST treat this as "no blobs exist under this folder prefix yet" and return `200` with an empty `items` list for the user-bucket portion (mirroring the existing tolerant handling of public-bucket and shared-resources failures), rather than propagating a `404` to the caller. A `404` on the user-bucket call for an omitted/empty `path` (bucket root) remains an unexpected upstream error and is still mapped via `handleDialSdkError`.

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
- **THEN** both metadata calls receive `work/project-x/`, and the response is 200 with only conversations under that folder

#### Scenario: Already normalized path does not gain a second slash

- **WHEN** `GET /api/v1/conversations/list?path=work%2Fproject-x%2F` is called
- **THEN** both metadata calls receive `work/project-x/`, not `work/project-x//`

#### Scenario: Non-empty path scoped to a folder with no blobs yet returns an empty list, not 404

- **WHEN** `GET /api/v1/conversations/list?path=work%2Fempty-folder` is called and DIAL Core's user-bucket metadata call returns `404`
- **THEN** the response is 200 with an empty `items` list for the user-bucket portion, not a propagated 404

#### Scenario: A 404 on the bucket root is still a fatal error

- **WHEN** `GET /api/v1/conversations/list` (no `path`) is called and DIAL Core's user-bucket metadata call returns `404`
- **THEN** the response is 404, mapped via `handleDialSdkError` as before

#### Scenario: path exceeding 512 characters returns 400

- **WHEN** `GET /api/v1/conversations/list?path=<513-char string>` is called
- **THEN** the response is 400 with a validation error
