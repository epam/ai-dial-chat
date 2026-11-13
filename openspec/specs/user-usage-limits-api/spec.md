# user-usage-limits-api Specification

## Purpose

The authenticated aggregate user-limits and user-usage endpoints (rate-limit and calendar-period usage statistics across every deployment visible to the caller), and the frontend server-api wrappers over the generated client methods.

## Requirements

### Requirement: Authenticated aggregate user limits endpoint

The BFF SHALL expose `GET /api/v1/user/limits` that returns rate-limit and calendar-period usage statistics for every deployment of the requested kinds visible to the authenticated session user, plus the caller's global cost-budget figures.

The endpoint:

- MUST require a valid BFF session cookie (`SessionGuard`); unauthenticated requests SHALL be rejected with `401 Unauthorized`
- MUST proxy to `GET <DIAL_CORE_URL>/v1/user/limits` forwarding `Authorization: Bearer <session.at>` as the upstream auth header
- MUST call DIAL Core using `@epam/ai-dial-typescript-sdk` method `getUserLimits({ headers, params })`, where `params.query.deploymentTypes` follows the "Deployment kinds query parameter" requirement
- MUST NOT forward the `DIAL_API_KEY` to the client or use it as the upstream credential on this route
- SHALL return `200 OK` with a `UserLimitStatsResponseDto` body on success
- MUST NOT cache the response server-side — every request MUST call DIAL Core (usage data is real-time)
- MUST set `Cache-Control: private, no-store` on the HTTP response
- SHALL map upstream errors via `mapDialHttpStatus` / `handleDialFetchError` (401, 500, 502, 503)
- Controller handler name / OpenAPI operationId: **`getUserLimits`** → generated client method `getUserLimits({ deploymentTypes? })`
- Without a `deploymentTypes` query parameter, reports the kinds configured in `USER_USAGE_DEPLOYMENT_TYPES` (default: models and applications). When the effective kinds include `application`, `deployments` MAY also contain config-defined and custom Applications keyed by their DIAL Core name (a custom application's key has the form `applications/<bucket>/<name>`). Toolsets, routes, and interceptors are never present
- A deployment the caller has never used MUST still appear in `deployments`, with its real limits reported against zero usage

The `@ApiOperation` description SHALL state that `deployments` covers the deployment kinds in `deploymentTypes`, or the server-configured default kinds when omitted, and SHALL NOT say "every model deployment" unqualified. The `@ApiPropertyOptional` description of `UserLimitStatsResponseDto.deployments` SHALL say the same — the map contains only the kinds selected by `deploymentTypes`, or the server-configured default kinds (`USER_USAGE_DEPLOYMENT_TYPES`, models and applications by default) when omitted, and toolsets and routes never appear — and SHALL NOT describe the map as "models only".

**Example response (200)** for `GET /api/v1/user/limits?deploymentTypes=model,application`:

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
      "dayCostStats": { "total": 9223372036854775807, "used": 1.2, "resetsAt": "2026-09-16T00:00:00Z" },
      "weekCostStats": { "total": 9223372036854775807, "used": 1.2, "resetsAt": "2026-09-21T00:00:00Z" },
      "monthCostStats": { "total": 9223372036854775807, "used": 1.2, "resetsAt": "2026-10-01T00:00:00Z" }
    },
    "llm-router": {
      "dayTokenStats": { "total": 10000000, "used": 0, "resetsAt": "2026-09-16T00:00:00Z" },
      "dayCostStats": { "total": 9223372036854775807, "used": 1.2, "resetsAt": "2026-09-16T00:00:00Z" },
      "weekCostStats": { "total": 9223372036854775807, "used": 1.2, "resetsAt": "2026-09-21T00:00:00Z" },
      "monthCostStats": { "total": 9223372036854775807, "used": 1.2, "resetsAt": "2026-10-01T00:00:00Z" }
    }
  },
  "minuteCostStats": { "total": 0.069, "used": 0.001 },
  "dayCostStats": { "total": 100, "used": 1.2, "resetsAt": "2026-09-16T00:00:00Z" },
  "weekCostStats": { "total": 500, "used": 100, "resetsAt": "2026-09-21T00:00:00Z" },
  "monthCostStats": { "total": 20000, "used": 1000, "resetsAt": "2026-10-01T00:00:00Z" }
}
```

(Here `llm-router` called `gpt-4o` once; its cost equals the model's and the two are not additive.)

Each stats field SHALL be typed as `LimitStatsDto` with `{ total: number; used: number; resetsAt?: string }`. A `total` at or above `2^53` (`9007199254740992`) represents "unlimited" (the upstream sentinel `Long.MAX_VALUE` exceeds `Number.MAX_SAFE_INTEGER`) and MUST be documented as such in `UserLimitStatsResponseDto`'s `@ApiProperty` descriptions (stated on `minuteCostStats`, which `dayCostStats`/`weekCostStats`/`monthCostStats` reference; `LimitStatsDto.total` itself carries only an example); the BFF SHALL pass the value through unmodified and MUST NOT reinterpret, clamp, or drop it.

`resetsAt` is an optional ISO-8601 UTC instant marking the exclusive end of that stat's current accumulation period. Its presence establishes that the `day`/`week`/`month` stats are **calendar periods anchored to UTC boundaries**, not trailing windows. The BFF SHALL forward it verbatim and MUST NOT parse, reformat, convert, or synthesize it — see the `usage-period-reset-times` capability for the full contract.

The top-level `*CostStats` fields represent the caller's global cost budget and spend against it, and are NOT a sum of the per-deployment `*CostStats` fields — per-deployment cost is separately attributed spend. Since DIAL Core #2032, a per-deployment `used` is that deployment's direct cost plus the cost it aggregated from descendants it called in a chain, so per-deployment cost figures overlap and MUST NOT be summed. In every payload observed to date the per-deployment `total` is the unlimited sentinel, because DIAL Core's role model configures cost limits only at the role level (`Role.costLimit`) and per-deployment `Role.limits` entries carry token and request windows with no cost field; consumers SHALL nonetheless detect the sentinel rather than assume it. For an Application entry, DIAL Core writes no token or request counters, so its token `used` is `0` against the role's token budget and carries no information.

**Known contract divergence:** the SDK types `CostItemLimitStats` and `ItemLimitStats` as `{ total?: number; used?: number }` with no `resetsAt`. `deployments-details.service.ts` already casts the SDK payload (`result.data as unknown as UserLimitStatsResponseDto`), so the field reaches the client at runtime. The hand-authored DTO is authoritative for the BFF's published contract until the SDK types the field.

#### Scenario: Authenticated user retrieves aggregate limits

- **WHEN** a request with a valid session cookie is sent to `GET /api/v1/user/limits`
- **THEN** the BFF returns `200` with a `UserLimitStatsResponseDto` containing a `deployments` map covering every model visible to the caller and top-level global cost stats

#### Scenario: Applications are included on request

- **WHEN** a request is sent to `GET /api/v1/user/limits?deploymentTypes=model,application`
- **THEN** the BFF calls DIAL Core with `deploymentTypes=model,application` and returns whatever application entries DIAL Core reports alongside the models

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
- MUST call DIAL Core using `@epam/ai-dial-typescript-sdk` method `getUserUsage({ headers, params })`, where `params.query.deploymentTypes` follows the "Deployment kinds query parameter" requirement
- MUST NOT forward the `DIAL_API_KEY` to the client or use it as the upstream credential on this route
- SHALL return `200 OK` with a `UserLimitStatsResponseDto` body on success, using the identical field names and semantics as `GET /api/v1/user/limits`, including the optional `resetsAt` on each day/week/month stat
- MUST NOT cache the response server-side — every request MUST call DIAL Core
- MUST set `Cache-Control: private, no-store` on the HTTP response
- SHALL map upstream errors via `mapDialHttpStatus` / `handleDialFetchError` (401, 500, 502, 503)
- Controller handler name / OpenAPI operationId: **`getUserUsage`** → generated client method `getUserUsage({ deploymentTypes? })`
- A deployment absent from the `deployments` map means zero usage in the reported periods, not "unknown"

The endpoint's `@ApiOperation` description SHALL describe the restriction in calendar-period terms, SHALL NOT state "trailing 30 days", and SHALL state that the deployment kinds reported follow `deploymentTypes`, or the server-configured default kinds when omitted.

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

`apps/chat/src/server-api/user-limits.ts` SHALL expose a thin wrapper `getUserUsage()` over the regenerated `@epam/ai-dial-chat-api-client` `getUserUsage` operation, following the existing `deployment-limits.ts` pattern (a one-line function returning the generated client's typed promise, no business logic in the wrapper).

- The wrapper SHALL take no arguments and SHALL call the generated method **without** `deploymentTypes`, so the deployment kinds Usage page reports are decided by the BFF's `USER_USAGE_DEPLOYMENT_TYPES` (see "Server-configured default deployment kinds"), not hardcoded in the frontend. The wrapper is therefore unchanged by this change
- The wrapper SHALL be a module-level constant, so its identity is stable across renders — `useUsageData(getUserUsage, ...)` lists it in an effect dependency array, and an inline or per-render function would refetch on every render
- MUST use the generated client exclusively — no raw `fetch` calls in `base.ts` or elsewhere for these endpoints

**Code/spec divergence (recorded, not resolved here):** the previous version of this requirement also mandated a `getUserLimits()` wrapper. It was never implemented — `user-limits.ts` exports only `getUserUsage` — and no UI consumes `GET /api/v1/user/limits`. This change does not add it.

#### Scenario: Wrapper leaves the kinds to the server

- **WHEN** `getUserUsage()` is called from `apps/chat/src/server-api/`
- **THEN** it SHALL invoke the generated client's `getUserUsage` operation with no `deploymentTypes` and return its typed response with no additional transformation

#### Scenario: Wrapper identity is stable

- **WHEN** `UsageTab` re-renders
- **THEN** the `getUserUsage` reference passed to `useUsageData` is the same function object, and no additional request is made

#### Scenario: Existing single-deployment usage display is unaffected

- **WHEN** `UsageLimitsControl` renders the currently selected deployment's usage via `useDeploymentUsageLimits`
- **THEN** it SHALL continue to call the existing `getDeploymentLimits` wrapper and `GET /api/v1/deployments/:deployment/limits` endpoint, unchanged by this capability

### Requirement: Deployment kinds query parameter

`GET /api/v1/user/limits` and `GET /api/v1/user/usage` SHALL accept an optional query parameter `deploymentTypes`, validated by a shared `UserStatsQueryDto` bound with `@Query()`:

- Values SHALL be members of a new string enum `DeploymentType { Model = 'model', Application = 'application' }` declared in `apps/chat-api/src/deployments/dto/`
- The DTO SHALL accept both the comma-separated form (`?deploymentTypes=model,application`) and the repeated-key form (`?deploymentTypes=model&deploymentTypes=application`) — the generated `chat-api-client` emits the latter — normalizing either to `DeploymentType[]` with `@Transform`, trimming entries, and dropping empty ones
- Validation SHALL use `@IsOptional()`, `@IsArray()`, `@IsEnum(DeploymentType, { each: true })`, and `@ApiPropertyOptional({ enum: DeploymentType, isArray: true })`; any other value (e.g. `route`, `toolset`, `MODEL`) SHALL be rejected with `400 Bad Request` by the global `ValidationPipe`, before DIAL Core is called
- Duplicates SHALL be removed; order SHALL be preserved

Forwarding to DIAL Core:

- When `deploymentTypes` is absent or normalizes to an empty list, the BFF SHALL use the server-configured default kinds (`USER_USAGE_DEPLOYMENT_TYPES`, see the next requirement). A request-supplied value always takes precedence over the configured default
- When present, the BFF SHALL send it as **a single comma-joined value** (`deploymentTypes=model,application`), never as repeated keys. DIAL Core reads the parameter with a single-value `getParam(...).split(",")`, so a repeated-key request silently reports only the first kind. Because the SDK types the parameter as `('model' | 'application')[]` and openapi-fetch serializes arrays as repeated keys, the call site SHALL pass the pre-joined string through one documented cast, co-located with a comment naming the upstream parsing behaviour
- The `deploymentTypes` value SHALL NOT be written to logs beyond the existing debug lines, and SHALL NOT affect caching (there is none)

Generated-client impact: operationIds stay `getUserLimits` / `getUserUsage`; the generated methods gain an optional `deploymentTypes?: Array<GetUserLimitsDeploymentTypesEnum>` / `Array<GetUserUsageDeploymentTypesEnum>` request parameter (per-operation inline enums, the generator's existing convention); response DTO unchanged (`UserLimitStatsResponseDto`); frontend callers use the normal (non-`Raw`) methods. Authorization is unchanged: any authenticated session user, no role requirement. The parameter is not gated behind `ENABLED_FEATURES`.

**Example requests:**

```
GET /api/v1/user/usage                                          → Core: GET /v1/user/usage?deploymentTypes=model,application   (env unset → default)
GET /api/v1/user/usage?deploymentTypes=model,application        → Core: GET /v1/user/usage?deploymentTypes=model,application
GET /api/v1/user/usage?deploymentTypes=application&deploymentTypes=model
                                                                → Core: GET /v1/user/usage?deploymentTypes=application,model
GET /api/v1/user/usage?deploymentTypes=route                    → 400 Bad Request (Core not called)
```

**Example 400 body:**

```json
{
  "statusCode": 400,
  "message": ["each value in deploymentTypes must be one of the following values: model, application"],
  "error": "Bad Request"
}
```

#### Scenario: Comma-separated input is forwarded as one value

- **WHEN** a client sends `GET /api/v1/user/usage?deploymentTypes=model,application`
- **THEN** the outgoing DIAL Core URL's query contains exactly one `deploymentTypes` key whose value is `model,application`

#### Scenario: Repeated-key input is forwarded as one value

- **WHEN** a client sends `GET /api/v1/user/limits?deploymentTypes=model&deploymentTypes=application`
- **THEN** the outgoing DIAL Core URL's query contains exactly one `deploymentTypes` key whose value is `model,application`

#### Scenario: Omitted parameter uses the configured default

- **WHEN** `USER_USAGE_DEPLOYMENT_TYPES` is unset and a client sends `GET /api/v1/user/usage` with no query string
- **THEN** the outgoing DIAL Core URL's query contains exactly one `deploymentTypes` key whose value is `model,application`

#### Scenario: Request value overrides the configured default

- **WHEN** `USER_USAGE_DEPLOYMENT_TYPES=model,application` and a client sends `?deploymentTypes=model`
- **THEN** DIAL Core receives `deploymentTypes=model`

#### Scenario: Unknown kind is rejected

- **WHEN** a client sends `GET /api/v1/user/usage?deploymentTypes=route`
- **THEN** the BFF returns `400 Bad Request` and does not call DIAL Core

#### Scenario: Duplicates collapse

- **WHEN** a client sends `?deploymentTypes=model,model,application`
- **THEN** DIAL Core receives `deploymentTypes=model,application`

### Requirement: Server-configured default deployment kinds

The BFF SHALL read an optional environment variable `USER_USAGE_DEPLOYMENT_TYPES`, declared on `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts` and validated at boot, that sets which deployment kinds `GET /api/v1/user/limits` and `GET /api/v1/user/usage` report when the request carries no `deploymentTypes`.

- Format: comma-separated `DeploymentType` values, e.g. `model,application` or `model`; entries are trimmed, empty entries dropped, duplicates removed in order — the same normalization as the query DTO
- Default: when unset or empty, the value SHALL be `[DeploymentType.Model, DeploymentType.Application]`, following the `ADMIN_ROLE_NAMES` default-in-class pattern
- Validation: `@IsEnum(DeploymentType, { each: true })`; an unknown value (e.g. `route`) SHALL fail application start-up with the standard environment-validation error, never be ignored or forwarded
- Access: `DeploymentsDetailsService` (or the controller) SHALL read it through `ConfigService.get('USER_USAGE_DEPLOYMENT_TYPES', { infer: true })`, never `process.env`
- Operators restore DIAL Core's pre-#2032 model-only report with `USER_USAGE_DEPLOYMENT_TYPES=model`
- The variable SHALL be documented in `apps/chat-api/README.md` (environment table) and `apps/chat-api/.env.template` (commented example) in the same change
- The variable is server-only: it is not exposed through app-config or any endpoint, and the frontend does not read it

#### Scenario: Unset variable defaults to models and applications

- **WHEN** `USER_USAGE_DEPLOYMENT_TYPES` is not set
- **THEN** a request without `deploymentTypes` reaches DIAL Core with `deploymentTypes=model,application`

#### Scenario: Operator narrows the default to models

- **WHEN** `USER_USAGE_DEPLOYMENT_TYPES=model`
- **THEN** a request without `deploymentTypes` reaches DIAL Core with `deploymentTypes=model`, and Usage page shows model rows only

#### Scenario: Invalid value fails fast

- **WHEN** `USER_USAGE_DEPLOYMENT_TYPES=model,route`
- **THEN** the BFF fails environment validation at start-up

#### Scenario: Both endpoints share the default

- **WHEN** `USER_USAGE_DEPLOYMENT_TYPES=application` and requests without `deploymentTypes` are sent to `/api/v1/user/limits` and `/api/v1/user/usage`
- **THEN** both reach DIAL Core with `deploymentTypes=application`

### Requirement: Budget stats in the user limits and usage response

`UserLimitStatsResponseDto` in `apps/chat-api/src/openapi/openapi-response.dto.ts` SHALL declare an
optional property `budgets?: BudgetStatsDto[]`. It is returned by both `GET /api/v1/user/limits`
(operationId `getUserLimits`) and `GET /api/v1/user/usage` (operationId `getUserUsage`). It
describes DIAL Core's `budgets[]` (DIAL Core `BudgetStats`, epam/ai-dial-core#2188): each entry is
the caller's spend against one budget that applies to them.

`BudgetStatsDto` SHALL be a response class in the same file, with Swagger metadata on every field:

| Field        | Type            | Required | Meaning                                                                              |
| ------------ | --------------- | -------- | ------------------------------------------------------------------------------------ |
| `costObject` | `string`        | yes      | The cost object the budget is assigned in; several entries MAY share one value      |
| `policy`     | `string`        | yes      | The path of the budget's policy                                                      |
| `priority`   | `integer`       | no       | The policy's priority, lower first; absent when the policy sets none                |
| `displayName` | `string`       | no       | The policy's human-readable name; absent when the policy sets none. Not an identifier — `policy` is |
| `day`        | `LimitStatsDto` | yes      | Spend against the budget in the current UTC day (`total`, `used`, optional `resetsAt`)   |
| `month`      | `LimitStatsDto` | yes      | Spend against the budget in the current UTC month (`total`, `used`, optional `resetsAt`) |

`day` and `month` SHALL reuse the existing `LimitStatsDto` rather than a new window class, because
DIAL Core serializes both with the same `CostItemLimitStats` class it uses for the top-level cost
stats. `resetsAt` on a budget window follows the `usage-period-reset-times` contract: the BFF
forwards it verbatim.

The `@ApiPropertyOptional` description of `budgets` SHALL state that:

- entries keep DIAL Core's order, and a cost object can have more than one entry;
- the budgets are separate from the top-level `minuteCostStats`/`dayCostStats`/`weekCostStats`/
  `monthCostStats` and are not merged into them;
- an absent `budgets` means DIAL Core did not report the field (an older DIAL Core), while `[]`
  means DIAL Core reported no applicable budget: spending limits are off, no budget matches the
  caller, or the caller is an API key;
- a window `total` at or above `9007199254740992` (2^53) is DIAL Core's unlimited sentinel
  (`Long.MAX_VALUE`, which exceeds `Number.MAX_SAFE_INTEGER`). It SHALL be treated as unlimited,
  not rendered as a used/total ratio.

The BFF SHALL pass `budgets` through unmodified. `DeploymentsDetailsService.getUserLimits` and
`DeploymentsDetailsService.getUserUsage` in
`apps/chat-api/src/deployments/details/deployments-details.service.ts` SHALL keep returning the
DIAL Core body as-is. The BFF MUST NOT:

- add, drop, reorder, de-duplicate or merge entries;
- default an absent `budgets` to `[]`, or remove an empty `budgets`;
- round fractional `used` values, or clamp or reinterpret the sentinel `total`;
- parse or reformat `resetsAt`;
- fold budget figures into the top-level `*CostStats`.

Authentication, caching and error mapping are unchanged from the "Authenticated aggregate user
limits endpoint" and "Authenticated user usage endpoint" requirements. Both routes still need a
valid session cookie (`SessionGuard`), call DIAL Core with `Authorization: Bearer <session.at>`,
never use `DIAL_API_KEY`, set `Cache-Control: private, no-store`, cache nothing server-side, and
map upstream errors through `mapDialHttpStatus` / `handleDialFetchError`. No role or
`ENABLED_FEATURES` gate applies, and there are no new user-visible strings or UI.

**Example response fragment (200)** for `GET /api/v1/user/limits`:

```json
{
  "deployments": { "gpt-4o": { "dayTokenStats": { "total": 10000, "used": 4000, "resetsAt": "2026-11-14T00:00:00Z" } } },
  "dayCostStats": { "total": 100, "used": 14.2, "resetsAt": "2026-11-14T00:00:00Z" },
  "budgets": [
    {
      "costObject": "example-project",
      "policy": "org-wide",
      "priority": 1,
      "displayName": "Organization-wide",
      "day": { "total": 50, "used": 14.2, "resetsAt": "2026-11-14T00:00:00Z" },
      "month": { "total": 2000, "used": 171.4, "resetsAt": "2026-12-01T00:00:00Z" }
    },
    {
      "costObject": "example-project",
      "policy": "team",
      "day": { "total": 9223372036854775807, "used": 14.2, "resetsAt": "2026-11-14T00:00:00Z" },
      "month": { "total": 200, "used": 171.4, "resetsAt": "2026-12-01T00:00:00Z" }
    }
  ]
}
```

#### Scenario: Multiple budgets survive the proxy in order

- **WHEN** DIAL Core returns `budgets` with two entries for the same `costObject`, followed by an entry for another cost object
- **THEN** both `GET /api/v1/user/limits` and `GET /api/v1/user/usage` return `200` with a `budgets` array deep-equal to DIAL Core's, in the same order and with no entry merged or dropped

#### Scenario: Optional priority stays absent

- **WHEN** a DIAL Core budget entry has no `priority`
- **THEN** the corresponding entry in the BFF response has no `priority` key, rather than `null` or a default value

#### Scenario: Optional display name is forwarded or stays absent

- **WHEN** one DIAL Core budget entry has `displayName: "Organization-wide"` and another has no `displayName`
- **THEN** the first BFF entry carries the same `displayName` string, and the second has no `displayName` key, rather than `null`, an empty string, or the `policy` value

#### Scenario: Fractional spend, reset times and the sentinel are forwarded verbatim

- **WHEN** a budget's `day.used` is `14.2`, its `day.total` is `9223372036854775807`, and its `month.resetsAt` is `2026-12-01T00:00:00Z`
- **THEN** the BFF response carries the same numeric values and the same `resetsAt` string, with no rounding, clamping or reformatting

#### Scenario: Empty budgets stay empty

- **WHEN** DIAL Core returns `"budgets": []`
- **THEN** the BFF response contains `"budgets": []`

#### Scenario: Older DIAL Core response without budgets

- **WHEN** DIAL Core's response has no `budgets` key
- **THEN** the BFF returns `200` with no `budgets` key, and `deployments` and the top-level `*CostStats` are unchanged

#### Scenario: Existing fields are unaffected by budgets

- **WHEN** DIAL Core returns `budgets` together with `deployments` and top-level `dayCostStats`/`monthCostStats`
- **THEN** the BFF response's `deployments` and `*CostStats` are deep-equal to DIAL Core's, and no budget figure appears in them

### Requirement: Generated client exposes typed budgets

The generated client SHALL expose `budgets` with its types, produced by the repository scripts only.

The committed OpenAPI artifact `libs/chat-api-client/openapi.json` and the generated
`@epam/ai-dial-chat-api-client` SHALL be regenerated with `npm run openapi` and checked with
`npm run openapi:check`. Nothing in `libs/chat-api-client/src/generated` SHALL be hand-edited.

- The OpenAPI document SHALL contain a `BudgetStatsDto` schema with required `costObject`
  (string), `policy` (string), `day` and `month` (`$ref` to `LimitStatsDto`), and optional
  `priority` (integer) and `displayName` (string). `UserLimitStatsResponseDto.budgets` SHALL be an optional array whose
  items `$ref` `BudgetStatsDto`.
- The generated model `UserLimitStatsResponseDto` SHALL declare `budgets?: Array<BudgetStatsDto>`,
  and `BudgetStatsDto` SHALL be exported from the package entry point.
- Generated-client impact: operationIds stay `getUserLimits` / `getUserUsage`; the request
  parameters (`deploymentTypes?`) are unchanged; the response DTO of both is still
  `UserLimitStatsResponseDto`, and both now expose `budgets`. Frontend callers keep using the
  normal (non-`Raw`) methods. `apps/chat/src/server-api/user-limits.ts` needs no change.
- Hand-authored consumers of `UserLimitStatsResponseDto`, such as `libs/chat-hooks/src/usage`,
  SHALL compile unchanged. Reading `budgets` in a lib or the UI is out of scope for this
  requirement.

#### Scenario: OpenAPI schema describes budgets

- **WHEN** the Swagger document is built from the `chat-api` controllers
- **THEN** `components.schemas.BudgetStatsDto` exists with `required` containing `costObject`, `policy`, `day` and `month` but not `priority` or `displayName`, and `components.schemas.UserLimitStatsResponseDto.properties.budgets` is an array of `BudgetStatsDto` that is not in that schema's `required`

#### Scenario: Both generated methods expose the budget type

- **WHEN** a TypeScript consumer awaits `userApi.getUserLimits()` or `userApi.getUserUsage()`
- **THEN** the result's `budgets` property is typed `BudgetStatsDto[] | undefined`, with no local cast or type augmentation

#### Scenario: Generated output is reproducible

- **WHEN** `npm run openapi` is run on the implemented branch
- **THEN** it leaves `libs/chat-api-client/openapi.json` and `libs/chat-api-client/src/generated` unchanged, and `npm run openapi:check` passes
