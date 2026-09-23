# usage-model-limits Specification

## Purpose

Defines the integration that adds a per-model "Model limits" table to the `Usage` tab: the
DTO-to-row adapter that turns `useUsageData()`'s already-fetched `usage.deployments` into
`@epam/ai-dial-usage-dashboard`'s `ModelLimitsSection` rows for the fixed calendar-period
comparison — the current UTC day, week, and month — without any additional API call. The adapter
owns all DTO
interpretation (period-to-field mapping, finite/unlimited/unavailable detection, status derivation,
formatting, and the join against `useDeployments().items`); the library only renders the rows it is
given.

The adapter functions (`mapUserUsageToModelLimits`, `mapOverallCostLimitsToPeriodStatuses`) live in
`libs/chat-hooks/src/usage/map-user-usage-to-model-limits.ts`, under the narrow, explicitly justified
`chat-hooks` DIAL-Core-response-adapter exception recorded in AGENTS.md §Library isolation. They
accept host-owned callbacks (`resolveIconUrl`, `resolveDisplayName`) to keep URL construction and
locale resolution local to the host. See the `usage-dashboard-lib` capability spec for the library's
rendering-only contract.

## Requirements

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
- **THEN** one `ModelLimitsSection` renders below `UsageLimitCardGroup`, with fixed day, week, and
  month data for every included row

#### Scenario: Empty comparison renders the section empty state
- **WHEN** Usage finishes loading and the adapter returns zero rows
- **THEN** `ModelLimitsSection` renders its heading, count `0`, and internal empty-state message,
  without a period selector or a separate app-level empty state

#### Scenario: Usage fetch failure preserves existing page behavior
- **WHEN** `useUsageData()` reports a `usageError`
- **THEN** the Model limits section receives no stale or zero-filled rows, aggregate-card failure
  behavior remains unchanged, and no notification is added beyond existing Usage error handling

### Requirement: Period-to-field mapping

The adapter SHALL always map all three displayed **calendar** periods from
`DeploymentLimitsResponseDto` as follows and SHALL NOT substitute another period or metric when a
field is missing:

| Period column | Cost field | Tokens field |
|---|---|---|
| day (current UTC day) | `dayCostStats` | `dayTokenStats` |
| week (current UTC week) | `weekCostStats` | `weekTokenStats` |
| month (current UTC month) | `monthCostStats` | `monthTokenStats` |

The period cells SHALL be keyed `day`, `week`, and `month` on `ModelLimitRow`, matching the renamed
`@epam/ai-dial-usage-dashboard` public API. The adapter SHALL NOT describe or label these periods as
trailing or rolling windows of 24 hours, 7 days, or 30 days.

Minute, hour, and request fields SHALL NOT be mapped into the table.

#### Scenario: One row carries all three period pairs
- **WHEN** a deployment contains usable day, week, and month Cost and Tokens stats
- **THEN** the row's `day`, `week`, and `month` period cells contain the matching Cost and Tokens
  stats from the table above

#### Scenario: Missing period stat is not substituted
- **WHEN** `weekTokenStats` is absent but `dayTokenStats` and `monthTokenStats` are present
- **THEN** the week Tokens cell is `Unavailable`, while the day and month cells use their own
  fields; neither is substituted into week

#### Scenario: Requests and short windows are excluded
- **WHEN** minute/hour/request fields contain usage
- **THEN** they do not create a displayed cell, affect row inclusion, or affect row Status

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

### Requirement: Rows with no usage across displayed periods are excluded

For each candidate, the adapter SHALL inspect the raw Cost and Tokens stats backing the day, week,
and month periods. It SHALL return the row only if at least one inspected stat is usable
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

### Requirement: Per-metric finite/unlimited/unavailable detection

For every displayed period, the adapter SHALL produce a normalized Cost cell and Tokens cell using
the **same** sentinel test for both metrics. A Cost or Tokens entry SHALL be `Finite` when its
`total` and `used` are finite and `total < 2 ** 53`, `Unlimited` when well-formed and
`total >= 2 ** 53`, and `Unavailable` when absent or non-finite. Missing data SHALL NOT be treated as
zero or unlimited.

An `Unlimited` Cost cell SHALL render formatted attributed spend with no limit text and no progress
bar, exactly as today. A `Finite` Cost cell SHALL produce progress data and a derived metric status,
which `getRowStatus` SHALL fold in alongside finite Tokens statuses. The adapter SHALL NOT hard-code
the assumption that a per-deployment Cost `total` is always the unlimited sentinel.

DIAL Core's role model configures cost limits only at the role level (`Role.costLimit`); per-
deployment `Role.limits` entries carry token and request windows with no cost field. Every payload
observed to date therefore reports the sentinel for per-deployment Cost, so this detection is
behaviour-preserving in practice — it removes an assumption rather than acting on a new one.

Finite `usedPercent` SHALL retain values above 100 for both metrics; only rendering may clamp the
progress fill. An unlimited Tokens entry SHALL receive `Follows cost limit` when the matching
top-level overall Cost stat is finite; it SHALL receive `No limit` only when that overall Cost stat
is also unlimited.

#### Scenario: Finite tokens produce progress data for their period
- **WHEN** `weekTokenStats` is `{ total: 10000, used: 4000 }`
- **THEN** the week Tokens cell is `Finite` with `usedPercent: 40` and its own derived metric status

#### Scenario: Sentinel period cost remains attributed spend without a cap
- **WHEN** `dayCostStats` is `{ total: 9223372036854775807, used: 4.2 }`
- **THEN** the day Cost cell is `Unlimited`, displays formatted `4.2` spend, and has no progress bar

#### Scenario: Finite period cost produces a capped cell
- **WHEN** `dayCostStats` is `{ total: 10, used: 8 }`
- **THEN** the day Cost cell is `Finite` with `usedPercent: 80`, a `RunningLow` metric status, and
  that status contributes to the row's overall Status

#### Scenario: Missing token stat stays unavailable
- **WHEN** `monthTokenStats` is missing
- **THEN** the month Tokens cell is `Unavailable`, not zero and not copied from another period

#### Scenario: Missing cost stat stays unavailable
- **WHEN** `weekCostStats` is missing
- **THEN** the week Cost cell is `Unavailable`, not zero and not unlimited

#### Scenario: Over-limit percentage remains uncapped in normalized data
- **WHEN** `dayTokenStats` is `{ total: 1000, used: 1500 }`
- **THEN** the day Tokens cell has `usedPercent: 150` and a `LimitReached` metric status

### Requirement: Per-metric, overall Cost, and row status model

For each finite token cell and each matching top-level overall Cost stat, the adapter SHALL derive
status from `usedPercent`: `>= 100` is `LimitReached`, `>= 75` and `< 100` is `RunningLow`, and `< 75`
is `WithinLimits`. Overall row Status SHALL be the most severe finite status across all three model
token cells and all three overall Cost limits, ordered `LimitReached` > `RunningLow` >
`WithinLimits`. Per-deployment attributed Cost SHALL NOT be treated as a cap. If there is no finite
status but at least one token or overall Cost limit is `Unlimited`, overall Status SHALL be
`NoLimit`; otherwise it SHALL be `Unavailable`.

#### Scenario: Short-window breach determines overall Status
- **WHEN** day Tokens is `LimitReached`, week is `RunningLow`, and month is
  `WithinLimits`
- **THEN** overall row Status is `LimitReached`

#### Scenario: Warning in any window is not hidden by healthy windows
- **WHEN** one finite token period is `RunningLow` and the other finite periods are `WithinLimits`
- **THEN** overall row Status is `RunningLow`

#### Scenario: Overall Cost breach applies to every model
- **WHEN** a model's token limits are within limits but the top-level day Cost limit is
  reached
- **THEN** that model row's overall Status is `LimitReached`

#### Scenario: Unlimited fallback applies only without finite limits
- **WHEN** no displayed token or overall Cost limit is finite and at least one is `Unlimited`
- **THEN** overall row Status is `NoLimit`

### Requirement: Aggregate period cost cards

The `mapUsageDataToDashboard` adapter (in `libs/chat-hooks/src/usage/map-usage-data-to-dashboard.ts`, exported from `@epam/ai-dial-chat-hooks`'s `./usage` entry point) SHALL map the top-level
`dayCostStats`, `weekCostStats`, and `monthCostStats` fields from `UserLimitStatsResponseDto` into
`UsageLimitCardData[]` for `UsageLimitCardGroup`. A period whose stats are absent or non-finite
SHALL be omitted from the array entirely. Card `title` and `periodDescription` SHALL use calendar
wording (`Today`, `This week`, `This month`) and SHALL NOT use trailing-window wording
(`Last 24 hours`, `Last 7 days`, `Last 30 days`).

The adapter SHALL accept a host-supplied `formatResetTime: (resetsAt: string | undefined) => ResetTimeDisplay | undefined`
callback and SHALL populate each card's `resetLabel`, `resetIsoValue`, and `resetAriaLabel` from its
result. When the callback returns `undefined` — because `resetsAt` was absent, unparseable, or
`Intl` was unavailable — the card SHALL carry no reset fields and SHALL otherwise be identical to
its pre-change output. The adapter SHALL NOT parse or format a timestamp itself.

When a period's `total >= 2 ** 53` (the unlimited sentinel — Long.MAX_VALUE from the backend,
meaning no cost limit is configured for that period), the adapter SHALL produce a card with
`isUnlimited: true`. The library then renders only `usedLabel` (the spend so far), the
`Default` status badge, and the reset line when one is present — no progress bar, no used-of-total
caption, no remaining caption, and no used-percent label. This is the expected behavior when an
administrator has not configured a cost limit for the period; the absence of limit information is
intentional and SHALL NOT be treated as a display error.

Status derivation SHALL keep the 75%/100% thresholds against an **unclamped** `usedPercent`, SHALL
treat a finite `total` of zero as 100% used, and SHALL floor `used` at zero. Localized strings SHALL
come from a caller-supplied translate callback keyed on the adapter's own `USAGE_DATA_I18N_KEYS`
const (`libs/chat-hooks/src/usage/map-usage-data-to-dashboard.ts`), a portable key-path object
reusing the exact same 8 path strings `apps/chat/src/constants/translation-keys.ts`'s
`UsageI18nKeys` declares; the adapter SHALL NOT import `react-i18next` or the app's own enum, so it
stays a pure function behind `UsageTab`'s `useMemo`.

#### Scenario: Unconfigured weekly limit shows spend only

- **WHEN** `weekCostStats.total >= 2 ** 53` (no weekly cost limit configured)
- **THEN** the week aggregate card renders only the used spend label and the
  `Default` (`Within limits`) badge — no progress bar, no `used of $total`, no remaining
  amount, and no percentage

#### Scenario: Configured daily limit shows full card

- **WHEN** `dayCostStats.total < 2 ** 53` (a finite daily cost limit is set)
- **THEN** the day aggregate card renders `usedLabel`, `used of $totalLabel`, a
  progress bar, `remainingLabel`, and the used-percent label alongside the status badge

#### Scenario: Period with absent stats is omitted

- **WHEN** a period's stats field is absent or its `total`/`used` are non-finite
- **THEN** no card is produced for that period and the remaining periods are unaffected

#### Scenario: Reset time flows through to the card

- **WHEN** `monthCostStats` carries `resetsAt: "2026-10-01T00:00:00Z"` and `formatResetTime`
  returns a display value for it
- **THEN** the month card carries `resetLabel`, `resetIsoValue: "2026-10-01T00:00:00Z"`, and
  `resetAriaLabel`

#### Scenario: Unformattable reset time yields a card with no reset fields

- **WHEN** `formatResetTime` returns `undefined` for a period's `resetsAt`
- **THEN** that card carries no `resetLabel`/`resetIsoValue`/`resetAriaLabel` and its other fields
  are unchanged

#### Scenario: Over-limit usage is not clamped

- **WHEN** `dayCostStats` has `used` greater than a finite `total`
- **THEN** `usedPercent` exceeds 100, the status is `LimitReached`, and the value is passed to the
  library unclamped exactly as before the adapter moved

### Requirement: Overall Cost period header indicators

`mapOverallCostLimitsToPeriodStatuses` SHALL normalize the top-level stats into period headers.
The adapter (in `libs/chat-hooks/src/usage/map-user-usage-to-model-limits.ts`, alongside the row adapter
it shares period-status derivation with) SHALL normalize the top-level `dayCostStats`,
`weekCostStats`, and
`monthCostStats` into a `ModelLimitPeriodStatuses` value keyed `day`, `week`, and `month`. Each
entry SHALL carry the status and tooltip derived exactly as today, plus the preformatted reset trio
produced by the same host-supplied `formatResetTime` callback used for the aggregate cards, read
from the same top-level stat that drives the entry's status.

The adapter SHALL NOT read a per-deployment `resetsAt` for a period header, and SHALL NOT reconcile
a top-level `resetsAt` against a differing per-deployment one. When the `formatResetTime` argument
is omitted, the adapter SHALL produce statuses with no reset fields.

#### Scenario: Header indicator uses the same overall Cost budget as its card

- **WHEN** the top-level `dayCostStats` is finite and at or above the running-low threshold
- **THEN** the day period header shows the running-low indicator with its tooltip, matching the day
  aggregate card's status

#### Scenario: Header reset time matches its card

- **WHEN** the top-level `weekCostStats` carries a `resetsAt`
- **THEN** the week period header's `resetLabel` is the same formatted value the week aggregate card
  carries

#### Scenario: Divergent per-deployment reset time is ignored for the header

- **WHEN** a deployment's `dayCostStats.resetsAt` differs from the top-level `dayCostStats.resetsAt`
- **THEN** the day period header shows the top-level value and neither value is adjusted

#### Scenario: Absent usage produces unavailable statuses

- **WHEN** `usage` is `undefined`
- **THEN** all three period statuses are `ModelLimitStatus.Unavailable` with no tooltip and no reset
  fields

### Requirement: Formatting and accessible labels

The adapter SHALL format displayed cost with the established localized currency formatter plus the
localized `spent` caption and token used/total values with localized compact numeric formatting.
Every token metric's `ariaLabel` SHALL
contain full grouped, non-compact used and total values when finite, and full unambiguous text for
unlimited/unavailable states. Period cells SHALL use localized Today, This week, and This month
labels visibly; localized Tokens and Cost labels supplied by `UsageTab` SHALL provide
non-visual accessible context for the metric values.

The adapter's own `USAGE_MODEL_LIMITS_I18N_KEYS` const SHALL reuse the same path strings as
`UsageI18nKeys.TodayPeriodDescription`, `ThisWeekPeriodDescription`, `ThisMonthPeriodDescription`,
plus dedicated key paths for `Model tokens limits`, `spent`, `Follows cost limit`, its accessible
value description, and both overall Cost status tooltip templates. `UsageTab` continues to supply
`TokensColumnLabel` and `CostColumnLabel` from its own `UsageI18nKeys` directly as label props —
those two are not part of the adapter's own const, since they are column labels the tab already
owns. Selector, minute/hour, and Requests keys SHALL only be removed if unused elsewhere.

#### Scenario: Visible token numbers are compact and currency-free
- **WHEN** day Tokens has `used: 1600000` and `total: 2000000`
- **THEN** visible labels use compact token notation such as `1.6M / 2M` without currency symbols

#### Scenario: Accessible token value remains full
- **WHEN** a finite token cell visibly renders `1K / 2K`
- **THEN** its accessible text contains the full grouped 1,000 and 2,000 values plus the period's
  Tokens context

#### Scenario: Cost is associated with the same period
- **WHEN** assistive technology reads a week period cell
- **THEN** both its Tokens metric and formatted Cost value are programmatically associated with the
  week column

### Requirement: Library isolation for the adapter

The adapters SHALL own DTO field selection, unlimited-sentinel checks, status thresholds,
shared currency/number formatting, and deployment joins. Host-specific locale/icon resolution,
translated strings, and reset-time formatting SHALL be supplied through callbacks or parameters.
The response adaptation SHALL happen in
`map-usage-data-to-dashboard.ts` and `map-user-usage-to-model-limits.ts` under
`libs/chat-hooks/src/usage/` — the narrow, explicitly justified location recorded in AGENTS.md
§Library isolation's DIAL-Core-response-adapter exception — and SHALL NOT happen in
`libs/usage-dashboard` or any other hand-authored library outside that recorded exception.
`libs/usage-dashboard` SHALL NOT import `@epam/ai-dial-chat-api-client`, app code, app contexts,
feature flags, routing, storage, or analytics, and SHALL receive only normalized
rows/cards/period statuses and localized labels through props (see the `usage-dashboard-lib`
capability).

This coupling's presence in `libs/chat-hooks` SHALL NOT be read as license to move an
uncharacterized, product-specific, or per-host-varying DTO transformation into that library, or into
`libs/chat-shared`. Each such future case needs its own equivalent justification recorded in that
change's design doc, per AGENTS.md's exception text. Isolation SHALL NOT be satisfied by copying
generated DTO interfaces into `libs/usage-dashboard`, by replacing the runtime
`DeploymentItemDtoTypeEnum` there with equivalent hardcoded backend strings, or by using type-only
imports there while still interpreting BFF field names or the unlimited sentinel.

The adapters SHALL keep accepting host-owned callbacks (`resolveIconUrl`, `resolveDisplayName`,
`formatResetTime`) and a caller-supplied translate function, so they remain pure functions that
`UsageTab` can memoize; they SHALL NOT import `react-i18next`, an app context, or a UI-kit rendering
component. `libs/usage-dashboard` SHALL NOT import these adapters, and no dependency cycle SHALL be
introduced between `libs/chat-hooks` and `libs/usage-dashboard`.

`UsageTab` wires the adapters imported from `@epam/ai-dial-chat-hooks` with
`useUsageData(getUserUsage, ...)` (also from `@epam/ai-dial-chat-hooks`) and `useDeployments()` from
the app context, and imports `UsageLimitCardGroup` and `ModelLimitsSection` from
`@epam/ai-dial-usage-dashboard`. No new context or hook is introduced, no fetching is added or
removed, and existing `useMemo`/`useCallback` dependency arrays and subscription lifetimes are
preserved.

#### Scenario: Library public API stays normalized
- **WHEN** `libs/usage-dashboard` public types are inspected
- **THEN** they expose period-shaped presentation props but no raw DTO field such as `dayTokenStats`,
  API path/client type, unlimited sentinel, or status threshold in the component props

#### Scenario: Library carries no generated-client edge
- **WHEN** `libs/usage-dashboard`'s source, barrel, `package.json`, `tsconfig.lib.json`, and
  `vite.config.mts` are inspected
- **THEN** none of them names `@epam/ai-dial-chat-api-client`

#### Scenario: The coupling stays inside its recorded exception
- **WHEN** `libs/chat-shared` is inspected
- **THEN** it has gained no usage-dashboard DTO mapper, no copied generated DTO interface, and no
  hardcoded substitute for `DeploymentItemDtoTypeEnum`

#### Scenario: Existing feature ownership remains unchanged
- **WHEN** the comparison table renders
- **THEN** `useUsageData` and `useDeployments` remain the only owners of fetched Usage and deployment
  state; no new context or hook is introduced

#### Scenario: No import cycle between the library and the adapter's host library
- **WHEN** the project graph is inspected
- **THEN** `libs/usage-dashboard` depends on neither `libs/chat-hooks` nor `apps/chat`, and
  `libs/chat-hooks` consumes its normalized display types and runtime display enums through an
  optional peer dependency; hosts loading the root or `./usage` entry point SHALL install that
  peer. This one-way runtime dependency SHALL NOT introduce a reverse import from the
  presentational library into the adapters.
