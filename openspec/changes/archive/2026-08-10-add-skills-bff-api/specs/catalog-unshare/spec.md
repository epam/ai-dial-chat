## MODIFIED Requirements

### Requirement: BFF discard-shared-catalog-item endpoint

The system SHALL expose `POST /api/v1/share/discard` on the existing `ShareController` (`apps/chat-api/src/share/`), allowing an authenticated session user to discard their own access to a catalog resource (application or toolset), **a skill**, or a conversation that is currently shared with them via DIAL Core `discardSharedResources`.

The endpoint SHALL:
- Require a valid session; respond `401 Unauthorized` when no session is present.
- Accept `DiscardSharedCatalogItemDto { itemId: string }` validated via NestJS `ValidationPipe` (whitelist, forbidNonWhitelisted, transform); `itemId` SHALL be a non-empty string, max length 2048, validated with the existing `IsValidFilePath` validator and an `@Matches` allowlist restricted to `applications/{bucket}/{path}`, `toolsets/{bucket}/{path}`, `conversations/{bucket}/{path}`, **or `skills/{bucket}/{path}`**. Other DIAL resource types and incomplete paths SHALL be rejected before calling DIAL Core. Because the shared `@Matches` pattern's trailing segment is unrestricted (it also matches deeper nested paths), a `skills/`-prefixed `itemId` containing a `/files/` segment SHALL be additionally rejected by a supplementary validator on `DiscardSharedCatalogItemDto`, so only whole-skill URLs (never a single in-skill file URL) are accepted — skills remain whole-resource units for sharing.
- Use the session `accessToken` as the Bearer credential when calling DIAL Core.
- Call SDK `discardSharedResources({ headers, body: { resources: [{ url: itemId }] } })` with no bucket/path reconstruction — `itemId` is passed through unmodified as the resource `url`, matching the existing `createShareLink` pattern (`share.service.ts`) rather than the file-manager `bucket`+`path` reconstruction pattern.
- Rely on DIAL Core to enforce that the resource is currently shared with the caller; a resource not shared with the caller SHALL surface as `403 Forbidden` via `mapDialHttpStatus`, not a silent 200.
- Resolve the DIAL Core `resourceTypes` filter used by the pre-discard "was this shared with me" check (`ShareService.isSharedWithCaller`) via `RESOURCE_KIND_BY_PREFIX` (`share.service.ts`), which SHALL include a `['skills/', 'SKILL']` entry alongside the existing `applications/` → `APPLICATION`, `toolsets/` → `TOOL_SET`, and `conversations/` → `CONVERSATION` entries.
- On success, invalidate both `DeploymentsService.invalidateListCache(userSub)` and `ToolsetsService.invalidateListCache(userSub)` before responding, mirroring the existing invalidation call in `ShareService.acceptInvitation`. **This invalidation runs unconditionally regardless of `itemId` type; conversations and skills have no equivalent server-side list cache today, so for a conversation or skill `itemId` this invalidation is a harmless no-op — see the `conversation-unshare-api` capability for the conversation-side consistency model (client-driven `refreshConversations()`); skills have no list-cache invalidation need today per the `skills-bff-api` cache decision (no caching in the initial implementation).**
- Respond `200 OK` with `DiscardSharedCatalogItemResponseDto { success: true }` on success.
- Apply `@Throttle({ default: { limit: 10, ttl: 60000 } })`, matching the file-manager `discard-shared` endpoint's stricter-than-share-creation posture.
- Map upstream failures via the fetch-shaped `mapDialHttpStatus`/`handleDialFetchError` pair (consistent with `ShareService`'s other methods): DIAL Core 400 → 400, 401 → 401, 403 → 403, 404 → 404, 429 → 429, 5xx → 502, network/timeout → 503.
- Not cache the mutation response itself.
- Log structured success/failure messages (e.g. `Discard shared resource started`, `Discard shared resource completed: success=true`, `DIAL Core returned <status> for share.discardShared`) without the access token, invitation links, full resource path, or any other user data beyond a safe operation identifier.

Controller handler name / OpenAPI operationId: **`discardSharedCatalogItem`** → generated client method `discardSharedCatalogItem()`. The `@ApiOperation.description` SHALL read "Discards the caller's own access to a shared catalog entity (application or toolset), a skill, or a conversation".

**Example request:**
```http
POST /api/v1/share/discard
Content-Type: application/json

{ "itemId": "skills/owner-bucket/team-a/docs-helper" }
```

**Example response (200):**
```json
{ "success": true }
```

**Generated-client impact**: no new operation — `discardSharedCatalogItem` already exists; only the accepted `itemId` shape widens. Request DTO `DiscardSharedCatalogItemDto { itemId: string }`, response DTO `DiscardSharedCatalogItemResponseDto { success: boolean }` are unchanged in shape.

Note: the backend/generated DTOs are named `DiscardSharedCatalogItemDto`/`DiscardSharedCatalogItemResponseDto` rather than the shorter `DiscardSharedDto`/`DiscardSharedResponseDto`, because the File Manager domain already defines DTOs with those exact names for its own (unrelated) discard-shared-file endpoint — the OpenAPI generator keys generated models by class name globally, so two domains cannot reuse the same DTO class name without a collision.

#### Scenario: Successful discard

- **WHEN** an authenticated user calls `POST /api/v1/share/discard` with `{ itemId: "applications/owner-bucket/my-app" }` for an application actually shared with them
- **THEN** the endpoint calls DIAL Core `discardSharedResources` with `{ resources: [{ url: "applications/owner-bucket/my-app" }] }`, invalidates both the deployments and toolsets list caches for the caller, and responds `200 { success: true }`

#### Scenario: Discarding a resource not shared with the caller

- **WHEN** the `itemId` refers to a resource DIAL Core does not consider shared with the calling user
- **THEN** DIAL Core's error response is mapped to `403 Forbidden`; neither cache is invalidated

#### Scenario: Invalid itemId shape rejected

- **WHEN** the request body's `itemId` does not match the allowlisted resource-URL pattern (e.g. contains `../` or is empty)
- **THEN** the endpoint responds `400 Bad Request` before any DIAL Core call is made

#### Scenario: Unauthenticated request

- **WHEN** a request arrives with no valid session cookie
- **THEN** the endpoint responds `401 Unauthorized`

#### Scenario: Resource does not exist

- **WHEN** DIAL Core returns a not-found status for the given `itemId`
- **THEN** the endpoint responds `404 Not Found`

#### Scenario: Rate limit exceeded

- **WHEN** the calling session exceeds 10 requests per 60 seconds to this endpoint
- **THEN** the endpoint responds `429 Too Many Requests`

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

#### Scenario: Skill itemId is now accepted by the same endpoint

- **WHEN** an authenticated user calls `POST /api/v1/share/discard` with `{ itemId: "skills/owner-bucket/team-a/docs-helper" }` for a whole skill actually shared with them
- **THEN** the endpoint accepts the request (no longer rejecting the `skills/` prefix as invalid), resolves the `SKILL` resource kind via `RESOURCE_KIND_BY_PREFIX`, calls DIAL Core `discardSharedResources` with that itemId, and responds `200 { success: true }`

#### Scenario: Individual skill files cannot be discarded independently

- **WHEN** an `itemId` identifies a single file inside a skill rather than the whole skill (e.g. `skills/owner-bucket/team-a/docs-helper/files/notes.md`)
- **THEN** the supplementary `/files/`-segment validator rejects it with `400 Bad Request`, since only whole-skill URLs are accepted — skills remain whole-resource units for sharing
