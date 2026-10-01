## Context

The catalog details panel's `Limits` tab is built by `mapDeploymentLimitsDtoToCatalogLimits`
(`libs/chat-hooks/src/catalog/map-deployment-limits-to-catalog.ts`) from the BFF proxy of DIAL
Core's `GET /v1/deployments/{id}/limits`, called via `useCatalogItemDetails` with a
`DeploymentLimitsLabels` object built in `apps/chat/src/hooks/useCatalogItems/useCatalogItems.ts`.

Temporary debug logging of the raw Core responses (2026-10-01, removed after diagnosis) established:

| Source | `weekCostStats` for `gemini-3.5-flash` |
| --- | --- |
| `GET /v1/deployments/gemini-3.5-flash/limits` | `used 0.56228508`, `total 200` |
| `GET /v1/user/usage` → `deployments["gemini-3.5-flash"]` | `used 0.028953`, `total Long.MAX_VALUE` |
| `GET /v1/user/usage` → top level | `total 200` (matches the Usage card) |

`0.56228508` = Terra `0.53333` + gemini `0.028953` + embedding `0.00000208` exactly, and the gap
between `weekCostStats.used` and `dayCostStats.used` stayed constant (`0.53333208`) across two
requests while gemini's own day spend grew. The deployment-limits cost stats are therefore the
account-wide budget and account-wide spend (plus, per the existing note in
`map-deployment-limits-to-input.ts`, any cost the queried deployment aggregated from callees — zero
for a plain model). Token stats in both responses agree. All `resetsAt` values are calendar
boundaries (`2026-10-02`, `2026-10-05` Monday, `2026-11-01`).

The conversation-input popover (`mapDeploymentLimitsToInput`) already handles both facts correctly:
it lists cost as its own account-budget group, sets no `captionLabel`, labels periods
Today / This week / This month, and threads a `formatResetTime` callback.

## Goals / Non-Goals

**Goals:**
- Stop attributing account-wide spend to a single model in the catalog panel.
- Name the token rows by the calendar periods Core actually reports, identically to Settings → Usage.
- Show each row's reset time, reusing the popover/Usage formatter and `LimitRow` markup.

**Non-Goals:**
- Per-deployment spend in the panel (needs `GET /v1/user/usage`; declined).
- An account-budget group in the panel (already in the popover and the Usage cards).
- A boundary-triggered re-fetch for the panel (it fetches on open, like the popover).
- BFF, Core, `libs/catalog`, or `libs/usage-dashboard` changes.

## Decisions

1. **Drop cost entirely from the catalog mapper rather than relabel it.** Reading `*CostStats` at all
   in a model-scoped panel invites the same misattribution; the mapper now reads only the three
   calendar token stats. Alternatives (fetch `/user/usage` for per-model spend; render an account
   group) are recorded in the proposal.

2. **`formatResetTime` lives on `DeploymentLimitsLabels`, optional.** The labels object already
   carries formatter callbacks and is the single value `useCatalogItemDetails` threads to the mapper,
   so adding the callback there avoids widening `UseCatalogItemDetailsOptions` and the hook's
   dependency list. Alternative: a third mapper parameter like `mapDeploymentLimitsToInput` — rejected
   because it would add a new option to the public hook for one callback. Optional keeps hosts that
   don't format reset times compiling.

3. **Reuse `buildResetFields` from `map-deployment-limits-to-input.ts`.** It already implements the
   absent-not-undefined trio; it is exported from that module for in-package reuse only and is not
   added to the package index.

4. **Reuse `usage.todayTitle` / `thisWeekTitle` / `thisMonthTitle` instead of rewording the catalog
   keys.** Same English strings exist under `UsageI18nKeys`; per the duplicate-translation rule the
   catalog references them and its own `tokensPer*` and `spentLabel` keys are deleted. The
   `DeploymentLimitsLabels` field names (`tokensPerDay`…) are kept to avoid a second breaking rename.

5. **Library isolation.** `libs/chat-hooks` receives reset formatting only as a `FormatResetTime`
   callback; `Date`/`Intl` stay in `apps/chat/src/utils/usage-reset-time.ts`. `libs/catalog` already
   renders the reset trio verbatim. `useCatalogItems` casts `TFunction` to the plain
   `(key, options) => string` signature exactly as `UsageTab` and `UsageLimitsControl` do.

States: loading, empty, and error states of the `Limits` tab are unchanged — the tab is hidden when
the mapper returns `undefined`, and a failed limits fetch already yields `undefined`.

## Risks / Trade-offs

- [Breaking public type: `formatSpentCaption` removed] → Only in-repo host is `useCatalogItems`;
  external hosts get a compile error pointing at the field. Called out in the proposal.
- [Users lose a spend figure in the panel] → It was wrong; correct per-model spend remains on
  Settings → Usage.
- [Core semantics of deployment-limits cost stats may change upstream] → The mapper no longer reads
  them, so a future Core change cannot reintroduce the bug here.
- [Reset line occupies vertical space in the inline layout] → Same trade-off already accepted for the
  popover; the line wraps on mobile.

## Migration Plan

Ship as a normal frontend change; no data or API migration. Rollback is a plain revert.

## Open Questions

None.
