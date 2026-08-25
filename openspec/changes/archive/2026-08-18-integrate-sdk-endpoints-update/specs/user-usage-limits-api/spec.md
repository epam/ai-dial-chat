## ADDED Requirements

### Requirement: Authenticated aggregate user limits endpoint

The BFF SHALL expose `GET /api/v1/user/limits` that returns rate-limit and rolling-usage statistics for every deployment (model) visible to the authenticated session user, plus the caller's global cost-budget figures.

The endpoint:

- MUST require a valid BFF session cookie (`SessionGuard`); unauthenticated requests SHALL be rejected with `401 Unauthorized`
- MUST proxy to `GET <DIAL_CORE_URL>/v1/user/limits` forwarding `Authorization: Bearer <session.at>` as the upstream auth header
- MUST call DIAL Core using `@epam/ai-dial-typescript-sdk` method `getUserLimits({ headers })`
- MUST NOT forward the `DIAL_API_KEY` to the client or use it as the upstream credential on this route
- SHALL return `200 OK` with a `UserLimitStatsResponseDto` body on success
- MUST NOT cache the response server-side — every request MUST call DIAL Core (usage data is real-time)
- MUST set `Cache-Control: private, no-store` on the HTTP response
- SHALL apply per-route rate limiting of **60 req/min per IP** via `@Throttle({ default: { limit: 60, ttl: 60000 } })`
- SHALL map upstream errors via `mapDialHttpStatus` / `handleDialFetchError` (401, 500, 502, 503)
- Controller handler name / OpenAPI operationId: **`getUserLimits`** → generated client method `getUserLimits()`
- Lists model deployments only — applications, toolsets, and routes are never present in `deployments`, matching the upstream DIAL Core contract
- A deployment the caller has never used MUST still appear in `deployments`, with its real limits reported against zero usage

**Example response (200):**

```json
{
  "deployments": {
    "gpt-4o": {
      "hourRequestStats": { "total": 10, "used": 5 },
      "dayRequestStats": { "total": 100, "used": 10 },
      "minuteTokenStats": { "total": 1000, "used": 100 },
      "dayTokenStats": { "total": 10000, "used": 4000 },
      "weekTokenStats": { "total": 50000, "used": 20000 },
      "monthTokenStats": { "total": 200000, "used": 80000 },
      "dayCostStats": { "total": 9223372036854775807, "used": 0 },
      "weekCostStats": { "total": 9223372036854775807, "used": 0 },
      "monthCostStats": { "total": 9223372036854775807, "used": 0 }
    }
  },
  "minuteCostStats": { "total": 0.069, "used": 0.001 },
  "dayCostStats": { "total": 100, "used": 10 },
  "weekCostStats": { "total": 500, "used": 100 },
  "monthCostStats": { "total": 20000, "used": 1000 }
}
```

Each stats field SHALL be typed as `LimitStatsDto` with `{ total: number; used: number }`. A `total` at or above `2^53` (`9007199254740992`) represents "unlimited" (the upstream sentinel `Long.MAX_VALUE` exceeds `Number.MAX_SAFE_INTEGER`) and MUST be documented as such in the DTO's `@ApiProperty` description; the BFF SHALL pass the value through unmodified and MUST NOT reinterpret, clamp, or drop it.

The top-level `*CostStats` fields represent the caller's global cost budget and spend against it, and are NOT a sum of the per-deployment `*CostStats` fields — per-deployment cost is separately attributed spend against no per-deployment cap (its `total` is always the unlimited sentinel).

#### Scenario: Authenticated user retrieves aggregate limits

- **WHEN** a request with a valid session cookie is sent to `GET /api/v1/user/limits`
- **THEN** the BFF returns `200` with a `UserLimitStatsResponseDto` containing a `deployments` map covering every model visible to the caller and top-level global cost stats

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request to `GET /api/v1/user/limits` is sent without a session cookie
- **THEN** the BFF returns `401 Unauthorized`

#### Scenario: Unused deployment still reported

- **WHEN** the caller has never sent a request to a deployment they can access
- **THEN** that deployment SHALL still appear in the `deployments` map of the `200` response, with zero `used` values against its real configured limits

#### Scenario: Upstream error is mapped

- **WHEN** DIAL Core responds with `500`, `502`, or times out
- **THEN** the BFF returns the mapped status via `mapDialHttpStatus` / `handleDialFetchError`, matching the existing `deployment-limits-api` error-mapping behavior

### Requirement: Authenticated user usage endpoint

The BFF SHALL expose `GET /api/v1/user/usage` that returns the same `UserLimitStatsResponseDto` shape as `GET /api/v1/user/limits`, restricted to deployments the caller actually used within the trailing 30 days.

The endpoint:

- MUST require a valid BFF session cookie (`SessionGuard`); unauthenticated requests SHALL be rejected with `401 Unauthorized`
- MUST proxy to `GET <DIAL_CORE_URL>/v1/user/usage` forwarding `Authorization: Bearer <session.at>` as the upstream auth header
- MUST call DIAL Core using `@epam/ai-dial-typescript-sdk` method `getUserUsage({ headers })`
- MUST NOT forward the `DIAL_API_KEY` to the client or use it as the upstream credential on this route
- SHALL return `200 OK` with a `UserLimitStatsResponseDto` body on success, using the identical field names and semantics as `GET /api/v1/user/limits`
- MUST NOT cache the response server-side — every request MUST call DIAL Core
- MUST set `Cache-Control: private, no-store` on the HTTP response
- SHALL apply per-route rate limiting of **60 req/min per IP** via `@Throttle({ default: { limit: 60, ttl: 60000 } })`
- SHALL map upstream errors via `mapDialHttpStatus` / `handleDialFetchError` (401, 500, 502, 503)
- Controller handler name / OpenAPI operationId: **`getUserUsage`** → generated client method `getUserUsage()`
- A deployment absent from the `deployments` map means zero usage in the trailing 30 days, not "unknown"

#### Scenario: Authenticated user retrieves usage-only limits

- **WHEN** a request with a valid session cookie is sent to `GET /api/v1/user/usage`
- **THEN** the BFF returns `200` with a `UserLimitStatsResponseDto` whose `deployments` map contains only deployments used in the trailing 30 days

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request to `GET /api/v1/user/usage` is sent without a session cookie
- **THEN** the BFF returns `401 Unauthorized`

#### Scenario: Never-used deployment is absent

- **WHEN** the caller has access to a deployment but has never sent it a request
- **THEN** that deployment SHALL NOT appear in the `deployments` map of the `200` response

### Requirement: Frontend server-api access to user limits and usage

`apps/chat/src/server-api/` SHALL expose thin wrapper functions `getUserLimits()` and `getUserUsage()` over the regenerated `@epam/chat-api-client` generated methods for the two endpoints above, following the existing `deployment-limits.ts` pattern (a one-line function returning the generated client's typed promise, no business logic in the wrapper).

- MUST use the generated client (`@epam/chat-api-client`) exclusively — no raw `fetch` calls in `base.ts` or elsewhere for these endpoints
- The wrapper functions MAY be unused by any UI component in this change; they exist so a future feature can consume the new endpoints without a new access pattern

#### Scenario: Wrapper delegates to generated client

- **WHEN** `getUserLimits()` is called from `apps/chat/src/server-api/`
- **THEN** it SHALL invoke the generated client's `getUserLimits` operation and return its typed response with no additional transformation

#### Scenario: Existing single-deployment usage display is unaffected

- **WHEN** `UsageLimitsControl` renders the currently selected deployment's usage via `useDeploymentUsageLimits`
- **THEN** it SHALL continue to call the existing `getDeploymentLimits` wrapper and `GET /api/v1/deployments/:deployment/limits` endpoint, unchanged by this capability
