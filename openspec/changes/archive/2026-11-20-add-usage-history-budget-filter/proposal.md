## Why

`GET /api/v1/user/usage/history` (#9928, change `add-user-usage-history-api`) returns the caller's history across all
of their spending budgets: Core did not log which budget paid. DIAL Core now writes the charged budget on each model
row of the analytics log (ai-dial-core#2308, `spending_limits.cost_object`/`policy`/`outcome`), and DIAL Analytics
stores it in `dial_usage_log` (ai-dial-analytics V18: `budget_cost_object`, `budget_policy`, `budget_outcome`). The
User Profile portal shows one package (budget) per page and needs that package's own history, not the user's total.

## What Changes

- `GET /api/v1/user/usage/history` accepts optional `costObject` and `policy`, both or neither (`400` otherwise).
- With a budget, every query keeps the window and adds `budget_cost_object = costObject`, `budget_policy = policy`
  and `budget_outcome = 'paid'`, drops the root-span predicate and sums `deployment_price`: Core writes the budget on
  model rows only, and a budget's spend is the sum of `deployment_price` over its rows (ai-dial-core design of #2308).
- The response echoes `budget: { costObject, policy }` when narrowed. `requests` then counts paid model calls.
- New reason `budget_unsupported` when a budget is requested and the caller's ADAS schema of `dial_usage_log` lacks
  the budget columns; no usage query runs.
- OpenAPI and the generated client gain the two parameters, the `budget` field and the new reason.

## Capabilities

### New Capabilities

### Modified Capabilities

- `user-usage-history`: adds the optional budget narrowing (delta as ADDED requirements, because the capability's
  main spec is created when `add-user-usage-history-api` is archived).

## Non-goals

- Per-key usage, and any budget the caller is not reported in `GET /user/limits` (the ADAS row policy still confines
  rows to the caller; no extra authorization is added or needed).
- Backfilling rows written before Core logged the budget.
- A UI: the consumer is User Profile.

## Alternatives considered

- **Filter root spans by budget** — rejected: application and router rows carry no budget, so calls through an
  application would vanish.
- **Filter by the models a budget covers (`budgets[].object`)** — rejected: budgets of one cost object share models
  and Core picks the payer by priority and remaining room at call time; it double-counts.
- **A separate route** — rejected: the response shape and failure contract are identical; two optional parameters
  keep one contract and one client method.

## Acceptance criteria

- With `costObject` + `policy`, all four ADAS queries carry the three budget predicates, no `parent_deployment`
  predicate, and sum `deployment_price`; the body echoes `budget`.
- Without them, the queries and the body are byte-for-byte as before.
- One of the two, an empty or a > 1024-character value, or a repeated parameter is `400` with no upstream call.
- Without the budget columns in the caller's schema the answer is `available: false, reason: budget_unsupported`,
  with no usage query; the row-restriction guard still runs first.
- For a test user, a budget's `totals.spend` for `month` matches that budget's `month.used` from `GET /user/limits`
  for calls made after Core #2308 was deployed (manual check against the dev stand).

## Rollback / compatibility

Additive: both parameters are optional and existing callers are unaffected. A client that does not know
`budget_unsupported` treats it as any other unavailable reason. Revert by removing the parameters; no data migration.

## Impact

- `apps/chat-api/src/usage-history/` (query DTO, queries, service, mapper, controller, response DTO, reason enum, tests).
- `libs/chat-api-client` regenerated (`openapi.json`, `UserApi.ts`, `models/index.ts`).
- `apps/chat-api/README.md` "Usage history (DIAL Analytics)", `docs/architecture.md` route table.
- No i18n: backend only.
