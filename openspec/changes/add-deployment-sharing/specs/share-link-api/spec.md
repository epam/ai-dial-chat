## ADDED Requirements

### Requirement: POST /api/v1/share endpoint
The system SHALL expose `POST /api/v1/share` that creates a share link for a catalog entity via DIAL Core and returns the URL, access level, and expiry.

Authorization: requires a valid session; responds 401 when no session is present. The session's DIAL token is forwarded to DIAL Core.

Rate limiting: `@Throttle({ default: { limit: 20, ttl: 60000 } })` — 20 requests per minute per user.

Request body (`CreateShareLinkDto`):
```json
{
  "itemId": "gpt-4o",
  "access": "view"
}
```
- `itemId`: `@IsString()`, `@IsNotEmpty()`, `@Matches(/^[a-zA-Z0-9._\-/]+$/)` (allowlist against path injection)
- `access`: `@IsEnum(ShareLinkAccess)` — `"view"` or `"edit"`

Response body (`ShareLinkResponseDto`):
```json
{
  "url": "https://chat.dialx.ai/marketplace/share/gpt-4o",
  "expiresInDays": 3,
  "access": "view"
}
```
- `url`: absolute URL string
- `expiresInDays`: positive integer
- `access`: `ShareLinkAccess` enum value

Generated client impact:
- `operationId` / SDK method: `createShareLink`
- Request DTO: `CreateShareLinkDto`
- Response DTO: `ShareLinkResponseDto`
- Frontend callers use the normal (non-Raw) generated method.

App-level adapter: `apps/chat/src/server-api/share.api.ts` wraps `shareApi.createShareLink(...)` and is the only file `getShareLink` imports from. Endpoint path and generated client details stay out of `libs/catalog` and other hand-authored libs.

Cache: no caching on this endpoint — each POST produces a fresh link from DIAL Core.

Observability: log at `debug` level on success; log at `error` level with `itemId` and status code on DIAL Core failure. Never log the share URL or access token.

#### Scenario: Successful share link creation (view access)
- **WHEN** an authenticated user POSTs `{ "itemId": "gpt-4o", "access": "view" }`
- **THEN** the endpoint responds 201 with `{ url: "https://…/share/gpt-4o", expiresInDays: 3, access: "view" }`

#### Scenario: Successful share link creation (edit access)
- **WHEN** an authenticated user POSTs `{ "itemId": "my-app-id", "access": "edit" }`
- **THEN** the endpoint responds 201 with `{ url: "https://…/share/my-app-id", expiresInDays: 3, access: "edit" }`

#### Scenario: Unauthenticated request
- **WHEN** a request arrives with no valid session cookie
- **THEN** the endpoint responds 401

#### Scenario: Invalid access value returns 400
- **WHEN** the request body contains `"access": "admin"`
- **THEN** the endpoint responds 400 with a validation error

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

#### Scenario: Successful DIAL Core response mapped to DTO
- **WHEN** DIAL Core returns a valid share-link payload
- **THEN** `ShareService` maps it to `{ url, expiresInDays, access }` matching `ShareLinkResponseDto`

#### Scenario: DIAL Core error mapped to typed exception
- **WHEN** DIAL Core returns a non-success status
- **THEN** `ShareService` throws the appropriate `BadGatewayException` or `ServiceUnavailableException`; it does NOT return `null`

### Requirement: getShareLink seam wires to generated API client
`apps/chat/src/utils/share-link.ts` SHALL export `getShareLink(itemId: string, access: ShareLinkAccess): Promise<ShareLinkData>` that calls the generated `createShareLink` SDK method through `apps/chat/src/server-api/share.api.ts`. The mock implementation SHALL be removed.

Generated client impact: see POST endpoint requirement above.

#### Scenario: getShareLink calls share API wrapper
- **WHEN** `getShareLink('gpt-4o', ShareLinkAccess.View)` is called
- **THEN** it calls `shareApi.createShareLink({ itemId: 'gpt-4o', access: 'view' })` and returns the resolved `ShareLinkData`

#### Scenario: getShareLink propagates API errors
- **WHEN** the API call rejects
- **THEN** `getShareLink` rejects with the same error, which `useShareLink` catches and exposes as `error`
