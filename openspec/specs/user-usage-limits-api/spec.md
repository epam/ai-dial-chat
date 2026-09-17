# user-usage-limits-api Specification

## Purpose

The authenticated aggregate user-limits and user-usage endpoints (rate-limit and calendar-period usage statistics across every deployment visible to the caller), and the frontend server-api wrappers over the generated client methods.

## Requirements

### Requirement: Authenticated aggregate user limits endpoint

The BFF SHALL expose `GET /api/v1/user/limits` that returns rate-limit and calendar-period usage statistics for every deployment (model) visible to the authenticated session user, plus the caller's global cost-budget figures.

The endpoint:

- MUST require a valid BFF session cookie (`SessionGuard`); unauthenticated requests SHALL be rejected with `401 Unauthorized`
- MUST proxy to `GET <DIAL_CORE_URL>/v1/user/limits` forwarding `Authorization: Bearer <session.at>` as the upstream auth header
- MUST call DIAL Core using `@epam/ai-dial-typescript-sdk` method `getUserLimits({ headers })`
- MUST NOT forward the `DIAL_API_KEY` to the client or use it as the upstream credential on this route
- SHALL return `200 OK` with a `UserLimitStatsResponseDto` body on success
- MUST NOT cache the response server-side — every request MUST call DIAL Core (usage data is real-time)
- MUST set `Cache-Control: private, no-store` on the HTTP response
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
      "dayTokenStats": { "total": 10000, "used": 4000, "resetsAt": "2026-09-16T00:00:00Z" },
      "weekTokenStats": { "total": 50000, "used": 20000, "resetsAt": "2026-09-21T00:00:00Z" },
      "monthTokenStats": { "total": 200000, "used": 80000, "resetsAt": "2026-10-01T00:00:00Z" },
      "dayCostStats": { "total": 9223372036854775807, "used": 0, "resetsAt": "2026-09-16T00:00:00Z" },
      "weekCostStats": { "total": 9223372036854775807, "used": 0, "resetsAt": "2026-09-21T00:00:00Z" },
      "monthCostStats": { "total": 9223372036854775807, "used": 0, "resetsAt": "2026-10-01T00:00:00Z" }
    }
  },
  "minuteCostStats": { "total": 0.069, "used": 0.001 },
  "dayCostStats": { "total": 100, "used": 10, "resetsAt": "2026-09-16T00:00:00Z" },
  "weekCostStats": { "total": 500, "used": 100, "resetsAt": "2026-09-21T00:00:00Z" },
  "monthCostStats": { "total": 20000, "used": 1000, "resetsAt": "2026-10-01T00:00:00Z" }
}
```

Each stats field SHALL be typed as `LimitStatsDto` with `{ total: number; used: number; resetsAt?: string }`. A `total` at or above `2^53` (`9007199254740992`) represents "unlimited" (the upstream sentinel `Long.MAX_VALUE` exceeds `Number.MAX_SAFE_INTEGER`) and MUST be documented as such in the DTO's `@ApiProperty` description; the BFF SHALL pass the value through unmodified and MUST NOT reinterpret, clamp, or drop it.

`resetsAt` is an optional ISO-8601 UTC instant marking the exclusive end of that stat's current accumulation period. Its presence establishes that the `day`/`week`/`month` stats are **calendar periods anchored to UTC boundaries**, not trailing windows. The BFF SHALL forward it verbatim and MUST NOT parse, reformat, convert, or synthesize it — see the `usage-period-reset-times` capability for the full contract.

The top-level `*CostStats` fields represent the caller's global cost budget and spend against it, and are NOT a sum of the per-deployment `*CostStats` fields — per-deployment cost is separately attributed spend. In every payload observed to date its `total` is the unlimited sentinel, because DIAL Core's role model configures cost limits only at the role level (`Role.costLimit`) and per-deployment `Role.limits` entries carry token and request windows with no cost field; consumers SHALL nonetheless detect the sentinel rather than assume it.

**Known contract divergence:** `@epam/ai-dial-typescript-sdk@0.1.1` types `CostItemLimitStats` and `ItemLimitStats` as `{ total?: number; used?: number }` with no `resetsAt`. `deployments-details.service.ts` already casts the SDK payload (`result.data as unknown as UserLimitStatsResponseDto`), so the field reaches the client at runtime. The hand-authored DTO is authoritative for the BFF's published contract until the SDK types the field.

#### Scenario: Authenticated user retrieves aggregate limits

- **WHEN** a request with a valid session cookie is sent to `GET /api/v1/user/limits`
- **THEN** the BFF returns `200` with a `UserLimitStatsResponseDto` containing a `deployments` map covering every model visible to the caller and top-level global cost stats

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request to `GET /api/v1/user/limits` is sent without a session cookie
- **THEN** the BFF returns `401 Unauthorized`

#### Scenario: Unused deployment still reported

- **WHEN** the caller has never sent a request to a deployment they can access
- **THEN** that deployment SHALL still appear in the `deployments` map of the `200` response, with zero `used` values against its real configured limits

#### Scenario: Reset timestamps survive the proxy unchanged

- **WHEN** DIAL Core returns stats carrying `resetsAt` values
- **THEN** the BFF's `200` body contains those exact strings, with no reformatting, timezone conversion, or omission

#### Scenario: Upstream error is mapped

- **WHEN** DIAL Core responds with `500`, `502`, or times out
- **THEN** the BFF returns the mapped status via `mapDialHttpStatus` / `handleDialFetchError`, matching the existing `deployment-limits-api` error-mapping behavior

### Requirement: Authenticated user usage endpoint

The BFF SHALL expose `GET /api/v1/user/usage` that returns the same `UserLimitStatsResponseDto` shape as `GET /api/v1/user/limits`, restricted to deployments the caller actually used within the current reported periods.

The endpoint:

- MUST require a valid BFF session cookie (`SessionGuard`); unauthenticated requests SHALL be rejected with `401 Unauthorized`
- MUST proxy to `GET <DIAL_CORE_URL>/v1/user/usage` forwarding `Authorization: Bearer <session.at>` as the upstream auth header
- MUST call DIAL Core using `@epam/ai-dial-typescript-sdk` method `getUserUsage({ headers })`
- MUST NOT forward the `DIAL_API_KEY` to the client or use it as the upstream credential on this route
- SHALL return `200 OK` with a `UserLimitStatsResponseDto` body on success, using the identical field names and semantics as `GET /api/v1/user/limits`, including the optional `resetsAt` on each day/week/month stat
- MUST NOT cache the response server-side — every request MUST call DIAL Core
- MUST set `Cache-Control: private, no-store` on the HTTP response
- SHALL map upstream errors via `mapDialHttpStatus` / `handleDialFetchError` (401, 500, 502, 503)
- Controller handler name / OpenAPI operationId: **`getUserUsage`** → generated client method `getUserUsage()`
- A deployment absent from the `deployments` map means zero usage in the reported periods, not "unknown"

The endpoint's `@ApiOperation` description SHALL describe the restriction in calendar-period terms and SHALL NOT state "trailing 30 days".

#### Scenario: Authenticated user retrieves usage-only limits

- **WHEN** a request with a valid session cookie is sent to `GET /api/v1/user/usage`
- **THEN** the BFF returns `200` with a `UserLimitStatsResponseDto` whose `deployments` map contains only deployments the caller has used in the reported periods

#### Scenario: Unauthenticated request is rejected

- **WHEN** a request to `GET /api/v1/user/usage` is sent without a session cookie
- **THEN** the BFF returns `401 Unauthorized`

#### Scenario: Never-used deployment is absent

- **WHEN** the caller has access to a deployment but has never sent it a request
- **THEN** that deployment SHALL NOT appear in the `deployments` map of the `200` response

#### Scenario: Stats without a reset timestamp are still valid

- **WHEN** DIAL Core returns a day/week/month stat carrying only `total` and `used`
- **THEN** the BFF returns `200` and omits `resetsAt` for that stat rather than synthesizing one

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
