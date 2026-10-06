# toolset-listing Specification

## Purpose

The authenticated toolset list endpoint and the frontend server-api helper.

## Requirements

### Requirement: Authenticated toolset list endpoint

The BFF SHALL expose `GET /api/v1/toolsets` that returns the list of DIAL Core toolsets visible to the authenticated session user.

The endpoint:

- MUST require a valid BFF session cookie (`SessionGuard`); unauthenticated requests SHALL be rejected with `401 Unauthorized`
- MUST proxy to `GET <DIAL_CORE_URL>/openai/toolsets` forwarding `Authorization: Bearer <session.at>` as the upstream auth header
- MUST call DIAL Core using `@epam/ai-dial-typescript-sdk` method `getToolSets({ headers })` when available
- MUST NOT forward the `DIAL_API_KEY` to the client or use it as the upstream credential on this route
- SHALL return `200 OK` with body `DialToolsetListResponseDto` (`{ "data": DialToolsetDto[] }`): upstream entries whose `id` is empty or contains `.dial_folder` are dropped (`isVisibleToolset`), each remaining entry is converted to camelCase by `mapDialToolsetToDto`, and each is enriched per request with `isInstalled` (from the user config's installed toolset ids) and the `isMy` / `canEdit` / `sharedWithMe` ownership flags (from a best-effort `getSharedResources` call for `TOOL_SET` resources)
- SHALL cache the mapped upstream list server-side for **30 seconds** using cache key `toolsets:list:<user.sub>`; a cache hit MUST NOT re-call `getToolSets` (`/openai/toolsets`), while the per-request ownership enrichment still runs
- MUST NOT set a client-facing `Cache-Control` header on this response, so a browser never serves a stale copy across a login/logout that already invalidated the server-side cache (`ToolsetsListingService.invalidateCaches` clears `toolsets:list:<user.sub>` after every toolset write and auth change)
- SHALL map upstream errors via `mapDialHttpStatus` / `handleDialFetchError` (401 → 401, 403 → 403, 429 → 429, 5xx → 502, network/timeout → 503)
- Controller handler name / OpenAPI operationId: **`listToolsets`** → generated client method `listToolsets()`

**Example response (200):**

```json
{
  "data": [
    {
      "id": "toolsets/encrypted-bucket/folder/toolset-name",
      "toolset": "toolsets/encrypted-bucket/folder/toolset-name",
      "displayName": "Toolset display name",
      "displayVersion": "0.0.1",
      "description": "My toolset description",
      "iconUrl": "",
      "owner": "Owner's name",
      "object": "toolset",
      "status": "succeeded",
      "descriptionKeywords": ["keyword1", "keyword2"],
      "reference": "ff5584b7-a82b-4f4f-bf42-5bf74a3893d6",
      "maxRetryAttempts": 2,
      "createdAt": 1672534800,
      "updatedAt": 1672534900,
      "transport": "HTTP",
      "allowedTools": ["tool1", "tool2"],
      "authSettings": {
        "authenticationType": "OAUTH",
        "clientId": "my-client-id",
        "redirectUri": "",
        "authorizationEndpoint": "",
        "tokenEndpoint": "",
        "codeChallengeMethod": "S256",
        "scopesSupported": ["scope1", "scope2"],
        "globalAuthStatus": "SIGNED_OUT",
        "userLevelAuthStatus": "SIGNED_OUT"
      },
      "isInstalled": false,
      "isMy": true,
      "canEdit": true,
      "sharedWithMe": false
    }
  ]
}
```

#### Scenario: Authenticated user receives toolset list

- **WHEN** a request with a valid session cookie is sent to `GET /api/v1/toolsets`
- **THEN** the BFF returns `200` with `{ "data": [...] }` where each item is a `DialToolsetDto` object carrying the ownership/installed flags

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request to `GET /api/v1/toolsets` is sent without a session cookie
- **THEN** the BFF returns `401 Unauthorized`

#### Scenario: Upstream returns 403

- **WHEN** DIAL Core responds with `403`
- **THEN** the BFF returns `403 Forbidden` to the caller

#### Scenario: Upstream is unreachable or times out

- **WHEN** DIAL Core does not respond within the configured timeout
- **THEN** the BFF returns `503 Service Unavailable`

#### Scenario: Cache hit avoids upstream call

- **WHEN** `GET /api/v1/toolsets` is called twice within 30 seconds for the same authenticated user
- **THEN** only one `getToolSets` request is made to DIAL Core; the second response's list is served from cache and only its ownership flags are re-resolved

---

### Requirement: Frontend server-api helper for toolset listing

`apps/chat/src/server-api/toolsets.ts` SHALL export a typed async function `listToolsets` that:

- Calls the generated `@epam/ai-dial-chat-api-client` method `listToolsets()` via `toolsetsApi` from `server-api/api-client.ts`
- Returns `Promise<DialToolsetListResponseDto>`

No direct `fetch` calls are permitted in this helper.

#### Scenario: Helper returns typed list

- **WHEN** `listToolsets()` is called from a component or hook
- **THEN** the return type is `Promise<DialToolsetListResponseDto>` and TypeScript infers `data` as `DialToolsetDto[]`
