# toolset-listing Specification

## Purpose

The authenticated toolset list endpoint and the frontend server-api helper.

## ADDED Requirements

### Requirement: Authenticated toolset list endpoint

The BFF SHALL expose `GET /api/v1/toolsets` that returns the list of DIAL Core toolsets visible to the authenticated session user.

The endpoint:

- MUST require a valid BFF session cookie (`SessionGuard`); unauthenticated requests SHALL be rejected with `401 Unauthorized`
- MUST proxy to `GET <DIAL_CORE_URL>/openai/toolsets` forwarding `Authorization: Bearer <session.at>` as the upstream auth header
- MUST call DIAL Core using `@epam/ai-dial-typescript-sdk` method `getToolSets({ headers })` when available
- MUST NOT forward the `DIAL_API_KEY` to the client or use it as the upstream credential on this route
- SHALL return `200 OK` with body `{ "data": DialToolset[] }` mirroring the DIAL Core response shape
- SHALL apply per-route rate limiting of **60 req/min per IP** via `@Throttle({ default: { limit: 60, ttl: 60000 } })`
- SHALL cache the upstream response server-side for **30 seconds** using cache key `toolsets:list:<user.sub>`; a cache hit MUST NOT re-call DIAL Core
- MUST set `Cache-Control: private, max-age=30` on the HTTP response
- SHALL map upstream errors via `mapDialHttpStatus` / `handleDialFetchError` (401 → 401, 403 → 403, 429 → 429, 5xx → 502, network/timeout → 503)
- Controller handler name / OpenAPI operationId: **`listToolsets`** → generated client method `listToolsets()`

**Example response (200):**

```json
{
  "data": [
    {
      "id": "toolsets/encrypted-bucket/folder/toolset-name",
      "toolset": "toolsets/encrypted-bucket/folder/toolset-name",
      "display_name": "Toolset display name",
      "display_version": "0.0.1",
      "description": "My toolset description",
      "icon_url": "",
      "owner": "Owner's name",
      "object": "toolset",
      "status": "succeeded",
      "description_keywords": ["keyword1", "keyword2"],
      "reference": "ff5584b7-a82b-4f4f-bf42-5bf74a3893d6",
      "max_retry_attempts": 2,
      "created_at": 1672534800,
      "updated_at": 1672534900,
      "transport": "HTTP",
      "allowed_tools": ["tool1", "tool2"],
      "auth_settings": {
        "authentication_type": "OAUTH",
        "client_id": "my-client-id",
        "redirect_uri": "",
        "authorization_endpoint": "",
        "token_endpoint": "",
        "code_challenge_method": "S256",
        "scopes_supported": ["scope1", "scope2"],
        "global_auth_status": "SIGNED_OUT",
        "user_level_auth_status": "SIGNED_OUT"
      }
    }
  ]
}
```

#### Scenario: Authenticated user receives toolset list

- **WHEN** a request with a valid session cookie is sent to `GET /api/v1/toolsets`
- **THEN** the BFF returns `200` with `{ "data": [...] }` where each item is a `DialToolset` object

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request to `GET /api/v1/toolsets` is sent without a session cookie
- **THEN** the BFF returns `401 Unauthorized`

#### Scenario: Upstream returns 403

- **WHEN** DIAL Core responds with `403`
- **THEN** the BFF returns `403 Forbidden` to the caller

#### Scenario: Upstream is unreachable or times out

- **WHEN** DIAL Core does not respond within the configured timeout
- **THEN** the BFF returns `503 Service Unavailable`

#### Scenario: Rate limit exceeded

- **WHEN** a caller sends more than 60 requests per minute to this endpoint
- **THEN** the BFF returns `429 Too Many Requests`

#### Scenario: Cache hit avoids upstream call

- **WHEN** `GET /api/v1/toolsets` is called twice within 30 seconds for the same authenticated user
- **THEN** only one upstream request is made to DIAL Core; the second response is served from cache

---

### Requirement: Frontend server-api helper for toolset listing

`apps/chat/src/server-api/toolsets.ts` SHALL export a typed async function `listToolsets` that:

- Calls the generated `@epam/chat-api-client` method `listToolsets()` via `toolsetsApi` from `server-api/api-client.ts`
- Returns `Promise<DialToolsetListResponseDto>`

No direct `fetch` calls are permitted in this helper.

#### Scenario: Helper returns typed list

- **WHEN** `listToolsets()` is called from a component or hook
- **THEN** the return type is `Promise<DialToolsetListResponseDto>` and TypeScript infers `data` as `DialToolsetDto[]`
