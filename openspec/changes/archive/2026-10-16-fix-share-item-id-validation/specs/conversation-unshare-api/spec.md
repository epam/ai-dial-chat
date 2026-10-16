# Spec Delta

## MODIFIED Requirements

### Requirement: `POST /api/v1/share/discard` accepts conversation resource paths

`DiscardSharedCatalogItemDto.itemId` (`apps/chat-api/src/share/dto/discard-shared-catalog-item.dto.ts`) SHALL accept `conversations/{bucket}/{path}` alongside the `applications/`, `toolsets/`, `skills/`, and `prompts/` forms. The prefix allowlist is the `@IsCatalogResourcePath()` decorator (`apps/chat-api/src/share/dto/catalog-resource-path.validator.ts`, whose `CATALOG_RESOURCE_PATH_PATTERN` starts `^(?:applications|toolsets|conversations|skills|prompts)\/[^/\s]+\/`), applied together with `IsString`, `IsNotEmpty`, `IsDialResourceId`, a `@Matches(NOT_A_SKILL_FILE_PATTERN)` rule rejecting `skills/.../files/...` paths, and `MaxLength(2048)`. `ShareController`'s `@ApiOperation` description for this endpoint states it discards the caller's access to "a shared catalog entity (application or toolset), a skill, a conversation, or a prompt".

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

- **WHEN** the request body's `itemId` starts with `conversations/` but fails `IsDialResourceId` (e.g. contains `../`) or omits the bucket/path segments
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

#### Scenario: Conversation id with a colon in the model id is accepted

- **WHEN** an authenticated user calls `POST /api/v1/share/discard` with `{ itemId: "conversations/owner-bucket/anthropic.claude-haiku-4-5-20251001-v1:0__hi__{uuid}" }` for a conversation shared with them
- **THEN** `itemId` validation passes and the endpoint proceeds exactly as for any other conversation id
