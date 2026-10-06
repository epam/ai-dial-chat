# conversation-unshare-api Specification

## Purpose
BFF contract for a recipient discarding their own access to a conversation shared with them, through the existing `POST /api/v1/share/discard` endpoint (`discardSharedCatalogItem`).
## Requirements
### Requirement: `POST /api/v1/share/discard` accepts conversation resource paths

`DiscardSharedCatalogItemDto.itemId` (`apps/chat-api/src/share/dto/discard-shared-catalog-item.dto.ts`) SHALL accept `conversations/{bucket}/{path}` alongside the `applications/`, `toolsets/`, `skills/`, and `prompts/` forms. The prefix allowlist is the `@IsCatalogResourcePath()` decorator (`apps/chat-api/src/share/dto/catalog-resource-path.validator.ts`, whose `CATALOG_RESOURCE_PATH_PATTERN` starts `^(?:applications|toolsets|conversations|skills|prompts)\/[^/\s]+\/`), applied together with `IsString`, `IsNotEmpty`, `IsValidFilePath`, a `@Matches(NOT_A_SKILL_FILE_PATTERN)` rule rejecting `skills/.../files/...` paths, and `MaxLength(2048)`. `ShareController`'s `@ApiOperation` description for this endpoint states it discards the caller's access to "a shared catalog entity (application or toolset), a skill, a conversation, or a prompt".

No new NestJS endpoint, controller handler, or generated-client operationId is introduced — the existing `discardSharedCatalogItem` operation now documents and accepts a broader `itemId` shape. `ShareManagementService.discardShared` (`apps/chat-api/src/share/management/share-management.service.ts`) SHALL pass a conversation `itemId` through `toShareResourceUrl` (which percent-encodes only `prompts/` paths, so a conversation path is unchanged), first verify via DIAL Core `getSharedResources({ resourceTypes: [<kind>], with: 'me' })` whether the resource is shared with the caller, then call `discardSharedResources` with `{ resources: [{ url: itemId }] }`.

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
- **THEN** the endpoint checks `getSharedResources` (`with: 'me'`), calls DIAL Core `discardSharedResources` with `{ resources: [{ url: "conversations/owner-bucket/my-chat" }] }` and responds `200 { success: true }`

#### Scenario: Invalid conversation-shaped itemId is still rejected before any DIAL Core call

- **WHEN** the request body's `itemId` starts with `conversations/` but fails `IsValidFilePath` (e.g. contains `../`) or omits the bucket/path segments
- **THEN** the endpoint responds `400 Bad Request` and no DIAL Core call is made

#### Scenario: Non-allowlisted resource type prefix is still rejected

- **WHEN** the request body's `itemId` does not start with `applications/`, `toolsets/`, `conversations/`, `skills/`, or `prompts/`
- **THEN** the endpoint responds `400 Bad Request`

#### Scenario: Discarding a conversation not shared with the caller

- **WHEN** the `itemId` refers to a conversation that the `getSharedResources` (`with: 'me'`) pre-check does not list as shared with the calling user
- **THEN** once DIAL Core's `discardSharedResources` call returns without error, the BFF logs a warning and throws `403 Forbidden` ("Resource is not shared with the caller"), matching the existing catalog-item behavior, and no list cache is invalidated

#### Scenario: Existing catalog itemIds remain unaffected

- **WHEN** `POST /api/v1/share/discard` is called with an `applications/...` or `toolsets/...` itemId
- **THEN** behavior is unchanged from the `catalog-unshare` capability — same validation, same DIAL Core call, same cache invalidation of deployments/toolsets lists

### Requirement: No server-side list cache invalidation is introduced for conversations

`ShareManagementService.discardShared` SHALL NOT gain a new conversations-list cache invalidation call. `DeploymentsService.invalidateListCache(userSub)` and `ToolsetsService.invalidateListCache(userSub)` continue to run unconditionally after every successful discard, regardless of the discarded resource's type — this is a pre-existing, per-user (not per-resource) invalidation and remains a harmless no-op for a conversation-shaped `itemId` since it does not touch conversation state. Consistency of the frontend's shared-with-me conversation list after a discard is achieved entirely by the client calling `refreshConversations()` (see `conversation-unshare-flow`), not by any BFF-side cache.

If a server-side conversations list cache is introduced in the future, this requirement's assumption (no such cache exists) becomes stale and the discard flow must be revisited to add invalidation — this is called out here specifically so that future change is discoverable by searching for `discardShared` callers.

#### Scenario: Successful conversation discard does not touch a conversations cache

- **WHEN** `discardShared` succeeds for a conversation `itemId` that is shared with the caller
- **THEN** only `DeploymentsService.invalidateListCache` and `ToolsetsService.invalidateListCache` are called (both pre-existing calls); no conversations-specific cache invalidation call exists to make

#### Scenario: Upstream error mapping is shared with catalog discard

- **WHEN** DIAL Core returns 429, is unreachable, times out, or returns a 5xx/404/401 status for a conversation discard request (or for its `getSharedResources` pre-check)
- **THEN** the `mapDialHttpStatus`/`handleDialFetchError` mapping specified in `catalog-unshare` applies identically (429 / 503 / 502 / 404 / 401 respectively), and a DIAL Core `400` from `discardSharedResources` is mapped to `404 Not Found` ("Resource does not exist")
