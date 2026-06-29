## ADDED Requirements

### Requirement: Authenticated toolset lookup endpoint

The BFF SHALL expose `GET /api/v1/toolsets/:toolsetName` that returns a single DIAL Core toolset by name for the authenticated session user.

The endpoint:

- MUST require a valid BFF session cookie (`SessionGuard`); unauthenticated requests SHALL be rejected with `401 Unauthorized`
- MUST proxy to `GET <DIAL_CORE_URL>/openai/toolsets/{toolsetName}` forwarding `Authorization: Bearer <session.at>` as the upstream auth header
- MUST call DIAL Core using `@epam/ai-dial-typescript-sdk` method `getToolset(toolsetName, { headers })`
- MUST NOT forward the `DIAL_API_KEY` to the client or use it as the upstream credential on this route
- SHALL return `200 OK` with a `DialToolset` object body on success
- SHALL return `404 Not Found` when DIAL Core responds with `404`
- SHALL apply per-route rate limiting of **60 req/min per IP** via `@Throttle({ default: { limit: 60, ttl: 60000 } })`
- SHALL cache the upstream response server-side for **60 seconds** using cache key `toolsets:single:<user.sub>:<toolsetName>`; a cache hit MUST NOT re-call DIAL Core
- MUST set `Cache-Control: private, max-age=60` on the HTTP response
- SHALL map upstream errors via `mapDialHttpStatus` / `handleDialFetchError`
- Controller handler name / OpenAPI operationId: **`getToolset`** → generated client method `getToolset({ toolsetName })`
- If upstream `auth_settings` contains `client_secret`, the BFF MUST omit that field before returning the response

**Example response (200):**

```json
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
```

#### Scenario: Authenticated user retrieves a toolset by name

- **WHEN** a request with a valid session cookie is sent to `GET /api/v1/toolsets/my-toolset`
- **THEN** the BFF returns `200` with the corresponding `DialToolset` JSON object

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request to `GET /api/v1/toolsets/my-toolset` is sent without a session cookie
- **THEN** the BFF returns `401 Unauthorized`

#### Scenario: Toolset not found

- **WHEN** DIAL Core responds with `404` for the requested toolset name
- **THEN** the BFF returns `404 Not Found`

#### Scenario: Upstream returns 403

- **WHEN** DIAL Core responds with `403`
- **THEN** the BFF returns `403 Forbidden` to the caller

#### Scenario: Rate limit exceeded

- **WHEN** a caller sends more than 60 requests per minute to this endpoint
- **THEN** the BFF returns `429 Too Many Requests`

#### Scenario: Cache hit avoids upstream call

- **WHEN** `GET /api/v1/toolsets/my-toolset` is called twice within 60 seconds for the same user
- **THEN** only one upstream request is made to DIAL Core; the second response is served from cache

---

### Requirement: Toolset name path parameter validation

The `:toolsetName` path parameter MUST be validated with an allowlist regex to prevent path-traversal and injection.

Allowed characters: `[a-zA-Z0-9_\-.:@]`. Slash-separated namespaced names must be URL-encoded by the caller (`/` → `%2F`) before being sent as the path param.

Any character outside the allowlist SHALL cause the BFF to return `400 Bad Request` before making any upstream call.

#### Scenario: Valid toolset name passes validation

- **WHEN** the path param is `my-toolset`, `folder.toolset-v1`, or `@org/toolset:tag`
- **THEN** the request proceeds to upstream proxying

#### Scenario: Invalid toolset name is rejected

- **WHEN** the path param contains `../`, whitespace, or other disallowed characters
- **THEN** the BFF returns `400 Bad Request` without calling DIAL Core

---

### Requirement: Frontend server-api helper for toolset lookup

`apps/chat/src/server-api/toolsets.ts` SHALL export a typed async function `getToolset` that:

- Accepts `toolsetName: string`
- Calls the generated `@epam/chat-api-client` method `getToolset({ toolsetName })` via `toolsetsApi`
- Returns `Promise<DialToolsetDto>`

No direct `fetch` calls are permitted in this helper.

#### Scenario: Helper returns typed single toolset

- **WHEN** `getToolset('my-toolset')` is called
- **THEN** the return type is `Promise<DialToolsetDto>`
