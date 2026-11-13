## Context

DIAL Core's `UserLimitStats` (`GET /v1/user/limits`, `GET /v1/user/usage`) gained
`budgets: BudgetStats[]` in epam/ai-dial-core#2188. The upstream classes are:

```java
// BudgetStats.java
private String costObject;
private String policy;                               // the budget's policy path
@JsonInclude(NON_NULL) private Integer priority;     // absent when the policy sets none
private CostItemLimitStats day;
private CostItemLimitStats month;

// CostItemLimitStats.java — same class as the top-level *CostStats
private BigDecimal total = ZERO;
private BigDecimal used = ZERO;
@JsonInclude(NON_NULL) private String resetsAt;      // DAY/WEEK/MONTH only
```

`UserBudgetsApiTest` shows the observable behaviour. Entries are ordered (`ORG, projA, projB`).
One cost object can appear twice with different policies and priorities. `resetsAt` is set on
both windows. The array is empty when no budget applies or when the caller is an API key, and
the legacy `deployments`/`dayCostStats`/`monthCostStats` are still present.

Current state in this repo (observed):

- `UserLimitStatsResponseDto` (`apps/chat-api/src/openapi/openapi-response.dto.ts`) declares
  `deployments` and the four top-level `*CostStats`, but not `budgets`.
- `DeploymentsDetailsService.getUserLimits`/`getUserUsage` return
  `result.data as unknown as UserLimitStatsResponseDto`. The controller returns that object, and
  no global `ClassSerializerInterceptor` or response mapping is registered (only
  `MetricsInterceptor`). So `budgets` most likely already reaches the browser at runtime. This
  has not been checked end-to-end; the new tests pin it at the service and controller layer.
- `@epam/ai-dial-typescript-sdk@0.2.0` already types `UserLimitStats.budgets?: BudgetStats[]`.
  Every `BudgetStats` field is optional there, and `CostItemLimitStats` is
  `{ total?; used?; resetsAt? }`.
- The generated client is built with `typescript-fetch` and `withoutRuntimeChecks=true`
  (`apps/chat-api/package.json` `openapi-sdk` target). It has no `FromJSON` mappers, so
  regeneration only changes types.

## Goals / Non-Goals

**Goals:**

- Publish `budgets[]` in the BFF OpenAPI contract and the generated client for both operations.
- Pin pass-through behaviour (order, duplicates, absent vs. empty, fractions, timestamps, the
  sentinel) with regression tests.

**Non-Goals:**

- Any consumer (User Profile, Usage page, `libs/chat-hooks` mappers), budget display metadata,
  forecasts, an SDK upgrade, or changes to auth, caching and error mapping.

## Decisions

### D1 — Reuse `LimitStatsDto` for `day` / `month`

Both windows are Core's `CostItemLimitStats`, the class behind the top-level `*CostStats`, which
the BFF already publishes as `LimitStatsDto { total; used; resetsAt? }` with the
calendar-period `resetsAt` description. Reusing it keeps one schema for one upstream class, and
the generated client gets no near-duplicate model.

*Alternative:* a dedicated `BudgetWindowDto`. Rejected because it would copy the same three
fields and the `resetsAt` text, and the two could drift.

### D2 — Required/optional mirrors Core's serialization, not the SDK's typing

Core never omits `costObject`, `policy`, `day` or `month` (no `NON_NULL`), and the window's
`total`/`used` default to zero. Only `priority` (and `resetsAt`) are `NON_NULL`. So
`BudgetStatsDto` marks `costObject`, `policy`, `day`, `month` required and `priority` optional,
with `@ApiPropertyOptional({ type: 'integer' })`, because Core's `Integer` is integral.

*Alternative:* everything optional, as the SDK has it. Rejected because it would make every
consumer null-check fields Core always sends, and the hand-authored DTO is already the
authoritative BFF contract (see the "Known contract divergence" note in the
`user-usage-limits-api` spec).

*Assumption (recorded):* Core does not emit `"day": null` for a configured budget. If a real
payload contradicts this, relax the field to optional in a follow-up. That is an additive change
to the type.

### D3 — `budgets` itself is optional; no BFF normalization

`@ApiPropertyOptional({ type: () => [BudgetStatsDto] })`, with no `default`. The service keeps
returning `result.data` untouched, so an older Core's missing field stays missing and `[]` stays
`[]`. Consumers can tell "Core doesn't support budgets" apart from "no budget applies". That
distinction is lost if the BFF defaults to `[]`.

*Alternative:* map Core's body to a DTO instance or default `budgets ?? []`. Rejected because
that adds a new transformation layer on a route the spec defines as pass-through, and it would
erase the distinction the issue asks for.

### D4 — Document semantics on the property, not in code

The `budgets` description carries the ordering, duplicate cost objects, separation from the
legacy `*CostStats`, absent-vs-empty, and the `>= 2^53` unlimited sentinel. This is the same
place where `minuteCostStats` documents the sentinel today, so the text lands in the generated
JSDoc for client consumers. `BudgetStatsDto` fields carry short descriptions and examples taken
from the Core Javadoc.

### D5 — Tests at three layers, no new fixture files

1. **Service** (`deployments-details.service.spec.ts`, inside the existing `getUserLimits` /
   `getUserUsage` blocks). Parameterize over both methods: the SDK mock returns a
   budget-bearing payload, and the result `toEqual`s it. Add cases for `budgets: []` (key kept)
   and for no `budgets` (`not.toHaveProperty('budgets')`).
2. **Controller integration** (`user-limits.controller.integration.spec.ts`). Add a
   `USAGE_WITH_BUDGETS` fixture next to `USAGE_WITH_RESETS_AT`. It has two `projA` entries
   (`priority` 1 and 2), one entry without `priority`, fractional `used`, the sentinel `total`,
   and `resetsAt` on both windows. Run `it.each` over `limits`/`usage` and assert the supertest
   body deep-equals the fixture, including order and existing fields. Also cover the `[]` and
   legacy no-`budgets` bodies. The sentinel goes through the same JSON round trip as the
   existing `UNLIMITED_SENTINEL` constant.
3. **OpenAPI contract** (a new case next to `apps/chat-api/src/openapi/tests/openapi.config.spec.ts`,
   building the document with `UserLimitsController`). Assert the `BudgetStatsDto` schema,
   `required`, the `priority` integer type, the `$ref`s to `LimitStatsDto`, and that `budgets`
   is optional.

The generated-client type check is covered by `npm run openapi:check` plus `chat-api-client`
build and lint. No frontend test is needed, because the wrapper is unchanged.

## Risks / Trade-offs

- [Core shape drifts from D2's required set] → Tests pin today's Core shape. Making a field
  optional later is non-breaking for the published type.
- [`openapi-generator-cli` needs Java/network and fails locally] → Run it where the tooling
  works. Never hand-edit `libs/chat-api-client/src/generated`, and fix the environment rather
  than the output.
- [Sentinel loses precision in JS (`9223372036854775807` → `9223372036854776000`)] → This is
  already the case for the existing cost stats. The documented threshold (`>= 2^53`) is chosen
  to survive that rounding.
- [Runtime pass-through assumed, not observed live] → The service and controller tests prove the
  BFF does not touch the field. A live check against a Core build with #2188 is optional manual
  verification.

## Migration Plan

Additive. Merge, regenerate, publish the client as usual. Rollback: revert the commit and run
`npm run openapi` again. There is no data, env or runtime migration.

## Open Questions

_None blocking._ Whether the SDK should tighten `BudgetStats` optionality is an upstream concern
for `@epam/ai-dial-typescript-sdk`, not for this change.
