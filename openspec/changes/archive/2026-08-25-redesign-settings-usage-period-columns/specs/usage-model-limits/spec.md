## MODIFIED Requirements

### Requirement: UsageTab renders Model limits below the aggregate cards

The `Usage` tab SHALL render `@epam/ai-dial-usage-dashboard`'s `ModelLimitsSection` below
`UsageLimitCardGroup`, sourced from `useUsageData()`'s already-fetched `usage.deployments` without
an additional API call. It SHALL unconditionally pass the adapter's rows, including zero rows, and
SHALL NOT branch on row count. The section SHALL be omitted while loading. After loading, a zero-row
result SHALL render `ModelLimitsSection`'s existing internal empty state while keeping its heading
and row count visible. The aggregate cards SHALL remain unchanged.

`UsageTab` SHALL NOT own a selected Model limits period and SHALL NOT pass period or period-change
props to `ModelLimitsSection`. It SHALL pass `Model tokens limits` as the localized section heading,
the adapter's normalized overall Cost header statuses/tooltips, and a dynamic row count supplied by
the section.

#### Scenario: Fixed comparison table renders below the cards
- **WHEN** Usage finishes loading and at least one deployment has usage in any displayed period
- **THEN** one `ModelLimitsSection` renders below `UsageLimitCardGroup`, with fixed Last 24 hours,
  Last 7 days, and Last 30 days data for every included row

#### Scenario: Empty comparison renders the section empty state
- **WHEN** Usage finishes loading and the adapter returns zero rows
- **THEN** `ModelLimitsSection` renders its heading, count `0`, and internal empty-state message,
  without a period selector or a separate app-level empty state

#### Scenario: Usage fetch failure preserves existing page behavior
- **WHEN** `useUsageData()` reports a `usageError`
- **THEN** the Model limits section receives no stale or zero-filled rows, aggregate-card failure
  behavior remains unchanged, and no notification is added beyond existing Usage error handling

---

### Requirement: Period-to-field mapping

The adapter SHALL always map all three displayed rolling periods from
`DeploymentLimitsResponseDto` as follows and SHALL NOT substitute another period or metric when a
field is missing:

| Period column | Cost field | Tokens field |
|---|---|---|
| Last 24 hours | `dayCostStats` | `dayTokenStats` |
| Last 7 days | `weekCostStats` | `weekTokenStats` |
| Last 30 days | `monthCostStats` | `monthTokenStats` |

Minute, hour, and request fields SHALL NOT be mapped into the table.

#### Scenario: One row carries all three period pairs
- **WHEN** a deployment contains usable day, week, and month Cost and Tokens stats
- **THEN** the row's `last24Hours`, `last7Days`, and `last30Days` period cells contain the matching
  Cost and Tokens stats from the table above

#### Scenario: Missing period stat is not substituted
- **WHEN** `weekTokenStats` is absent but `dayTokenStats` and `monthTokenStats` are present
- **THEN** Last 7 days Tokens is `Unavailable`, while Last 24 hours and Last 30 days use their own
  fields; neither is substituted into Last 7 days

#### Scenario: Requests and short windows are excluded
- **WHEN** minute/hour/request fields contain usage
- **THEN** they do not create a displayed cell, affect row inclusion, or affect row Status

---

### Requirement: `usage.deployments` join with model metadata

The adapter SHALL build candidates from exactly the entries in `usage.deployments`, in
`Object.keys(usage.deployments)` order, regardless of `useDeployments().items` content, order, or
loading state. `items` SHALL only enrich candidates with display name, version, and avatar and the
join SHALL be restricted to `type === DeploymentItemDtoTypeEnum.Model`. A deployment ID without a
matching model item SHALL use the ID as its name and no avatar URL. Candidates SHALL then be subject
to the all-period usage filter defined below.

#### Scenario: Row order remains API deployment order
- **WHEN** items and `usage.deployments` provide the same models in different orders
- **THEN** included rows follow `Object.keys(usage.deployments)` order

#### Scenario: Unresolved deployment remains eligible
- **WHEN** a deployment ID has qualifying day/week/month usage but no matching model item
- **THEN** it renders using its ID and initials-avatar fallback without dropping other rows

#### Scenario: Non-model item is not used for enrichment
- **WHEN** an application or toolset item has the same ID as a usage deployment
- **THEN** its metadata is not applied to the model row

---

### Requirement: Rows with no usage across displayed periods are excluded

For each candidate, the adapter SHALL inspect the raw Cost and Tokens stats backing Last 24 hours,
Last 7 days, and Last 30 days. It SHALL return the row only if at least one inspected stat is usable
(`Number.isFinite(total)` and `Number.isFinite(used)`) and has `used > 0`. A candidate whose twelve
relevant numeric values represent only missing, malformed, zero, or negative usage SHALL be
excluded. Filtering SHALL use the already-fetched `usage` value and SHALL NOT alter the normalized
content of an included cell.

#### Scenario: Usage in only one window retains the row
- **WHEN** a deployment has non-zero `monthTokenStats.used` and all other displayed Cost/Tokens
  `used` values are zero or unavailable
- **THEN** the row is included and the unavailable/zero cells retain their normal classification

#### Scenario: Cost-only usage retains the row
- **WHEN** at least one displayed cost stat has `used > 0` while all displayed token stats are
  missing or zero
- **THEN** the row is included and its Status still considers the matching top-level overall Cost
  limits independently of its attributed Cost values

#### Scenario: No displayed usage removes the row
- **WHEN** every displayed Cost/Tokens stat is absent, malformed, or has `used <= 0`
- **THEN** the candidate is excluded even if minute, hour, or request usage is non-zero

---

### Requirement: Per-metric finite/unlimited/unavailable detection

For every displayed period, the adapter SHALL produce a normalized Cost cell and Tokens cell. A
well-formed Cost entry SHALL be `Unlimited` with formatted attributed spend; the renderer SHALL use
only that spend value without limit text or a progress bar. Missing or non-finite Cost data SHALL be
`Unavailable`. A Tokens entry SHALL be `Finite` when its
`total` and `used` are finite and `total < 2 ** 53`, `Unlimited` when well-formed and
`total >= 2 ** 53`, and `Unavailable` when absent or non-finite. Missing data SHALL NOT be treated as
zero or unlimited. Finite token `usedPercent` SHALL retain values above 100; only rendering may
clamp the progress fill. An unlimited Tokens entry SHALL receive `Follows cost limit` when the
matching top-level overall Cost stat is finite; it SHALL receive `No limit` only when that overall
Cost stat is also unlimited.

#### Scenario: Finite tokens produce progress data for their period
- **WHEN** `weekTokenStats` is `{ total: 10000, used: 4000 }`
- **THEN** Last 7 days Tokens is `Finite` with `usedPercent: 40` and its own derived metric status

#### Scenario: Well-formed period cost remains attributed spend without a cap
- **WHEN** `dayCostStats` is well-formed with `used: 4.2`
- **THEN** Last 24 hours Cost is `Unlimited`, displays formatted `4.2` spend, and has no progress bar

#### Scenario: Missing token stat stays unavailable
- **WHEN** `monthTokenStats` is missing
- **THEN** Last 30 days Tokens is `Unavailable`, not zero and not copied from another period

#### Scenario: Over-limit percentage remains uncapped in normalized data
- **WHEN** `dayTokenStats` is `{ total: 1000, used: 1500 }`
- **THEN** Last 24 hours Tokens has `usedPercent: 150` and a `LimitReached` metric status

---

### Requirement: Per-metric, overall Cost, and row status model

For each finite token cell and each matching top-level overall Cost stat, the adapter SHALL derive
status from `usedPercent`: `>= 100` is `LimitReached`, `>= 75` and `< 100` is `RunningLow`, and `< 75`
is `WithinLimits`. Overall row Status SHALL be the most severe finite status across all three model
token cells and all three overall Cost limits, ordered `LimitReached` > `RunningLow` >
`WithinLimits`. Per-deployment attributed Cost SHALL NOT be treated as a cap. If there is no finite
status but at least one token or overall Cost limit is `Unlimited`, overall Status SHALL be
`NoLimit`; otherwise it SHALL be `Unavailable`.

#### Scenario: Short-window breach determines overall Status
- **WHEN** Last 24 hours Tokens is `LimitReached`, Last 7 days is `RunningLow`, and Last 30 days is
  `WithinLimits`
- **THEN** overall row Status is `LimitReached`

#### Scenario: Warning in any window is not hidden by healthy windows
- **WHEN** one finite token period is `RunningLow` and the other finite periods are `WithinLimits`
- **THEN** overall row Status is `RunningLow`

#### Scenario: Overall Cost breach applies to every model
- **WHEN** a model's token limits are within limits but the top-level Last 24 hours Cost limit is
  reached
- **THEN** that model row's overall Status is `LimitReached`

#### Scenario: Unlimited fallback applies only without finite limits
- **WHEN** no displayed token or overall Cost limit is finite and at least one is `Unlimited`
- **THEN** overall row Status is `NoLimit`

---

### Requirement: Overall Cost period header indicators

The adapter SHALL normalize the top-level `dayCostStats`, `weekCostStats`, and `monthCostStats` used
by the aggregate cards into Last 24 hours, Last 7 days, and Last 30 days header statuses. It SHALL
provide an error icon tooltip for `LimitReached`, a warning icon tooltip for `RunningLow`, and no
icon for `WithinLimits`, `NoLimit`, or `Unavailable`. Tooltip text SHALL name its own period. A
reached tooltip SHALL state that models cannot be used until the overall Cost limit resets,
regardless of remaining token limits.

#### Scenario: Header indicator uses the same overall Cost budget as its card
- **WHEN** top-level `weekCostStats` is finite and 80% used
- **THEN** Last 7 days receives a `RunningLow` header indicator and period-aware tooltip, while row
  statuses consider that same warning

---

### Requirement: Formatting and accessible labels

The adapter SHALL format displayed cost with the established localized currency formatter plus the
localized `spent` caption and token used/total values with localized compact numeric formatting.
Every token metric's `ariaLabel` SHALL
contain full grouped, non-compact used and total values when finite, and full unambiguous text for
unlimited/unavailable states. Period cells SHALL use localized Last 24 hours, Last 7 days, and Last
30 days labels visibly; localized Tokens and Cost labels supplied by `UsageTab` SHALL provide
non-visual accessible context for the metric values.

The integration SHALL reuse `UsageI18nKeys.TodayPeriodDescription`,
`ThisWeekPeriodDescription`, `ThisMonthPeriodDescription`, `TokensColumnLabel`, and
`CostColumnLabel`, and SHALL add localized keys for `Model tokens limits`, `spent`, `Follows cost
limit`, its accessible value description, and both overall Cost status tooltip templates. Selector,
minute/hour, and Requests keys SHALL only be removed if unused elsewhere.

#### Scenario: Visible token numbers are compact and currency-free
- **WHEN** Last 24 hours Tokens has `used: 1600000` and `total: 2000000`
- **THEN** visible labels use compact token notation such as `1.6M / 2M` without currency symbols

#### Scenario: Accessible token value remains full
- **WHEN** a finite token cell visibly renders `1K / 2K`
- **THEN** its accessible text contains the full grouped 1,000 and 2,000 values plus the period's
  Tokens context

#### Scenario: Cost is associated with the same period
- **WHEN** assistive technology reads a Last 7 days period cell
- **THEN** both its Tokens metric and formatted Cost value are programmatically associated with the
  Last 7 days column

---

### Requirement: Library isolation for the adapter

The fixed period mapping, DTO-to-row adapter, and `UsageTab` integration SHALL live under
`apps/chat/src/`, reusing `useUsageData` and `useDeployments()` without modification. All DTO field
selection, unlimited-sentinel checks, status thresholds, currency/number formatting, locale/icon
resolution, and deployment joins SHALL happen in the app adapter. `libs/usage-dashboard` SHALL
receive only normalized rows and localized labels and SHALL NOT import app code, generated clients,
API DTOs, contexts, feature flags, or other host/external integration details.

#### Scenario: Library public API stays normalized
- **WHEN** `libs/usage-dashboard` public types are inspected
- **THEN** they expose period-shaped presentation props but no DTO field such as `dayTokenStats`, API
  path/client type, unlimited sentinel, locale resolver, or status threshold

#### Scenario: Existing feature ownership remains unchanged
- **WHEN** the comparison table renders
- **THEN** `useUsageData` and `useDeployments` remain the only existing owners of fetched Usage and
  deployment state; no new context or hook is introduced

## REMOVED Requirements

### Requirement: App-owned period state, re-derived without refetching

**Reason**: All three supported periods render simultaneously, so there is no selected period to
store or change.

**Migration**: Remove `ModelLimitsPeriod` state and the mapper's `period` argument. Derive fixed day,
week, and month cells once from the already-fetched usage response.

## RENAMED Requirements

- FROM: `Rows with no usage in the selected period are excluded`
- TO: `Rows with no usage across displayed periods are excluded`
