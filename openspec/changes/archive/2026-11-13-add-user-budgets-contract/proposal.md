## Why

DIAL Core now returns the caller's applicable spending budgets as `budgets[]` on both
`GET /v1/user/limits` and `GET /v1/user/usage` (epam/ai-dial-core#2188). The BFF proxies both
routes, but `UserLimitStatsResponseDto` (`apps/chat-api/src/openapi/openapi-response.dto.ts:557`)
does not describe the field. The published OpenAPI contract and the generated
`@epam/ai-dial-chat-api-client` therefore have no typed `budgets`, so consumers such as User
Profile cannot read each budget's limit, spend and reset time without a local workaround
(GitHub issue #9855).

## What Changes

- Add a `BudgetStatsDto` Swagger response class next to `LimitStatsDto`
  (`apps/chat-api/src/openapi/openapi-response.dto.ts:503`): `costObject`, `policy`, optional
  `priority`, and `day`/`month` typed as the existing `LimitStatsDto` (`total`, `used`,
  optional `resetsAt`). That window contract matches Core's `CostItemLimitStats` exactly, so
  the class is reused rather than duplicated.
- Add an optional `budgets?: BudgetStatsDto[]` to `UserLimitStatsResponseDto`. Its description
  says that entries keep Core's order, that a cost object can have several entries, that the
  budgets are separate from the legacy top-level `*CostStats`, and how an absent field differs
  from an empty array. It also documents the `Long.MAX_VALUE` unlimited sentinel
  (`total >= 2^53` ⇒ unlimited).
- Keep runtime behaviour unchanged: `DeploymentsDetailsService.getUserLimits`/`getUserUsage`
  already return `result.data` verbatim (`apps/chat-api/src/deployments/details/deployments-details.service.ts:667`,
  `:707`). No mapping, merging, sorting or defaulting is added.
- Regenerate `libs/chat-api-client/openapi.json` and the generated client with `npm run openapi`.
  The generated client has no `FromJSON` transforms, so `getUserLimits()`/`getUserUsage()`
  return the BFF body as-is and only gain the type.
- Add regression coverage: service-level pass-through tests and controller integration tests for
  both endpoints (multiple budgets, a repeated `costObject`, an omitted `priority`, fractional
  spend, reset timestamps, `budgets: []`, a legacy response with no `budgets`, existing fields
  unchanged), plus an OpenAPI schema assertion for the new DTO.
- Update the `user-usage-limits-api` spec and the endpoint rows in `docs/architecture.md`.

No breaking change: the field is optional and additive in both the OpenAPI schema and the
generated TypeScript type.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `user-usage-limits-api`: both endpoints' response contract gains an optional, order-preserving
  `budgets[]` (`BudgetStatsDto`). This covers absent vs. empty semantics, the unlimited sentinel,
  and the regenerated client exposing the type on `getUserLimits()` and `getUserUsage()`.

## Impact

- **Backend (`apps/chat-api`)**: `openapi-response.dto.ts` (new DTO plus one property),
  `deployments-details.service.spec.ts`, `user-limits.controller.integration.spec.ts`, and an
  OpenAPI schema test. The service and controller code are unchanged. The model is the existing
  `LimitStatsDto`/`DeploymentLimitsResponseDto` pattern in the same file, and the controller
  follows `apps/chat-api/src/deployments/user-limits.controller.ts:21`.
- **Generated client (`libs/chat-api-client`)**: regenerated output only (new `BudgetStatsDto`
  model, `budgets?` on `UserLimitStatsResponseDto`). Nothing is hand-edited. This is the
  generated-client exception to library isolation, and no hand-authored lib gains host knowledge.
- **Consumers**: `libs/chat-hooks/src/usage/*` and `apps/chat/src/server-api/user-limits.ts` import
  `UserLimitStatsResponseDto`. An extra optional property needs no code change, and none of them
  reads budgets in this change.
- **Auth**: unchanged. Both routes keep `SessionGuard` plus `Authorization: Bearer <session.at>`
  upstream, and `DIAL_API_KEY` is never used. API-key callers of Core get no budget entries, and
  the BFF never makes such calls.
- **i18n**: no new user-visible strings.
- **Docs**: `docs/architecture.md` (BFF endpoint table rows for `/api/v1/user/limits` and
  `/api/v1/user/usage`).

## Non-goals

- Any User Profile or Usage page UI for budgets, or `libs/chat-hooks` / `libs/usage-dashboard`
  mapping of budgets.
- Package display names, icons, stable package IDs, API-key associations and forecasts.
- Application-attributed spend (#9136).
- Upgrading `@epam/ai-dial-typescript-sdk`. Version 0.2.0 already types `UserLimitStats.budgets`
  as `BudgetStats[]`, and the existing `as unknown as UserLimitStatsResponseDto` cast stays.

## Acceptance criteria

- `/api-json` (and the committed `libs/chat-api-client/openapi.json`) contains a `BudgetStatsDto`
  schema with required `costObject`, `policy`, `day`, `month`, optional integer `priority`, and
  `day`/`month` referencing `LimitStatsDto`. `UserLimitStatsResponseDto.budgets` is an optional
  array of it.
- The generated `UserLimitStatsResponseDto` has `budgets?: Array<BudgetStatsDto>`, and the
  response type of both `UserApi.getUserLimits()` and `UserApi.getUserUsage()` exposes it.
  `npm run openapi:check` passes.
- For both endpoints, tests show that a Core payload with budgets comes back from the BFF
  deep-equal to the input. This includes entry order, duplicate cost objects, a missing
  `priority`, fractional `used`, `resetsAt` strings and the sentinel `total`. `budgets: []` stays
  `[]`, a payload without `budgets` stays without the key, and the existing `deployments` and
  `*CostStats` are untouched.
- `npm run validate:specs` and `npm run validate:docs` pass.

## Alternatives considered

- **New `BudgetWindowDto` instead of reusing `LimitStatsDto`.** Rejected: Core's budget windows
  use the same `CostItemLimitStats` class as the top-level cost stats, so a second identical
  schema would only add drift.
- **Normalize in the BFF (default `budgets` to `[]`, sort by priority, merge into `*CostStats`).**
  Rejected: the issue requires absent and empty to stay distinct and order to be preserved. The
  BFF is a pass-through proxy for these routes.

## Rollback

Revert the commit and run `npm run openapi` again. No persisted data, environment variables or
runtime behaviour change, so the rollback removes only the type.
