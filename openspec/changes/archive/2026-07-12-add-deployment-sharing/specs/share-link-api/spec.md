## ADDED Requirements

### Requirement: POST /api/v1/share endpoint
The system SHALL expose `POST /api/v1/share` that creates a share link for a catalog entity via DIAL Core and returns the URL, access level, and expiry.

Authorization: requires a valid session; responds 401 when no session is present. The session's DIAL token is forwarded to DIAL Core.

Rate limiting: `@Throttle({ default: { limit: 20, ttl: 60000 } })` — 20 requests per minute per user.

Request body (`CreateShareLinkDto`):
```json
{
  "itemId": "gpt-4o",
  "access": ["view"]
}
```
- `itemId`: `@IsString()`, `@IsNotEmpty()`, `@Matches(/^[a-zA-Z0-9._\-/]+$/)` (allowlist against path injection)
- `access`: `@IsArray()`, `@ArrayNotEmpty()`, `@IsEnum(ShareAccess, { each: true })` — array of `"view"` / `"edit"`. Edit access implies view access, so "Can edit" is requested as `["view", "edit"]` rather than `["edit"]` alone.

Response body (`ShareLinkResponseDto`):
```json
{
  "url": "https://chat.dialx.ai/catalog/shared/abc123",
  "expiresInDays": 3,
  "access": ["view"]
}
```
- `url`: absolute URL string pointing at the frontend's own `/catalog/shared/:invitationId` route (see the accept-invitation requirement below) — never DIAL Core's raw `invitationLink` path
- `expiresInDays`: positive integer
- `access`: `ShareAccess[]`

Generated client impact:
- `operationId` / SDK method: `createShareLink`
- Request DTO: `CreateShareLinkDto`
- Response DTO: `ShareLinkResponseDto`
- Frontend callers use the normal (non-Raw) generated method.

App-level adapter: `apps/chat/src/server-api/share.api.ts` wraps `shareApi.createShareLink(...)` and is the only file `getShareLink` imports from. Endpoint path and generated client details stay out of `libs/catalog` and other hand-authored libs.

Cache: no caching on this endpoint — each POST produces a fresh link from DIAL Core.

Observability: log at `debug` level on success; log at `error` level with `itemId` and status code on DIAL Core failure. Never log the share URL or access token.

#### Scenario: Successful share link creation (view access)
- **WHEN** an authenticated user POSTs `{ "itemId": "gpt-4o", "access": ["view"] }`
- **THEN** the endpoint responds 201 with `{ url: "https://…/catalog/shared/{invitationId}", expiresInDays: 3, access: ["view"] }`

#### Scenario: Successful share link creation (edit access)
- **WHEN** an authenticated user POSTs `{ "itemId": "my-app-id", "access": ["view", "edit"] }`
- **THEN** the endpoint responds 201 with `{ url: "https://…/catalog/shared/{invitationId}", expiresInDays: 3, access: ["view", "edit"] }` and DIAL Core is asked for the union of both levels' permissions (`READ`, `WRITE`)

#### Scenario: Unauthenticated request
- **WHEN** a request arrives with no valid session cookie
- **THEN** the endpoint responds 401

#### Scenario: Invalid access value returns 400
- **WHEN** the request body contains `"access": ["admin"]`
- **THEN** the endpoint responds 400 with a validation error

#### Scenario: Empty access array returns 400
- **WHEN** the request body contains `"access": []`
- **THEN** the endpoint responds 400 with a validation error (`@ArrayNotEmpty`)

#### Scenario: Invalid itemId (path injection attempt) returns 400
- **WHEN** the request body contains `"itemId": "../etc/passwd"`
- **THEN** the endpoint responds 400 due to `@Matches` validation rejection

#### Scenario: Missing itemId returns 400
- **WHEN** the request body omits `itemId`
- **THEN** the endpoint responds 400 with a validation error

#### Scenario: DIAL Core unavailable
- **WHEN** `DialClientService` call to DIAL Core fails with a network or timeout error
- **THEN** the endpoint responds 503 `ServiceUnavailableException`

#### Scenario: DIAL Core returns a non-200 error
- **WHEN** DIAL Core responds with an error status (e.g. 502)
- **THEN** the endpoint responds 502 `BadGatewayException`

#### Scenario: Rate limit exceeded
- **WHEN** a user sends more than 20 POST requests within 60 seconds
- **THEN** the endpoint responds 429

### Requirement: ShareService delegates to DialClientService
`ShareService` SHALL inject `DialClientService` and call the DIAL Core share endpoint using the SDK client. It SHALL map DIAL Core responses to `ShareLinkResponseDto` and map DIAL Core errors to typed NestJS HTTP exceptions.

If the `@epam/ai-dial-typescript-sdk` does not expose a share method, the service SHALL call DIAL Core via `fetch` using `DialClientService.baseUrl` and document the SDK gap in an inline comment.

Permissions mapping: a module-level `ACCESS_PERMISSIONS: Record<ShareAccess, ResourceAccessType[]>` maps `View → ['READ']` and `Edit → ['READ', 'WRITE']`. Since `access` is an array, the `permissions` sent to DIAL Core's `shareResource` are the de-duplicated union of each array entry's mapped permissions (`access.flatMap(...)` through a `Set`), not a single lookup.

URL construction: DIAL Core's `invitationLink` (e.g. `/v1/invitations/{id}`) is an API path, not a page the SPA can render, and is host-relative to DIAL Core rather than the frontend's public origin. `ShareService.buildInvitationUrl` extracts only the trailing id segment from `invitationLink` (parsed via `new URL(invitationLink, appOrigin)`, so both relative and absolute forms are handled uniformly) and rebuilds `{appOrigin}/catalog/shared/{invitationId}`. It throws `BadGatewayException` if no id segment can be extracted.

#### Scenario: Successful DIAL Core response mapped to DTO
- **WHEN** DIAL Core returns a valid share-link payload
- **THEN** `ShareService` maps it to `{ url, expiresInDays, access }` matching `ShareLinkResponseDto`, with `url` rebuilt from the invitation id per the URL construction rule above

#### Scenario: DIAL Core error mapped to typed exception
- **WHEN** DIAL Core returns a non-success status
- **THEN** `ShareService` throws the appropriate `BadGatewayException` or `ServiceUnavailableException`; it does NOT return `null`

#### Scenario: Edit access requests the union of READ and WRITE permissions
- **WHEN** `createShareLink` is called with `access: [ShareAccess.View, ShareAccess.Edit]`
- **THEN** DIAL Core's `shareResource` is called with `permissions: ['READ', 'WRITE']`

### Requirement: GET /api/v1/share/invitations/:invitationId endpoint
The system SHALL expose `GET /api/v1/share/invitations/:invitationId` that accepts a share invitation via DIAL Core — granting the authenticated user the invitation's access level — and returns the shared entity's identifier.

Authorization: requires a valid session; responds 401 when no session is present.

Rate limiting: `@Throttle({ default: { limit: 20, ttl: 60000 } })`.

Path param (`GetInvitationDto`):
- `invitationId`: `@IsString()`, `@Matches(/^[\w-]+$/)` (allowlist; the value is embedded in a DIAL Core API path)

Response body (`AcceptInvitationResponseDto`):
```json
{
  "itemId": "gpt-4o"
}
```
- `itemId`: the DIAL Core resource path from the invitation's first `resources[0].url`

`ShareService.acceptInvitation` SHALL call `DialClientService.client.getInvitation(invitationId, { headers, params: { query: { accept: true } } })`, forwarding the session's DIAL token via the same `getBearerAuthHeaders` helper used by `createShareLink`. `accept: true` is the DIAL Core semantic that actually grants the permission — a plain `GET` without it would only fetch invitation details without accepting.

If DIAL Core returns an invitation with an empty `resources` array, the service SHALL throw `BadGatewayException` rather than returning a DTO with an undefined `itemId`.

Generated client impact:
- `operationId` / SDK method: `acceptInvitation`
- Response DTO: `AcceptInvitationResponseDto`

App-level adapter: `apps/chat/src/server-api/share.api.ts` exports `acceptInvitation(invitationId: string): Promise<AcceptInvitationResponseDto>`, wrapping `shareApi.acceptInvitation({ invitationId })`.

#### Scenario: Successful invitation acceptance
- **WHEN** an authenticated user GETs `/api/v1/share/invitations/abc123` for an invitation sharing `gpt-4o`
- **THEN** the endpoint responds 200 with `{ itemId: "gpt-4o" }` and DIAL Core has granted the user the invitation's access level

#### Scenario: Unauthenticated request
- **WHEN** a request arrives with no valid session cookie
- **THEN** the endpoint responds 401

#### Scenario: Invalid invitationId returns 400
- **WHEN** the path param contains characters outside `[\w-]` (e.g. a `/`)
- **THEN** the endpoint responds 400 with a validation error

#### Scenario: Invitation not found, expired, or revoked
- **WHEN** DIAL Core responds 404 for the given invitationId
- **THEN** the endpoint responds 404

#### Scenario: Invitation with no shared resource
- **WHEN** DIAL Core returns an invitation whose `resources` array is empty
- **THEN** the endpoint responds 502 `BadGatewayException`

#### Scenario: DIAL Core unavailable
- **WHEN** the DIAL Core call fails with a network or timeout error
- **THEN** the endpoint responds 503 `ServiceUnavailableException`

#### Scenario: Rate limit exceeded
- **WHEN** a user sends more than 20 requests within 60 seconds
- **THEN** the endpoint responds 429

### Requirement: getShareLink seam wires to generated API client
`apps/chat/src/utils/share-link.ts` SHALL export `getShareLink(itemId: string, access: ShareLinkAccess[]): Promise<ShareLinkData>` that calls the generated `createShareLink` SDK method through `apps/chat/src/server-api/share.api.ts`. The mock implementation SHALL be removed.

`access` defaults to `[ShareLinkAccess.View]`. The response's `access` (an array of `ShareLinkResponseDtoAccessEnum`, the backend's own enum) is mapped element-by-element to the frontend's `ShareLinkAccess` enum via `toShareLinkAccess`.

Generated client impact: see POST endpoint requirement above.

#### Scenario: getShareLink calls share API wrapper
- **WHEN** `getShareLink('gpt-4o', [ShareLinkAccess.View])` is called
- **THEN** it calls `shareApi.createShareLink({ itemId: 'gpt-4o', access: ['view'] })` and returns the resolved `ShareLinkData`

#### Scenario: getShareLink propagates API errors
- **WHEN** the API call rejects
- **THEN** `getShareLink` rejects with the same error, which `useShareLink` catches and exposes as `error`
