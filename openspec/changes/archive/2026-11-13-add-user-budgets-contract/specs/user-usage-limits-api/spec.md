## ADDED Requirements

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
  `priority` (integer). `UserLimitStatsResponseDto.budgets` SHALL be an optional array whose
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
- **THEN** `components.schemas.BudgetStatsDto` exists with `required` containing `costObject`, `policy`, `day` and `month` but not `priority`, and `components.schemas.UserLimitStatsResponseDto.properties.budgets` is an array of `BudgetStatsDto` that is not in that schema's `required`

#### Scenario: Both generated methods expose the budget type

- **WHEN** a TypeScript consumer awaits `userApi.getUserLimits()` or `userApi.getUserUsage()`
- **THEN** the result's `budgets` property is typed `BudgetStatsDto[] | undefined`, with no local cast or type augmentation

#### Scenario: Generated output is reproducible

- **WHEN** `npm run openapi` is run on the implemented branch
- **THEN** it leaves `libs/chat-api-client/openapi.json` and `libs/chat-api-client/src/generated` unchanged, and `npm run openapi:check` passes
