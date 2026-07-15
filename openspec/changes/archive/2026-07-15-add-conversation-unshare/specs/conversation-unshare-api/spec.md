## ADDED Requirements

### Requirement: `POST /api/v1/share/discard` accepts conversation resource paths

`DiscardSharedCatalogItemDto.itemId` (`apps/chat-api/src/share/dto/discard-shared-catalog-item.dto.ts`) SHALL additionally accept `conversations/{bucket}/{path}` alongside the existing `applications/{bucket}/{path}` and `toolsets/{bucket}/{path}` forms. The `@Matches` allowlist pattern is widened from `^(?:applications|toolsets)\/...` to `^(?:applications|toolsets|conversations)\/...`; `IsValidFilePath`, `IsNotEmpty`, and `MaxLength(2048)` are unchanged. `ShareController`'s `@ApiOperation` description for this endpoint is updated to state it discards access to "a catalog entity (application or toolset) or a conversation".

No new NestJS endpoint, controller handler, or generated-client operationId is introduced — the existing `discardSharedCatalogItem` operation now documents and accepts a broader `itemId` shape. `ShareService.discardShared` requires no code change: it already forwards `itemId` through unmodified as `{ resources: [{ url: itemId }] }` to DIAL Core's `discardSharedResources`, with no type-specific branching.

**Example request:**
```http
POST /api/v1/share/discard
Content-Type: application/json

{ "itemId": "conversations/owner-bucket/my-chat" }
```

**Example response (200):**
```json
{ "success": true }
```

**Generated-client impact**: no new operation. `discardSharedCatalogItem` (existing operationId, existing `DiscardSharedCatalogItemDto`/`DiscardSharedCatalogItemResponseDto` request/response DTOs in `libs/chat-api-client`) is regenerated after the OpenAPI description/pattern change (`npm run openapi`, `npm run openapi:check`) but its TypeScript signature is unchanged. Frontend callers continue to use the existing non-`Raw` generated method via `apps/chat/src/server-api/share.api.ts`'s `discardSharedCatalogItem(itemId)` — no new wrapper function.

#### Scenario: Conversation itemId is accepted

- **WHEN** an authenticated user calls `POST /api/v1/share/discard` with `{ itemId: "conversations/owner-bucket/my-chat" }` for a conversation actually shared with them
- **THEN** the endpoint calls DIAL Core `discardSharedResources` with `{ resources: [{ url: "conversations/owner-bucket/my-chat" }] }` and responds `200 { success: true }`

#### Scenario: Invalid conversation-shaped itemId is still rejected before any DIAL Core call

- **WHEN** the request body's `itemId` starts with `conversations/` but fails `IsValidFilePath` (e.g. contains `../`) or omits the bucket/path segments
- **THEN** the endpoint responds `400 Bad Request` and no DIAL Core call is made

#### Scenario: Non-allowlisted resource type prefix is still rejected

- **WHEN** the request body's `itemId` does not start with `applications/`, `toolsets/`, or `conversations/`
- **THEN** the endpoint responds `400 Bad Request`

#### Scenario: Discarding a conversation not shared with the caller

- **WHEN** the `itemId` refers to a conversation DIAL Core does not consider shared with the calling user
- **THEN** DIAL Core's error response is mapped to `403 Forbidden`, matching the existing catalog-item behavior

#### Scenario: Existing catalog itemIds remain unaffected

- **WHEN** `POST /api/v1/share/discard` is called with an `applications/...` or `toolsets/...` itemId
- **THEN** behavior is unchanged from the `catalog-unshare` capability — same validation, same DIAL Core call, same cache invalidation of deployments/toolsets lists

### Requirement: No server-side list cache invalidation is introduced for conversations

`ShareService.discardShared` SHALL NOT gain a new conversations-list cache invalidation call. `DeploymentsService.invalidateListCache(userSub)` and `ToolsetsService.invalidateListCache(userSub)` continue to run unconditionally after every successful discard, regardless of the discarded resource's type — this is a pre-existing, per-user (not per-resource) invalidation and remains a harmless no-op for a conversation-shaped `itemId` since it does not touch conversation state. Consistency of the frontend's shared-with-me conversation list after a discard is achieved entirely by the client calling `refreshConversations()` (see `conversation-unshare-flow`), not by any BFF-side cache.

If a server-side conversations list cache is introduced in the future, this requirement's assumption (no such cache exists) becomes stale and the discard flow must be revisited to add invalidation — this is called out here specifically so that future change is discoverable by searching for `discardShared` callers.

#### Scenario: Successful conversation discard does not touch a conversations cache

- **WHEN** `discardShared` succeeds for a conversation `itemId`
- **THEN** only `DeploymentsService.invalidateListCache` and `ToolsetsService.invalidateListCache` are called (both pre-existing calls); no conversations-specific cache invalidation call exists to make

#### Scenario: Rate limit and error mapping are shared with catalog discard, unchanged

- **WHEN** a conversation discard request exceeds 10 requests per 60 seconds, or DIAL Core is unreachable, times out, or returns a 5xx/404/401 status
- **THEN** the same `@Throttle({ default: { limit: 10, ttl: 60000 } })` and `mapDialHttpStatus`/`handleDialFetchError` mapping already specified in `catalog-unshare` apply identically (429 / 503 / 502 / 404 / 401 respectively)
