# Spec Delta

## MODIFIED Requirements

### Requirement: BFF revoke-shared-access endpoint

The system SHALL expose `POST /api/v1/share/revoke` on the existing `ShareController` (`apps/chat-api/src/share/share.controller.ts`), allowing an authenticated session user who owns a catalog resource (application, toolset, or skill), a prompt, or a conversation to revoke **all** outstanding shared access to it via DIAL Core `revokeSharedResources`.

The endpoint SHALL:

- Require a valid session; respond `401 Unauthorized` when no session is present.
- Accept `RevokeSharedAccessDto { itemId: string }` validated via the global NestJS `ValidationPipe` (whitelist, forbidNonWhitelisted, transform). `itemId` SHALL be a non-empty string, max length 2048, validated with the `IsDialResourceId` validator (see the `dial-resource-id-validation` capability) and the shared `IsCatalogResourcePath` validator (`apps/chat-api/src/share/dto/catalog-resource-path.validator.ts`), whose `CATALOG_RESOURCE_PATH_PATTERN` allowlist is restricted to `applications/{bucket}/{path}`, `toolsets/{bucket}/{path}`, `conversations/{bucket}/{path}`, `skills/{bucket}/{path}`, **or `prompts/{bucket}/{path}`** — the same validator `DiscardSharedCatalogItemDto` uses (`apps/chat-api/src/share/dto/discard-shared-catalog-item.dto.ts`; that DTO additionally rejects `skills/.../files/...` paths with an `@Matches`, which `RevokeSharedAccessDto` does not). Other DIAL resource types and incomplete paths SHALL be rejected before any DIAL Core call. `RevokeSharedAccessDto` carries no `resourceKind` field — every `itemId`, prompts included, is a self-sufficient full resource path.
- Use the session `accessToken` as the Bearer credential, via `getBearerAuthHeaders`.
- Call SDK `revokeSharedResources({ headers, body: { resources: [{ url: toShareResourceUrl(itemId) }] } })` with no bucket/path reconstruction. `toShareResourceUrl` (`apps/chat-api/src/share/utils/share-resource.util.ts`) passes every `itemId` through unchanged except a `prompts/` id, which is re-encoded with `encodeDialResourcePath` because prompt list ids are the decoded, human-readable path.
- NOT perform any pre-flight `getSharedResources` check. Unlike `discardShared`, a resource with no current recipients is a legitimate no-op success for the owner, not a condition to surface as an error.
- Check ownership before calling DIAL Core: every allowlisted `itemId` is `{type}/{bucket}/{path}`, and when `{bucket}` is not the caller's session bucket the endpoint SHALL respond `403 Forbidden` (`'Only the resource owner can revoke shared access'`) without calling DIAL Core. DIAL Core answers a non-owner with a generic `400`, which the mapping below would otherwise turn into `404`. This bucket comparison is not a `getSharedResources` pre-flight.
- On success, invalidate both `DeploymentsService.invalidateListCache(userSub)` and `ToolsetsService.invalidateListCache(userSub)` before responding, unconditionally regardless of `itemId` type, mirroring `ShareManagementService.discardShared`. Conversations, skills, and prompts have no equivalent server-side list cache, so for those `itemId` types this is a harmless no-op.
- Respond `200 OK` with `RevokeSharedAccessResponseDto { success: true }`. DIAL Core returns an empty 200 body for this operation, so the response is synthesized by the BFF.
- Map upstream failures via the fetch-shaped `mapDialHttpStatus` / `handleDialFetchError` pair (the 400 case is handled inline in `ShareManagementService.revokeShared` before `mapDialHttpStatus` is reached): DIAL Core 400 → 404 (`'Resource does not exist'`, since the DTO already rejects malformed itemIds so a Core 400 can only mean an unresolvable resource — same reasoning as `discardShared`), 401 → 401, 403 → 403, 404 → 404, 429 → 429, 5xx → 502, network/timeout → 503.
- Not cache the mutation response.
- Log structured start/completion messages (e.g. `Revoke shared access started`, `Revoke shared access completed: success=true`) without the access token, invitation links, full resource path, or any other user data.

The existing `RESOURCE_KIND_BY_PREFIX` map (`apps/chat-api/src/share/utils/share-resource.util.ts`), read through `resolveResourceKind`, maps `applications/` → `APPLICATION`, `toolsets/` → `TOOL_SET`, `conversations/` → `CONVERSATION`, `skills/` → `SKILL`, and `prompts/` → `PROMPT`. `revokeShared` itself sends no `resourceTypes` filter; the map is used by `getRecipientsCount` and `discardShared`.

Controller handler name / OpenAPI operationId: **`revokeSharedAccess`** → generated client method `revokeSharedAccess()`.

**Example request:**
```http
POST /api/v1/share/revoke
Content-Type: application/json

{ "itemId": "skills/owner-bucket/team-a/docs-helper" }
```

**Example response (200):**
```json
{ "success": true }
```

**Generated-client impact**: no new operation — `revokeSharedAccess` already exists; only the accepted `itemId` shape widens. Request DTO `RevokeSharedAccessDto { itemId: string }`, response DTO `RevokeSharedAccessResponseDto { success: boolean }` are unchanged in shape. Regenerating via `npm run openapi` updates only the Swagger-derived `@ApiProperty.example`/description text if changed, not the DTO's field list.

Authorization: any authenticated session user may call the endpoint; the BFF rejects an `itemId` outside the caller's bucket with 403, and DIAL Core still authorizes the specific resource. The endpoint is NOT gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — `apps/chat-api` reads no feature-flag environment variables, and neither the share-create nor the discard endpoint is gated.

Observability: no new metrics. The endpoint is covered by the existing global `MetricsInterceptor` and the structured log lines above.

#### Scenario: Successful revoke

- **WHEN** an authenticated owner calls `POST /api/v1/share/revoke` with `{ itemId: "applications/owner-bucket/my-app" }`
- **THEN** the endpoint calls DIAL Core `revokeSharedResources` with `{ resources: [{ url: "applications/owner-bucket/my-app" }] }`, invalidates both the deployments and toolsets list caches for the caller, and responds `200 { success: true }`

#### Scenario: Revoking a resource nobody currently holds succeeds

- **WHEN** the owner revokes a resource that was never shared, or whose recipients have all already discarded it
- **THEN** no `getSharedResources` call is made, DIAL Core's success response is passed through, and the endpoint responds `200 { success: true }`

#### Scenario: Non-owner is rejected

- **WHEN** a caller whose session bucket is `my-bucket` calls the endpoint with `{ itemId: "applications/other-bucket/my-app" }`
- **THEN** the endpoint responds `403 Forbidden` without calling DIAL Core, and neither cache is invalidated

#### Scenario: Invalid itemId shape rejected

- **WHEN** the request body's `itemId` does not match the allowlisted resource-URL pattern (e.g. contains `../`, is empty, or names another DIAL resource type)
- **THEN** the endpoint responds `400 Bad Request` before any DIAL Core call is made

#### Scenario: Unauthenticated request

- **WHEN** a request arrives with no valid session cookie
- **THEN** the endpoint responds `401 Unauthorized`

#### Scenario: Resource does not exist

- **WHEN** DIAL Core returns `400` or `404` for the given `itemId`
- **THEN** the endpoint responds `404 Not Found`

#### Scenario: DIAL Core upstream error

- **WHEN** DIAL Core returns a 5xx status
- **THEN** the endpoint responds `502 Bad Gateway`

#### Scenario: DIAL Core unreachable or timed out

- **WHEN** the call to DIAL Core times out or the connection fails
- **THEN** the endpoint responds `503 Service Unavailable`

#### Scenario: Skill itemId is accepted by the revoke endpoint

- **WHEN** an authenticated owner calls `POST /api/v1/share/revoke` with `{ itemId: "skills/owner-bucket/team-a/docs-helper" }` for a skill they own
- **THEN** the endpoint accepts the request, calls DIAL Core `revokeSharedResources` with that itemId unchanged, and responds `200 { success: true }`

#### Scenario: Prompt itemId is now accepted by the revoke endpoint, with no resourceKind field

- **WHEN** an authenticated owner calls `POST /api/v1/share/revoke` with `{ itemId: "prompts/owner-bucket/Work/AI/summarize" }` for a prompt they own
- **THEN** the endpoint accepts the request (no `resourceKind` field is present or needed), calls DIAL Core `revokeSharedResources` with that itemId re-encoded by `toShareResourceUrl` (identical to the input when it contains no characters needing percent-encoding), and responds `200 { success: true }`

#### Scenario: Malformed skill itemId is still rejected

- **WHEN** the request body's `itemId` is `skills/owner-bucket` (missing the item path segment) or `skills//team-a/docs-helper` (empty bucket segment)
- **THEN** the endpoint responds `400 Bad Request` before any DIAL Core call is made, identically to a malformed `applications/...` or `toolsets/...` itemId

#### Scenario: itemId containing characters DIAL Core allows is accepted

- **WHEN** the request body's `itemId` is `conversations/owner-bucket/anthropic.claude-haiku-4-5-20251001-v1:0__hi__{uuid}` (a literal `:` in the model id)
- **THEN** `itemId` validation passes and the endpoint proceeds to the ownership check and the DIAL Core call

### Requirement: `GET /api/v1/share/recipients` reports how many users hold shared access

`ShareController` SHALL expose `GET /api/v1/share/recipients?itemId=...`, answering `ShareRecipientsResponseDto { itemId, recipientsCount }`.

`GetShareRecipientsDto` (`apps/chat-api/src/share/dto/share-recipients.dto.ts`) SHALL validate `itemId` with the same validators as `RevokeSharedAccessDto` (`IsCatalogResourcePath` with the `applications|toolsets|conversations|skills|prompts` prefix, `IsDialResourceId`, `@MaxLength(2048)`) and carries no `resourceKind` field: a resource revoke cannot act on has no count worth answering, and every accepted resource type — prompts included — is now identified by one self-sufficient `itemId`.

`ShareManagementService.getRecipientsCount` SHALL convert `itemId` with `toShareResourceUrl`, call `getSharedResources({ resourceTypes: [resolveResourceKind(url)], with: 'others', includeUserInfo: true })` and pick the one resource out of that set with `countRecipientsByUrl` + `resolveRecipientsCount(counts, url, safeDecodeURIComponent(url))` — both encodings are tried because list ids and DIAL Core share urls differ in percent-encoding for some resource types. DIAL Core has no single-resource variant of this query. `resolveResourceKind` SHALL resolve `skills/`-prefixed ids to `SKILL` and `prompts/`-prefixed ids to `PROMPT` via the existing `RESOURCE_KIND_BY_PREFIX` map, unchanged by this capability.

DIAL Core omits resources nobody currently holds from a **successful** response, so a resource missing from a successful result SHALL answer `0`. An upstream failure SHALL surface as an HTTP error mapped by `mapDialHttpStatus` / `handleDialFetchError` (DIAL Core 4xx statuses such as 401/403/404/429 pass through as the matching exception, 5xx → `502`, network/timeout → `503`) rather than as a count, leaving the caller to decide how to degrade — a fabricated `0` would silently remove the owner's only way to revoke.

`ShareMetadata` entries are only produced for users who **accepted** an invitation, so `recipientsCount` counts accepted grants. An issued-but-unopened share link contributes nothing and reads as `0`.

**No count is carried on list items.** `DeploymentItemDto`, `DialToolsetDto`, `ConversationListItemDto`, `SkillMetadataItemDto`, and `PromptResponseDto` SHALL NOT expose a `recipientsCount` field, and `DeploymentsListingService`, `ToolsetsListingService`, `ConversationListingService`, `SkillsListingService`, and the prompts listing services SHALL each issue exactly one `getSharedResources` call (`with: 'me'`, for ownership flags) per listing request. A count taken at list-fetch time and cached for 30 seconds outlives the fact it describes — after a successful revoke the list still reported the pre-revoke recipients, so the Manage menu went on offering "Revoke access (3)" until a full page reload.

Shared helpers: `countRecipientsByUrl` and `resolveRecipientsCount` in `apps/chat-api/src/common/utils/resource-ownership.ts`.

#### Scenario: Count is read for the requested resource

- **WHEN** the shared-with-others set contains `{ url: 'applications/BUCKET/my-app', sharedWith: [a, b] }`
- **THEN** `GET /api/v1/share/recipients?itemId=applications/BUCKET/my-app` answers `{ itemId, recipientsCount: 2 }`

#### Scenario: Resource absent from a successful response counts as zero

- **WHEN** the upstream call succeeds and does not mention the requested resource
- **THEN** the endpoint answers `recipientsCount: 0`, so the UI hides the revoke action

#### Scenario: Upstream failure is surfaced, not smoothed over

- **WHEN** DIAL Core returns a 5xx status or is unreachable
- **THEN** the endpoint responds `502`/`503` respectively, and no count is invented

#### Scenario: Non-revocable resource is rejected

- **WHEN** `itemId` names a file or a traversal path
- **THEN** the endpoint responds `400` and DIAL Core is never called

#### Scenario: List endpoints no longer pay for the count

- **WHEN** a deployments list containing many items is requested
- **THEN** `getSharedResources` is called exactly once, with `with: 'me'`, and no item carries a `recipientsCount`

#### Scenario: Recipient count for a shared skill

- **WHEN** the shared-with-others set contains `{ url: 'skills/owner-bucket/team-a/docs-helper', sharedWith: [a] }`
- **THEN** `GET /api/v1/share/recipients?itemId=skills/owner-bucket/team-a/docs-helper` resolves `resolveResourceKind` to `'SKILL'` and answers `{ itemId, recipientsCount: 1 }`

#### Scenario: Recipient count for a shared prompt, with no resourceKind field

- **WHEN** the shared-with-others set contains `{ url: 'prompts/owner-bucket/Work/AI/summarize', sharedWith: [a, b] }`
- **THEN** `GET /api/v1/share/recipients?itemId=prompts/owner-bucket/Work/AI/summarize` (no `resourceKind` query param present or needed) resolves `resolveResourceKind` to `'PROMPT'` and answers `{ itemId, recipientsCount: 2 }`
