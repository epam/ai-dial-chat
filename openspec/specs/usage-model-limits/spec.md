# usage-model-limits Specification

## Purpose

Defines the app-level integration that adds a per-model "Model limits" table to the `Usage` tab:
the period state and DTO-to-row adapter that turn `useUsageData()`'s already-fetched
`usage.deployments` into `@epam/ai-dial-usage-dashboard`'s `ModelLimitsSection` rows, without any
additional API call. The adapter owns all DTO interpretation (period-to-field mapping,
finite/unlimited/unavailable detection, status derivation, formatting, and the join against
`useDeployments().items`); the library only renders the rows it is given.

## Requirements

### Requirement: UsageTab renders Model limits below the aggregate cards

The `Usage` tab SHALL render `@epam/ai-dial-usage-dashboard`'s `ModelLimitsSection` below
`UsageLimitCardGroup`, sourced from `useUsageData()`'s already-fetched `usage.deployments` (no
additional API call). The section SHALL be omitted (not rendered) while `isLoading` is `true`,
matching the existing cards' loading behavior, and SHALL render nothing (or an explicit empty state)
when `usage` is `undefined` or `usage.deployments` is absent/empty after loading completes.

#### Scenario: Model limits section renders alongside the cards
- **WHEN** the Usage tab finishes loading and `usage.deployments` contains at least one model
- **THEN** `ModelLimitsSection` renders below `UsageLimitCardGroup` with one row per accessible model

#### Scenario: Empty deployments map renders an explicit empty state
- **WHEN** the Usage tab finishes loading and `usage.deployments` is an empty object
- **THEN** the page renders a localized empty-state message in place of the table, and does not
  render `ModelLimitsSection` with zero rows silently

#### Scenario: Usage fetch failure leaves the rest of the page visible
- **WHEN** `useUsageData()` reports a `usageError`
- **THEN** the Model limits section renders its own unavailable state (no stale/zeroed rows), the
  aggregate cards region reflects the same existing partial/full failure behavior, and no additional
  notification is emitted beyond the one already produced by the existing `usage-data-hook`
  "Deduplicated error notifications" behavior

---

### Requirement: App-owned period state, re-derived without refetching

`UsageTab` (or a small app-level hook) SHALL own the selected `ModelLimitsPeriod` as local React
state, defaulting to `ModelLimitsPeriod.Last24Hours`. Changing the selected period SHALL re-derive
`ModelLimitRow[]` from the already-fetched `usage` value and SHALL NOT invoke `getUserLimits()` or
`getUserUsage()` again, and SHALL NOT emit any notification.

#### Scenario: Default period is Last 24 hours
- **WHEN** the Usage tab first renders the Model limits section
- **THEN** `ModelLimitsSection` is rendered with `period={ModelLimitsPeriod.Last24Hours}`

#### Scenario: Changing period does not refetch
- **WHEN** the user selects "Last 7 days" after the initial fetch has completed
- **THEN** neither `getUserLimits()` nor `getUserUsage()` is called again, and the table's rows
  update synchronously from the already-fetched `usage` data

#### Scenario: Changing period does not notify
- **WHEN** the user changes the selected period
- **THEN** no error or informational notification is shown as a result of that change alone

---

### Requirement: Period-to-field mapping

The adapter SHALL map the selected period to `DeploymentLimitsResponseDto` fields as follows, and
SHALL NOT substitute a different period's field, or a different metric's field, for a missing one:

| Period | Cost field | Tokens field | Requests field |
|---|---|---|---|
| `LastMinute` | `minuteCostStats` | `minuteTokenStats` | *(none — unavailable)* |
| `LastHour` | *(none — unavailable)* | *(none — unavailable)* | `hourRequestStats` |
| `Last24Hours` | `dayCostStats` | `dayTokenStats` | `dayRequestStats` |
| `Last7Days` | `weekCostStats` | `weekTokenStats` | *(none — unavailable)* |
| `Last30Days` | `monthCostStats` | `monthTokenStats` | *(none — unavailable)* |

#### Scenario: Last 24 hours reads day-scoped fields
- **WHEN** the selected period is `Last24Hours` for a deployment with usable `dayCostStats`,
  `dayTokenStats`, and `dayRequestStats`
- **THEN** the row's Cost, Tokens, and Requests cells are derived from those three fields
  respectively

#### Scenario: Last minute reads minute-scoped Cost/Tokens and renders Requests as unavailable
- **WHEN** the selected period is `LastMinute` for a deployment with usable `minuteCostStats` and
  `minuteTokenStats`
- **THEN** the row's Cost and Tokens cells are derived from those fields, and the Requests cell has
  `kind: ModelLimitMetricKind.Unavailable` regardless of any `*RequestStats` value present

#### Scenario: Last hour reads hour-scoped Requests and renders Cost/Tokens as unavailable
- **WHEN** the selected period is `LastHour` for a deployment with usable `hourRequestStats`
- **THEN** the row's Requests cell is derived from `hourRequestStats`, and the Cost and Tokens
  cells both have `kind: ModelLimitMetricKind.Unavailable` regardless of any `*CostStats`/
  `*TokenStats` value present

#### Scenario: Last 7 days renders Requests as unavailable
- **WHEN** the selected period is `Last7Days`
- **THEN** the row's Requests cell has `kind: ModelLimitMetricKind.Unavailable`, regardless of the deployment's
  `dayRequestStats` value, and is never derived from `dayRequestStats`

#### Scenario: Last 30 days renders Requests as unavailable
- **WHEN** the selected period is `Last30Days`
- **THEN** the row's Requests cell has `kind: ModelLimitMetricKind.Unavailable`, regardless of the deployment's
  `dayRequestStats` value

---

### Requirement: `usage.deployments` join with model metadata

The adapter SHALL build rows from exactly the entries present in `usage.deployments` — every entry
present, and no entry not present — regardless of what `useDeployments().items` contains: an
accessible model with no entry in `usage.deployments` SHALL NOT produce a row, and every entry in
`usage.deployments` SHALL produce a row even if no matching `items` entry exists. Row order SHALL
follow `Object.keys(usage.deployments)` order (the order the API returns), independent of `items`'
content, order, or load state — `items` is consulted only to enrich a matched row's display
name/version/avatar, never to determine which rows exist or their order. The join against `items`
SHALL be filtered to `type === DeploymentItemDtoTypeEnum.Model`.

When a deployment ID has no matching entry in `items`, the adapter SHALL still render a row for it,
using the deployment ID as the display name and no `avatarSrc` (so `ModelLimitsSection` falls back
to its initials avatar), rather than omitting the row.

#### Scenario: Row count matches the deployments map
- **WHEN** `usage.deployments` has 12 entries, all resolvable against `items`
- **THEN** `ModelLimitsSection` receives exactly 12 rows and its heading reports a count of 12

#### Scenario: A deployment present in `usage.deployments` with all-zero used values still appears
- **WHEN** a deployment in `usage.deployments` has all-zero `used` values across every stat field
  for the selected period (but the entry itself is present, e.g. it had usage in a different period)
- **THEN** it still produces a row (zero usage for the selected period is not treated as "no data")

#### Scenario: A model never used in the trailing 30 days does not appear at all
- **WHEN** an accessible model has no entry in `usage.deployments` at all (never used in the
  trailing 30 days, per `openspec/specs/user-usage-limits-api/spec.md:80`)
- **THEN** the adapter produces no row for it — this is the accepted trade-off of reading
  `usage.deployments` instead of `limits.deployments` (see design.md's data-source correction), not
  a defect

#### Scenario: Unresolvable deployment ID still renders a fallback row
- **WHEN** a deployment ID in `usage.deployments` has no matching entry in
  `useDeployments().items`
- **THEN** the adapter produces a row for it with `name` equal to the deployment ID and
  `avatarSrc: undefined`, and this row does not cause other rows to be dropped

#### Scenario: Non-model deployment items are never joined in
- **WHEN** `useDeployments().items` contains an application or toolset whose `id` happens to match a
  key in `usage.deployments`
- **THEN** the adapter does not use that non-model item's metadata for the row (join is restricted
  to `type === DeploymentItemDtoTypeEnum.Model`)

#### Scenario: Row order follows `usage.deployments` key order, not `items`' order
- **WHEN** `items` lists models in one order (e.g. `['b', 'a']`) but `usage.deployments` has keys
  in a different order (e.g. `{ a: ..., b: ... }`)
- **THEN** the resulting rows are ordered `['a', 'b']` — `Object.keys(usage.deployments)` order —
  regardless of `items`' order

#### Scenario: Row order does not depend on whether `items` has finished loading
- **WHEN** `useDeployments().items` is still empty (not yet loaded) while `usage.deployments`
  already has data
- **THEN** the rows render immediately in `usage.deployments` key order, with the deployment ID as
  each row's name; once `items` loads, matched rows are enriched with name/version/avatar but the
  row set and order do not change or re-shuffle

---

### Requirement: Per-metric finite/unlimited/unavailable detection

For Cost, the adapter SHALL produce `kind: ModelLimitMetricKind.Unlimited` (attributed spend + "No limit") whenever the
period's cost stat entry itself is well-formed, since per-model cost totals are always the unlimited
sentinel per the upstream contract; it SHALL produce `kind: ModelLimitMetricKind.Unavailable` only when the cost stat
entry is missing or has a non-finite `used`/`total`. The adapter SHALL NOT render a cost progress bar
or a finite cost status under any input. For Tokens and
the Last-24-hours Requests field, the adapter SHALL classify each stat as `finite` when
`Number.isFinite(total)`, `Number.isFinite(used)`, and `total < 2 ** 53`; as `unlimited` when
`total >= 2 ** 53`; and as `unavailable` when the stat is missing, `null`, or has a non-finite
`total`/`used`. An `unavailable` metric SHALL NOT be treated as zero or as unlimited.

#### Scenario: Cost is always unlimited
- **WHEN** a deployment's `dayCostStats` is `{ total: 9223372036854775807, used: 4.2 }`
- **THEN** the row's Cost cell has `kind: ModelLimitMetricKind.Unlimited`, `usedLabel` formatted from `4.2`, and no
  progress bar

#### Scenario: Finite token stat produces a progress-capable cell
- **WHEN** a deployment's `dayTokenStats` is `{ total: 10000, used: 4000 }`
- **THEN** the row's Tokens cell has `kind: ModelLimitMetricKind.Finite`, `usedPercent: 40`, and a `status` derived per
  the status-model requirement below

#### Scenario: Missing stat is unavailable, not zero
- **WHEN** a deployment's `weekTokenStats` field is absent from the DTO entirely
- **THEN** the Tokens cell (when the selected period is `Last7Days`) has `kind: ModelLimitMetricKind.Unavailable`, not
  `used: 0`

#### Scenario: Over-limit used value is preserved, not clamped in the data
- **WHEN** a deployment's `dayTokenStats` is `{ total: 1000, used: 1500 }`
- **THEN** the Tokens cell's `usedPercent` is `150` (uncapped) and `usedLabel` reflects the actual
  `1500`, with only the rendered progress bar clamping visually

---

### Requirement: Per-metric and overall row status model

For each `finite` metric, the adapter SHALL derive `status` from its `usedPercent`: `>= 100` →
`LimitReached`; `>= 75` → `RunningLow`; otherwise → `WithinLimits`. The overall row `status` SHALL be
the most severe status among the row's finite metrics only, in order `LimitReached` >
`RunningLow` > `WithinLimits`. Unlimited metrics SHALL NOT reduce or override a finite status.
Unavailable metrics SHALL NOT participate in status calculation. When every supported metric on a
row is `unlimited`, the row `status` SHALL be `NoLimit`. When a row has no usable (`finite` or
`unlimited`) metric at all, the row `status` SHALL be `Unavailable`.

#### Scenario: Most severe finite metric determines row status
- **WHEN** a row's Tokens cell is `WithinLimits` and its Requests cell (Last 24 hours) is
  `RunningLow`, with Cost always `unlimited`
- **THEN** the row's overall `status` is `RunningLow`

#### Scenario: All-unlimited row is NoLimit
- **WHEN** a row's Cost is `unlimited`, and both Tokens and Requests are also `unlimited`
- **THEN** the row's overall `status` is `ModelLimitStatus.NoLimit`

#### Scenario: Malformed cost entry falls back to unavailable rather than crashing the row
- **WHEN** a deployment's `dayCostStats` entry itself is missing or has a non-finite `used`/`total`
  (distinct from the normal unlimited-sentinel case), and its Tokens/Requests are also `unavailable`
  for the selected period
- **THEN** the Cost cell has `kind: ModelLimitMetricKind.Unavailable` and the row's overall `status` is
  `ModelLimitStatus.Unavailable` — this is the only path to `Unavailable`, since a well-formed cost
  entry is always classified `unlimited` per the requirement above

#### Scenario: One finite metric among unlimited metrics drives status
- **WHEN** a row's Cost is `unlimited`, Requests (Last 24 hours) is `unlimited`, and Tokens is
  `finite` with `usedPercent: 92`
- **THEN** the row's overall `status` is `RunningLow`, derived solely from the Tokens metric

---

### Requirement: Formatting and accessible labels

The adapter SHALL format cost values with the established localized USD currency formatter and
token/request values with localized grouped numeric formatting (no currency symbol). Every
`ModelLimitMetricCell.ariaLabel` SHALL contain the full, unambiguous localized value (used, and
total when finite), independent of any visual truncation or future compact-notation display.

#### Scenario: Cost cell never carries a currency symbol on tokens/requests
- **WHEN** a row's Tokens cell is formatted
- **THEN** its `usedLabel`/`totalLabel` contain no currency symbol

#### Scenario: Accessible label states the full value
- **WHEN** a Tokens cell has `usedLabel: '12,345'`, `totalLabel: '50,000'`
- **THEN** its `ariaLabel` is a localized sentence containing both full values (e.g. "12,345 of
  50,000 tokens used")

---

### Requirement: Library isolation for the adapter

The period state, the DTO-to-row adapter, and the `UsageTab` integration SHALL live under
`apps/chat/src/`, reusing the existing `useUsageData` hook and `useDeployments()` context without
modification. All DTO interpretation — the unlimited-sentinel check, status-threshold derivation,
currency/number formatting, and the deployment-metadata join — SHALL happen in the app-level adapter,
never in `libs/usage-dashboard`.

#### Scenario: Static analysis passes module boundary lint
- **WHEN** `npm exec nx lint chat` and `npm exec nx lint usage-dashboard` run after this change
- **THEN** `@nx/enforce-module-boundaries` reports no violations introduced by the new adapter,
  period state, or `ModelLimitsSection` integration

#### Scenario: No Core field names cross into the library's public API
- **WHEN** `libs/usage-dashboard`'s public types are inspected
- **THEN** no field name matches a `DeploymentLimitsResponseDto`/`LimitStatsDto` field name (e.g.
  `dayTokenStats`), and no type or comment references the `2 ** 53` sentinel
</content>
