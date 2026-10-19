# Spec Delta

## MODIFIED Requirements

### Requirement: BFF discard-shared-catalog-item endpoint

The system SHALL expose `POST /api/v1/share/discard` on the existing `ShareController` (`apps/chat-api/src/share/`), allowing an authenticated session user to discard their own access to a catalog resource (application or toolset), a skill, a prompt, or a conversation that is currently shared with them via DIAL Core `discardSharedResources`.

The endpoint SHALL:
- Require a valid session; respond `401 Unauthorized` when no session is present.
- Accept `DiscardSharedCatalogItemDto { itemId: string }` validated via NestJS `ValidationPipe` (whitelist, forbidNonWhitelisted, transform); `itemId` SHALL be a non-empty string, max length 2048, validated with the `IsDialResourceId` validator (see the `dial-resource-id-validation` capability) and the custom `@IsCatalogResourcePath()` allowlist decorator (`CATALOG_RESOURCE_PATH_PATTERN` in `apps/chat-api/src/share/dto/catalog-resource-path.validator.ts`) restricted to `applications/{bucket}/{path}`, `toolsets/{bucket}/{path}`, `conversations/{bucket}/{path}`, `skills/{bucket}/{path}`, **or `prompts/{bucket}/{path}`**. Other DIAL resource types and incomplete paths SHALL be rejected before calling DIAL Core. Because `CATALOG_RESOURCE_PATH_PATTERN`'s trailing segment is unrestricted (it also matches deeper nested paths), a `skills/`-prefixed `itemId` containing a `/files/` segment SHALL be additionally rejected by an `@Matches(NOT_A_SKILL_FILE_PATTERN)` check on `DiscardSharedCatalogItemDto`, so only whole-skill URLs (never a single in-skill file URL) are accepted — skills remain whole-resource units for sharing. `DiscardSharedCatalogItemDto` carries no `resourceKind` or `bucket` field — every `itemId`, prompts included, is a self-sufficient full resource path, and no per-resource-type qualification step exists on this DTO.
- Use the session `accessToken` as the Bearer credential when calling DIAL Core.
- Derive the resource url as `resourceUrl = toShareResourceUrl(itemId)` (`apps/chat-api/src/share/utils/share-resource.util.ts`), with no bucket/path reconstruction: a `prompts/` id is re-encoded to DIAL Core's canonical percent-encoded form via `encodeDialResourcePath`, and every other kind passes through unchanged. Call SDK `discardSharedResources({ headers, body: { resources: [{ url: resourceUrl }] } })`.
- Enforce "shared with the caller" in the BFF, because DIAL Core answers `200` (an idempotent no-op) when discarding a resource that was never shared with the caller: before calling discard, `ShareManagementService.isSharedWithCaller` (`apps/chat-api/src/share/management/share-management.service.ts`) calls `getSharedResources({ resourceTypes: [<kind>], with: 'me' })` and matches `resourceUrl` or its decoded form against the returned `resources[].url`. `discardSharedResources` is still called; if it succeeds but the pre-check found the resource not shared, the service SHALL throw `ForbiddenException('Resource is not shared with the caller')` (`403`), not return a silent 200. A failing pre-check call is mapped like any other DIAL Core failure.
- Resolve the DIAL Core `resourceTypes` filter used by the pre-discard `isSharedWithCaller` check via `RESOURCE_KIND_BY_PREFIX` (`apps/chat-api/src/share/utils/share-resource.util.ts`), which SHALL include a `['skills/', 'SKILL']` entry and a `['prompts/', 'PROMPT']` entry alongside the existing `applications/` → `APPLICATION`, `toolsets/` → `TOOL_SET`, and `conversations/` → `CONVERSATION` entries.
- On success, invalidate both `DeploymentsService.invalidateListCache(userSub)` and `ToolsetsService.invalidateListCache(userSub)` before responding, mirroring the existing invalidation call in `ShareInvitationService.acceptInvitation`. This invalidation runs unconditionally regardless of `itemId` type; conversations, skills, and prompts have no equivalent server-side list cache today, so for those `itemId` types this invalidation is a harmless no-op.
- Respond `200 OK` with `DiscardSharedCatalogItemResponseDto { success: true }` on success.
- Map upstream failures via the fetch-shaped `mapDialHttpStatus`/`handleDialFetchError` pair (consistent with the share domain's other methods): DIAL Core 400 → `404 Not Found` (`NotFoundException('Resource does not exist')`, since `DiscardSharedCatalogItemDto` already rejects malformed ids, so a DIAL Core 400 can only mean the well-formed id resolves to no resource), 401 → 401, 403 → 403, 404 → 404, 429 → 429, 5xx → 502, network/timeout → 503.
- Not cache the mutation response itself.
- Log structured success/failure messages (e.g. `Discard shared resource started`, `Discard shared resource completed: success=true`, `DIAL Core returned <status> for share.discardShared`) without the access token, invitation links, full resource path, or any other user data beyond a safe operation identifier.

Controller handler name / OpenAPI operationId: **`discardSharedCatalogItem`** → generated client method `discardSharedCatalogItem()`. The `@ApiOperation.description` SHALL read "Discards the authenticated user's own access to a shared catalog entity (application or toolset), a skill, a conversation, or a prompt, via DIAL Core's discardSharedResources operation. Only affects the caller's own access — removing access for everyone else is a separate operation."

**Example request:**
```http
POST /api/v1/share/discard
Content-Type: application/json

{ "itemId": "prompts/owner-bucket/Work/AI/summarize" }
```

**Example response (200):**
```json
{ "success": true }
```

**Generated-client impact**: no new operation — `discardSharedCatalogItem` already exists; only the accepted `itemId` shape widens and the previously-present `resourceKind`/`bucket` fields are removed. Request DTO `DiscardSharedCatalogItemDto { itemId: string }`, response DTO `DiscardSharedCatalogItemResponseDto { success: boolean }`.

Note: the backend/generated DTOs are named `DiscardSharedCatalogItemDto`/`DiscardSharedCatalogItemResponseDto` rather than the shorter `DiscardSharedDto`/`DiscardSharedResponseDto`, because the File Manager domain already defines DTOs with those exact names for its own (unrelated) discard-shared-file endpoint — the OpenAPI generator keys generated models by class name globally, so two domains cannot reuse the same DTO class name without a collision.

#### Scenario: Successful discard

- **WHEN** an authenticated user calls `POST /api/v1/share/discard` with `{ itemId: "applications/owner-bucket/my-app" }` for an application actually shared with them
- **THEN** the endpoint calls DIAL Core `discardSharedResources` with `{ resources: [{ url: "applications/owner-bucket/my-app" }] }`, invalidates both the deployments and toolsets list caches for the caller, and responds `200 { success: true }`

#### Scenario: Discarding a resource not shared with the caller

- **WHEN** the `itemId` refers to a resource DIAL Core does not consider shared with the calling user
- **THEN** the pre-discard `getSharedResources({ with: 'me' })` check finds no matching url, DIAL Core's `200` no-op answer to `discardSharedResources` is not passed through, the endpoint responds `403 Forbidden`, and neither cache is invalidated

#### Scenario: Invalid itemId shape rejected

- **WHEN** the request body's `itemId` does not match the allowlisted resource-URL pattern (e.g. contains `../` or is empty)
- **THEN** the endpoint responds `400 Bad Request` before any DIAL Core call is made

#### Scenario: Unauthenticated request

- **WHEN** a request arrives with no valid session cookie
- **THEN** the endpoint responds `401 Unauthorized`

#### Scenario: Resource does not exist

- **WHEN** DIAL Core returns `400` or `404` from `discardSharedResources` for a well-formed `itemId`
- **THEN** the endpoint responds `404 Not Found`

#### Scenario: DIAL Core upstream error

- **WHEN** DIAL Core returns a 5xx status
- **THEN** the endpoint responds `502 Bad Gateway`

#### Scenario: DIAL Core unreachable or timed out

- **WHEN** the call to DIAL Core times out or the connection fails
- **THEN** the endpoint responds `503 Service Unavailable`

#### Scenario: Successful discard invalidates both list caches

- **WHEN** a discard succeeds for a user whose `deployments:list:<userSub>` and `toolsets:list:<userSub>` cache entries are currently populated
- **THEN** both cache entries are invalidated before the response is sent, so the next list request for that user re-fetches from DIAL Core rather than serving the stale (still-including-the-discarded-item) cached list

#### Scenario: Conversation itemId is accepted by the same endpoint

- **WHEN** an authenticated user calls `POST /api/v1/share/discard` with `{ itemId: "conversations/owner-bucket/my-chat" }` for a conversation actually shared with them
- **THEN** the endpoint accepts the request, calls DIAL Core `discardSharedResources` with that itemId, and responds `200 { success: true }` — see the `conversation-unshare-api` capability for the full conversation-specific behavior

#### Scenario: Skill itemId is accepted by the same endpoint

- **WHEN** an authenticated user calls `POST /api/v1/share/discard` with `{ itemId: "skills/owner-bucket/team-a/docs-helper" }` for a whole skill actually shared with them
- **THEN** the endpoint accepts the request, resolves the `SKILL` resource kind via `RESOURCE_KIND_BY_PREFIX`, calls DIAL Core `discardSharedResources` with that itemId, and responds `200 { success: true }`

#### Scenario: Prompt itemId is now accepted directly, with no resourceKind or bucket field

- **WHEN** an authenticated user calls `POST /api/v1/share/discard` with `{ itemId: "prompts/owner-bucket/Work/AI/summarize" }` for a prompt actually shared with them
- **THEN** the endpoint accepts the request (no `resourceKind` or `bucket` field is present or needed), resolves the `PROMPT` resource kind via `RESOURCE_KIND_BY_PREFIX`, calls DIAL Core `discardSharedResources` with that itemId re-encoded through `toShareResourceUrl` (DIAL Core's percent-encoded form), and responds `200 { success: true }`

#### Scenario: Individual skill files cannot be discarded independently

- **WHEN** an `itemId` identifies a single file inside a skill rather than the whole skill (e.g. `skills/owner-bucket/team-a/docs-helper/files/notes.md`)
- **THEN** the `NOT_A_SKILL_FILE_PATTERN` `@Matches` check rejects it with `400 Bad Request`, since only whole-skill URLs are accepted — skills remain whole-resource units for sharing
