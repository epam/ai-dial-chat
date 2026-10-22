# deployment-limits-api Specification

## Purpose

The authenticated deployment-limits endpoint, its path-parameter validation, and the frontend server-api helper.

## Requirements

### Requirement: Authenticated deployment limits endpoint

The BFF SHALL expose `GET /api/v1/deployments/:deployment/limits` that returns spent/limit statistics for a single deployment visible to the authenticated session user.

The endpoint:

- MUST require a valid BFF session cookie (`SessionGuard`); unauthenticated requests SHALL be rejected with `401 Unauthorized`
- MUST proxy to `GET <DIAL_CORE_URL>/v1/deployments/{deploymentName}/limits` forwarding `Authorization: Bearer <session.at>` as the upstream auth header
- MUST call DIAL Core using `@epam/ai-dial-typescript-sdk` method `getDeploymentLimits(encodeDialResourcePath(deploymentName), { headers })` (`DeploymentsDetailsService.getDeploymentLimits`)
- MUST NOT forward the `DIAL_API_KEY` to the client or use it as the upstream credential on this route
- SHALL return `200 OK` with a `DeploymentLimitsResponseDto` body on success
- SHALL return `404 Not Found` when DIAL Core responds with `404` (limits not configured or deployment not found)
- MUST NOT cache the response server-side — every request MUST call DIAL Core (usage data is real-time)
- MUST set `Cache-Control: private, no-store` on the HTTP response
- SHALL map upstream errors via `mapDialHttpStatus` / `handleDialFetchError` (401, 403, 404, 429, 502, 503)
- Controller handler name / OpenAPI operationId: **`getDeploymentLimits`** → generated client method `getDeploymentLimits({ deployment })`
- Works for any deployment type (model, application, toolset) — `deploymentName` is the DIAL deployment identifier

**Example response (200):**

```json
{
  "hourRequestStats": { "total": 10, "used": 5 },
  "dayRequestStats": { "total": 100, "used": 10 },
  "minuteTokenStats": { "total": 1000, "used": 100 },
  "dayTokenStats": { "total": 10000, "used": 4000 },
  "weekTokenStats": { "total": 50000, "used": 20000 },
  "monthTokenStats": { "total": 200000, "used": 80000 },
  "minuteCostStats": { "total": 0.069, "used": 0.001 },
  "dayCostStats": { "total": 100, "used": 10 },
  "weekCostStats": { "total": 500, "used": 100 },
  "monthCostStats": { "total": 20000, "used": 1000 }
}
```

Each stats field is optional on `DeploymentLimitsResponseDto` (`apps/chat-api/src/openapi/openapi-response.dto.ts`) and SHALL be typed as `LimitStatsDto` with `{ total: number; used: number; resetsAt?: string }`, where `resetsAt` is an optional ISO-8601 UTC instant marking the exclusive end of the stat's current calendar period, forwarded verbatim from DIAL Core when present.

#### Scenario: Authenticated user retrieves deployment limits

- **WHEN** a request with a valid session cookie is sent to `GET /api/v1/deployments/gpt-4o/limits`
- **THEN** the BFF returns `200` with a `DeploymentLimitsResponseDto` containing spent/limit stats for each configured period

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request to `GET /api/v1/deployments/gpt-4o/limits` is sent without a session cookie
- **THEN** the BFF returns `401 Unauthorized`

#### Scenario: Limits not found

- **WHEN** DIAL Core responds with `404` for the requested deployment limits
- **THEN** the BFF returns `404 Not Found`

#### Scenario: Upstream returns 403

- **WHEN** DIAL Core responds with `403`
- **THEN** the BFF returns `403 Forbidden` to the caller

#### Scenario: Upstream is unreachable or times out

- **WHEN** DIAL Core does not respond within the configured timeout
- **THEN** the BFF returns `503 Service Unavailable`

#### Scenario: No server-side cache on repeated calls

- **WHEN** `GET /api/v1/deployments/gpt-4o/limits` is called twice within 5 seconds for the same user
- **THEN** two upstream requests are made to DIAL Core (no cache hit)

---

### Requirement: Deployment name path parameter validation

The `:deployment` path parameter MUST support both single-segment static deployment names and slash-separated DIAL resource identifiers such as `applications/{bucket}/{path}` and `toolsets/{bucket}/{path}`. Callers MUST percent-encode the complete identifier when placing it in the single BFF path parameter; decoded `/` characters are structural separators inside the deployment identifier.

The BFF MUST validate the decoded identifier before any upstream call (`GetDeploymentDto`: `@IsString() @MaxLength(2048) @IsSafeDeploymentId()`). It SHALL reject an identifier longer than 2048 characters, an empty path segment, a `.` or `..` path segment (including percent-encoded variants decoded at the route boundary), or an ASCII control character with `400 Bad Request`. Spaces and URL-reserved characters are not globally forbidden because DIAL Core permits them in deployment/resource names when correctly percent-encoded.

After validation, the BFF MUST percent-encode every `/`-separated segment independently (`encodeDialResourcePath`) before passing the identifier to the DIAL SDK, while preserving structural `/` separators. This prevents the SDK's string-interpolated URL from interpreting deployment-name content as a query, fragment, or path traversal.

#### Scenario: Valid deployment identifiers pass validation

- **WHEN** the decoded path param is `gpt-4o`, `applications/bucket/My App`, or `toolsets/public/folder/my-toolset`
- **THEN** the request proceeds to upstream proxying with each segment safely percent-encoded

#### Scenario: Invalid deployment name is rejected

- **WHEN** the decoded path param contains an empty segment, a `.` or `..` segment, an ASCII control character, or exceeds 2048 characters
- **THEN** the BFF returns `400 Bad Request` without calling DIAL Core

---

### Requirement: Frontend server-api helper for deployment limits

`apps/chat/src/server-api/deployment-limits.ts` (or an equivalent export from the deployments wrapper) SHALL export a typed async function `getDeploymentLimits` that:

- Accepts `deploymentName: string`
- Calls the generated `@epam/ai-dial-chat-api-client` method `getDeploymentLimits({ deployment: deploymentName })` via `deploymentsApi`
- Returns `Promise<DeploymentLimitsResponseDto>`

No direct `fetch` calls are permitted in this helper.

#### Scenario: Helper returns typed limits

- **WHEN** `getDeploymentLimits('gpt-4o')` is called
- **THEN** the return type is `Promise<DeploymentLimitsResponseDto>`

---

### Requirement: Authenticated deployment usage endpoint

The BFF SHALL expose `GET /api/v1/deployments/:deployment/usage`, which returns one deployment's own
usage for the authenticated session user. Unlike `GET /api/v1/deployments/:deployment/limits`,
every field is scoped to the queried deployment:

- token and request stats are capped by the deployment's real limit, with the same values as on
  `/limits`;
- `*CostStats.used` is the deployment's own direct cost plus the cost it aggregated from the
  deployments it called;
- `*CostStats.total` is DIAL Core's unlimited sentinel (`9223372036854775807`), since no
  per-deployment cost cap exists.

The endpoint:

- MUST require a valid BFF session cookie (`SessionGuard`); unauthenticated requests SHALL be rejected with `401 Unauthorized`
- MUST proxy to `GET <DIAL_CORE_URL>/v1/deployments/{deploymentName}/usage` (DIAL Core 0.49.0 or later), forwarding `Authorization: Bearer <session.at>` as the upstream auth header
- MUST call DIAL Core using `@epam/ai-dial-typescript-sdk` method `getDeploymentUsage(encodeDialResourcePath(deploymentName), { headers })` (`DeploymentsDetailsService.getDeploymentUsage`)
- MUST validate `:deployment` with `GetDeploymentDto`, under the same rules as `/limits` (requirement "Deployment name path parameter validation")
- MUST NOT forward the `DIAL_API_KEY` to the client or use it as the upstream credential on this route
- SHALL return `200 OK` with a `DeploymentLimitsResponseDto` body on success, including `used: 0` stats for a deployment unused in the period
- SHALL return `404 Not Found` when DIAL Core responds with `404`, which covers an unknown deployment, one not visible to the caller, and a DIAL Core that predates the endpoint
- MUST NOT cache the response server-side, and MUST set `Cache-Control: private, no-store` on the HTTP response
- SHALL map upstream errors via `mapDialHttpStatus` / `handleDialFetchError` (401, 403, 404, 429, 502, 503)
- MUST NOT log the response body. The `TEMP(#9361)` raw-body logging SHALL NOT remain in `DeploymentsDetailsService`
- Controller handler name / OpenAPI operationId: **`getDeploymentUsage`** → generated client method `getDeploymentUsage({ deployment })` on `DeploymentsApi` (normal, not `Raw`), response DTO `DeploymentLimitsResponseDto`, no request body
- Authorization: any authenticated user. DIAL Core decides visibility per deployment, and no role gate or `ENABLED_FEATURES` entry applies

**Example request:** `GET /api/v1/deployments/dial-rag/usage`

**Example response (200):**

```json
{
  "dayTokenStats": { "total": 2000000, "used": 0, "resetsAt": "2026-10-22T00:00:00Z" },
  "weekTokenStats": { "total": 9223372036854775807, "used": 0, "resetsAt": "2026-10-26T00:00:00Z" },
  "dayCostStats": { "total": 9223372036854775807, "used": 0.0419752, "resetsAt": "2026-10-22T00:00:00Z" },
  "weekCostStats": { "total": 9223372036854775807, "used": 0.0419752, "resetsAt": "2026-10-26T00:00:00Z" },
  "monthCostStats": { "total": 9223372036854775807, "used": 0.0419752, "resetsAt": "2026-11-01T00:00:00Z" }
}
```

**Error responses:** `400` invalid identifier, `401` no session, `403` DIAL Core forbids the
deployment, `404` not found or not visible, `429` upstream rate limit, `502` unexpected DIAL Core
response, `503` DIAL Core unreachable or timed out.

#### Scenario: Authenticated user retrieves deployment usage

- **WHEN** a request with a valid session cookie is sent to `GET /api/v1/deployments/dial-rag/usage`
- **THEN** the BFF returns `200` with that deployment's own stats and `Cache-Control: private, no-store`

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request to `GET /api/v1/deployments/gpt-4o/usage` is sent without a session cookie
- **THEN** the BFF returns `401 Unauthorized`

#### Scenario: Deployment not found or Core too old

- **WHEN** DIAL Core responds with `404` for the requested deployment usage
- **THEN** the BFF returns `404 Not Found`

#### Scenario: Invalid identifier is rejected before the upstream call

- **WHEN** the decoded path param is `../etc/passwd`
- **THEN** the BFF returns `400 Bad Request` and `DeploymentsDetailsService.getDeploymentUsage` is not called

#### Scenario: No server-side cache on repeated calls

- **WHEN** `GET /api/v1/deployments/gpt-4o/usage` is called twice within 5 seconds for the same user
- **THEN** two upstream requests are made to DIAL Core

---

### Requirement: Frontend server-api helper for deployment usage

`apps/chat/src/server-api/deployment-limits.ts` SHALL export a typed async function
`getDeploymentUsage` that:

- Accepts `deploymentName: string`
- Calls the generated `@epam/ai-dial-chat-api-client` method `getDeploymentUsage({ deployment: deploymentName })` via `deploymentsApi`
- Returns `Promise<DeploymentLimitsResponseDto>`

No direct `fetch` calls are permitted in this helper. The existing `getDeploymentLimits` helper
SHALL call only `getDeploymentLimits`: the `TEMP(#9361)` probe that also requested the deployment
usage and the user usage SHALL NOT remain.

#### Scenario: Helper returns typed usage

- **WHEN** `getDeploymentUsage('dial-rag')` is called
- **THEN** it calls `deploymentsApi.getDeploymentUsage({ deployment: 'dial-rag' })` and returns `Promise<DeploymentLimitsResponseDto>`

#### Scenario: The limits helper makes one request

- **WHEN** `getDeploymentLimits('gpt-4o')` is called
- **THEN** exactly one request is made, to `deploymentsApi.getDeploymentLimits`
