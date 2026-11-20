## Context

The route's four fixed ADAS queries (`apps/chat-api/src/usage-history/queries/usage-history.queries.ts`) share one
window filter that keeps root spans (`parent_deployment IS NULL`) and sum `total_price`. DIAL Core writes
`spending_limits` only on model rows of JWT callers, never on application, interceptor, router or route rows, and
documents a budget's spend as the sum of `deployment_price` over its rows; for a model row `total_price` equals
`deployment_price` (ai-dial-core `openspec/changes/archive/2026-11-18-analytics-log-budget/design.md`). ADAS exposes
them as `budget_cost_object`, `budget_policy`, `budget_outcome` and `budget_assignment` (ai-dial-analytics
`V18__dial_usage_log_budget.sql`).

## Goals / Non-Goals

**Goals:** one optional narrowing that reuses the existing queries, mapper and failure contract.

**Non-Goals:** narrowing by `budget_assignment` (User Profile keys a package by cost object and policy); a per-budget
client split beyond what the enrichment gives on model rows.

## Decisions

- **D1 Scope as an optional argument.** Every query builder takes `budget?: UsageBudget`. Absent, the builders emit
  exactly the previous documents, so existing tests and callers stay unchanged. Present, `scopePredicates` replaces
  the root-span predicate with the three budget predicates and `priceField` switches to `deployment_price`.
- **D2 `paid` only.** `no_budget` and `exhausted` rows (shadow mode) charged nothing; counting them would disagree with
  the budget's Core counter.
- **D3 Schema guard.** In budget scope the service awaits the schema discovery it already starts for the client
  split, and answers `budget_unsupported` unless all three budget columns are listed. A missing column would
  otherwise fail the query (an unknown field) or, if hidden by a column grant, silently count nothing. A failed
  schema read maps like the table read (`forbidden` for 401/403, else `unavailable`). The row-restriction guard
  still runs first.
- **D4 Validation.** `@ValidateIf` on either parameter being present makes both required together; `IsString`,
  `IsNotEmpty`, `MaxLength(1024)`. A repeated parameter arrives as an array and fails `IsString`. The values reach ADAS
  only as `value_type: 'string'` literals of the fixed documents.
- **D5 Echo.** The mapper adds `budget` to an available body so a consumer can tell a narrowed answer from a whole one.

## Risks / Trade-offs

- [Client split on model rows] → the enrichment classifies each row from its own request headers; a model row called
  by an application may classify as that application's client. Documented; no change to the enrichment.
- [History before Core #2308] → those rows have no budget and are not counted; consumers say history starts then.
- [`requests` meaning differs by scope] → documented on every `requests` field.
