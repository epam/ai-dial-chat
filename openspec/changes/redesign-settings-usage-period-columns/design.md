## Context

The Usage page has two independent presentations of the same already-fetched
`UserLimitStatsResponseDto`: aggregate cost cards and a per-deployment Model limits table. The cards
already show the three requested rolling windows. The table currently stores one selected
`ModelLimitsPeriod` in `UsageTab`, maps only that window, and renders Cost, Tokens, Requests, and
Status columns through the host-agnostic `libs/usage-dashboard` package.

The upstream response already contains the required pairs:

| Displayed column | Cost | Tokens |
|---|---|---|
| Last 24 hours | `dayCostStats` | `dayTokenStats` |
| Last 7 days | `weekCostStats` | `weekTokenStats` |
| Last 30 days | `monthCostStats` | `monthTokenStats` |

No fetch, endpoint, DTO, or persistent state change is required. The main design constraint is
library isolation: `libs/usage-dashboard` must not know these DTO field names, API routes, currency
rules, deployment metadata sources, or status thresholds.

## Goals / Non-Goals

**Goals:**

- Present the three requested periods simultaneously in one table.
- Put token usage/progress and cost for a period in the same period cell.
- Compute one conservative Status from token limits across all displayed periods.
- Preserve the current deployment identity, empty/loading/error behavior, status thresholds, and
  aggregate cards.
- Keep the component usable at 360px, aligned at desktop widths, direction-agnostic under RTL, and
  semantically exposed as one accessible table.

**Non-Goals:**

- Backend/OpenAPI/generated-client changes.
- New contexts, hooks, server state, cache entries, authorization, rate limiting, or telemetry.
- Requests, minute/hour metrics, sorting, pagination, or configurable periods.
- A redesign of `UsageLimitCardGroup`.

## Decisions

### 1. Replace selected-period rows with a fixed comparison row model

The library contract will introduce a normalized period-cell shape:

```ts
interface ModelLimitPeriodCell {
  tokens: ModelLimitMetricCell;
  cost: ModelLimitMetricCell;
}

interface ModelLimitRow {
  id: string;
  name: string;
  version?: string;
  avatarSrc?: string;
  last24Hours: ModelLimitPeriodCell;
  last7Days: ModelLimitPeriodCell;
  last30Days: ModelLimitPeriodCell;
  status: ModelLimitStatus;
}
```

`ModelLimitsSectionProps` will become `{ rows, labels, styles?, emptyStateIconSize? }`.
`ModelLimitsPeriod`, `period`, `onPeriodChange`, `periodLabels`, and
`periodSelectorAriaLabel` will be removed from this component's public contract. Labels will expose
fixed period column labels, a visible `tokensLabel`, and a `costLabel` used only as accessible
context for the otherwise value-only Cost output.

This is a deliberate workspace-wide breaking change. Search shows no production consumer outside
`UsageTab`; library tests and README examples are the remaining consumers.

Alternative: retain the old fields and populate them three times through nested rows. Rejected
because it preserves meaningless selected-period state and makes invalid combinations representable.

### 2. Keep DTO interpretation in the app mapper and return all periods in one pass

`mapUserUsageToModelLimits` will drop its `period` argument and map the fixed day/week/month field
pairs for every deployment. It will reuse the current usable-stat classification, unlimited
sentinel handling, number/cost formatting, locale resolution, and avatar resolution. `UsageTab`
will remove `useState`, the selector callback, and selected-period dependencies, then memoize rows
only from `usage`, deployment items, active locale, and `t`.

The host-owned contract crossing into `libs/usage-dashboard` is only the preformatted
`ModelLimitRow[]` and localized labels. API DTOs, `@epam/chat-api-client`, server-api calls,
feature flags, locale resolution, icon URL resolution, and currency formatting remain in
`apps/chat`.

Alternative: pass the raw deployment DTO to the library and let it build periods. Rejected because
it violates library isolation and couples a reusable UI package to one host API.

### 3. Aggregate Status from the three token cells only

The adapter will reduce `last24Hours.tokens`, `last7Days.tokens`, and `last30Days.tokens` using the
existing severity order:

1. any finite `LimitReached` → `LimitReached`;
2. otherwise any finite `RunningLow` → `RunningLow`;
3. otherwise any finite `WithinLimits` → `WithinLimits`;
4. otherwise any unlimited token cell → `NoLimit`;
5. otherwise → `Unavailable`.

Cost is displayed but does not participate because per-deployment cost stats are attributed spend
with no finite cap; including them would turn token-unavailable rows into misleading `NoLimit`
statuses. The 75% and 100% thresholds remain unchanged. Progress fill remains visually capped at
100%, while the normalized percentage and accessible text retain the actual over-limit value.

Alternative: derive Status from Last 30 days only. Rejected because it contradicts the requirement
that Status depend on all three windows and can hide a shorter-window limit breach.

### 4. Filter rows across the complete comparison instead of a selected period

A deployment candidate will be retained when any usable Cost or Tokens stat in day/week/month has
`used > 0`. The candidate source and order remain `Object.keys(usage.deployments)`; deployment items
remain enrichment-only. If no candidates remain, `ModelLimitsSection` keeps rendering its heading,
count, and existing empty state, now without a selector.

This preserves the recently established intent to hide empty deployment entries while removing the
selector-dependent row set. A cost-only row remains visible and has `Unavailable` token Status when
all three token stats are unavailable.

### 5. Use one responsive table with stacked mobile rows

Desktop (≥769px) will use one shared five-column grid for header and rows: Item, three flexible
period columns, and Status. Each period cell renders the Tokens label, then one compact baseline row
containing the token amount/state and a trailing value-only Cost, followed by the full-width token
progress bar when finite. Cost has no visible label, total, or No limit text. Grid items are centered
along the row's vertical axis while retaining their existing horizontal alignment.

Mobile (≤768px) will keep one semantic table/row tree but hide the desktop header and stack each row:
identity first, then three labelled period sections, then a labelled Status. Base styles are
mobile-first and desktop changes use only `desktop:`. The component must not introduce page-level
horizontal scrolling at 360px; long identity/value content gets `min-w-0` and wrapping/truncation
consistent with the existing identity cell. No JS breakpoint branch is needed.

All spacing and alignment use logical properties/classes so RTL inherits from the document. There
are no directional icons to mirror. Each `ProgressBar` keeps a period-specific accessible name and
full `aria-valuetext`; the table retains `table`, `rowgroup`, `row`, `columnheader`, and `cell` roles.
The empty state remains non-interactive and its icon remains decorative.

Alternative: horizontally scroll the five desktop columns on mobile. Rejected because users would
lose at-a-glance comparison and the responsive workflow requires no page-level overflow at 360px.

### 6. Reuse existing localization and feature gating

`UsageI18nKeys.TodayPeriodDescription`, `ThisWeekPeriodDescription`, and
`ThisMonthPeriodDescription` provide the three headers. Existing Tokens, Status, Item,
metric-state, badge, and empty-state labels are reused. Cost remains available as screen-reader
context but is not rendered as a visible sublabel. Minute/hour/period-selector/request labels may
be removed only after a workspace search proves they have no remaining consumer. No new
user-visible string is required.

The surface remains gated only through the existing `settingsPageEnabled` feature behavior. It adds
no `ENABLED_FEATURES` or `ENABLED_FEATURES_ROLES` key and no role-specific branch.

### 7. Preserve loading, error, observability, and network behavior

`useUsageData` and `useDeployments` remain the state owners. Loading continues to show the current
spinner before cards/table render; a usage failure continues through the existing notification and
empty normalized rows. No endpoint is added or changed, so authorization, generated-client impact,
rate limiting, caching/TTL/invalidation, and new metrics/analytics are not applicable.

## Risks / Trade-offs

- [Five columns can become dense near 769px] → use flexible `minmax(0, 1fr)` period tracks, a bounded
  status track, compact token notation, a shrinkable/truncated trailing Cost value, and
  truncation/wrapping elsewhere; verify at 769px as well as 1280px.
- [Breaking library types can leave stale consumers] → search the workspace, migrate all call sites,
  update exports/README, and run typecheck for both `chat` and `usage-dashboard`.
- [Nested rolling windows may repeat cumulative values] → label each column explicitly; repetition
  is the intended comparison and no arithmetic is performed between windows.
- [Status can look more severe than the longest-period bar] → keep the badge conservative and test
  that any shorter-window breach wins; accessible progress text lets users identify the source.
- [Removing Requests may surprise existing users] → call it out in release/PR notes; rollback is a
  code-only revert with no data migration.
- [Malformed stats] → preserve explicit Unavailable rendering and exclude malformed values from both
  status and the non-zero-usage predicate.

## Migration Plan

1. Change normalized library types and `ModelLimitsSection` rendering/tests as one compilable slice.
2. Change the app mapper to emit all three period cells and migrate `UsageTab` labels/props/tests.
3. Update `libs/usage-dashboard/README.md` and remove only proven-unused i18n keys.
4. Run library/app lint, typecheck, and tests; run docs validation because the public README changes.
5. Verify 360px, 769px, and 1280px layouts during implementation and include an RTL rendering check.

Rollback reverts the library and app slices together, restoring the selected-period contract and
state. There is no persisted state, API version, or deployment-order dependency.

## Open Questions

None for proposal readiness. The design assumes the requested “slider” is the current token
`ProgressBar`, aggregate cards remain, Requests are removed, and Status is the worst token-limit
severity across the three displayed windows.
