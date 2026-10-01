# chat-hooks-deployment-limits-mapping Specification

## Purpose

A pure, labels-injected utility in `@epam/ai-dial-chat-hooks` that maps a `DeploymentLimitsResponseDto` to a `CatalogItemLimits` display model, with no i18n dependency — all user-visible strings and formatter callbacks are supplied by the caller.

## Requirements

### Requirement: `mapDeploymentLimitsDtoToCatalogLimits` is a pure, labels-injected mapping utility owned by `chat-hooks`
`@epam/ai-dial-chat-hooks` SHALL export `mapDeploymentLimitsDtoToCatalogLimits(dto:
DeploymentLimitsResponseDto | undefined, labels: DeploymentLimitsLabels): CatalogItemLimits |
undefined`, where `DeploymentLimitsLabels` carries:

- five strings — `tokenGroup` (the single group's heading), `tokensPerDay`, `tokensPerWeek`,
  `tokensPerMonth` (labels for the current UTC calendar day, week, and month rows, e.g. "Today",
  "This week", "This month"), and `followsCostLimit` (the note on an unlimited row);
- three formatter callbacks — `formatValueLabel: (used: string, total: string) => string`,
  `formatProgressAriaLabel: (params: { label: string; used: string; total: string }) => string`, and
  `formatFollowsCostLimitAriaLabel: (params: { label: string; used: string }) => string`;
- an optional `formatResetTime?: FormatResetTime` (the structural type declared in
  `libs/chat-hooks/src/usage/`), which turns a raw `resetsAt` into the preformatted reset trio or
  `undefined`.

`DeploymentLimitsLabels` SHALL NOT carry a spend-caption formatter. The function SHALL NOT import
`react-i18next`, `i18next`'s `TFunction`, any app translation-key enum (such as `CatalogI18nKeys`),
or any date/time `Intl` API — reset formatting arrives only through `labels.formatResetTime`.

#### Scenario: Architecture guard — no i18n or translation-key import
- **WHEN** `libs/chat-hooks` is linted and type-checked
- **THEN** the deployment-limits-mapping module's source file contains no `i18next`/`react-i18next`
  import, no import of an app translation-key enum, and no `Date`/`Intl.DateTimeFormat` use

#### Scenario: A spend-caption formatter is not part of the contract
- **WHEN** a host builds a `DeploymentLimitsLabels` object with a `formatSpentCaption` field
- **THEN** type-checking fails, because the field no longer exists

### Requirement: Only stats with a usable, positive total produce a row
The function SHALL, for each of the three token stat keys on `dto` (`dayTokenStats`, `weekTokenStats`, `monthTokenStats`), include a row in the result only when that stat's `total` and
`used` are both finite numbers and `total` is greater than `0`; stats that are absent, non-finite, or
have a non-positive total SHALL be omitted with no row emitted. `minuteTokenStats`, the request
stats, and every cost stat SHALL never produce a row.

#### Scenario: Absent stats are skipped
- **WHEN** `dto` omits `weekTokenStats`
- **THEN** the result contains no row for the week

#### Scenario: A stat with a zero or negative total is skipped
- **WHEN** a token stat's `total` is `0` or negative
- **THEN** no row is emitted for that stat, even if `used` is a valid number

#### Scenario: Rolling-window and request stats are ignored
- **WHEN** `dto` carries `minuteTokenStats`, `hourRequestStats`, and `dayRequestStats` with usable
  totals
- **THEN** none of them produces a row

### Requirement: Rows preserve the fixed display order and per-stat label
The function SHALL emit all rows in one group labelled `labels.tokenGroup`, in the fixed order day,
week, month — skipping any stat that does not qualify per the requirement above, without shifting
the relative order of the remaining rows. The rows SHALL represent the current UTC calendar day,
week, and month that DIAL Core reports (see `usage-period-reset-times`), not trailing windows. Each
row's `label` SHALL come from `labels.tokensPerDay`, `labels.tokensPerWeek`, or
`labels.tokensPerMonth` respectively.

#### Scenario: Display order is stable when some stats are missing
- **GIVEN** `dto` has only `monthTokenStats` and `dayTokenStats` set
- **WHEN** the function is called
- **THEN** the result's single group lists the day row before the month row, with no gap-filling
  placeholder row for the week

### Requirement: An unlimited total replaces the used/total pair with an unlimited indicator
The function SHALL, when a token stat's `total` is at or above `Number.MAX_SAFE_INTEGER` (DIAL Core's `Long.MAX_VALUE` sentinel), set the row's `isUnlimited` to `true` and `noteLabel` to
`labels.followsCostLimit`, and SHALL NOT set `usedLabel`/`totalLabel`; the row's `valueLabel` SHALL
be the compact-formatted `used`, and its `ariaLabel` SHALL be
`labels.formatFollowsCostLimitAriaLabel({ label, used })` with `used` formatted in full.

#### Scenario: An unlimited stat shows its consumption and the follows-cost-limit note
- **WHEN** `dayTokenStats` is `{ used: 210000, total: 9223372036854776000 }`
- **THEN** the row has `isUnlimited: true`, `noteLabel` equal to `labels.followsCostLimit`, no
  `usedLabel`/`totalLabel`, and a `valueLabel` of the compact-formatted `210000`

### Requirement: `valueLabel` and `ariaLabel` are built through the injected formatter callbacks
For a capped row, the function SHALL compact-format `used` (truncated toward zero, so a figure is
never rounded up past what was consumed) and `total` into `usedLabel`/`totalLabel`, SHALL set
`valueLabel` to `labels.formatValueLabel(usedLabel, totalLabel)`, and SHALL set `ariaLabel` to
`labels.formatProgressAriaLabel({ label, used, total })` with `used`/`total` formatted in full. The
function SHALL NOT construct either string through its own template literal.

#### Scenario: Formatter callbacks receive the formatted used/total strings
- **WHEN** a row's `used`/`total` are `2500`/`10000`
- **THEN** `labels.formatValueLabel` is called with the compact forms of `2500` and `10000`, its
  return value becomes the row's `valueLabel`, and `labels.formatProgressAriaLabel` receives the
  full forms

### Requirement: Absent or entirely-unqualified input produces `undefined`, never an empty-rows object
When `dto` is `undefined`, or when every token stat is absent/unqualified, the function SHALL return
`undefined` rather than an object whose group has no rows.

#### Scenario: `undefined` dto returns `undefined`
- **WHEN** `dto` is `undefined`
- **THEN** the function returns `undefined`

#### Scenario: A dto with no qualifying stats returns `undefined`
- **WHEN** every token stat on `dto` is absent or fails the usability check, even if cost stats are
  present
- **THEN** the function returns `undefined`

### Requirement: Cost stats are never read
The function SHALL NOT read `dto.minuteCostStats`, `dto.dayCostStats`, `dto.weekCostStats`, or
`dto.monthCostStats`, and SHALL NOT set `captionLabel` on any row. DIAL Core's deployment-limits
cost stats are the caller's account-wide budget (`total`) and account-wide spend (`used`) across
every deployment — not the queried deployment's own spend, which only `GET /v1/user/usage` →
`deployments[id]` reports — so rendering them on a model's row would misattribute other
deployments' spend to it.

#### Scenario: Account-wide spend is not shown as the model's
- **WHEN** `dto` carries `dayTokenStats: { used: 2500, total: 10000 }`,
  `dayCostStats: { used: 0.5, total: 10 }`, and `weekCostStats: { used: 0.56, total: 200 }`
- **THEN** the result has one group with one row, that row has no `captionLabel`, and no row
  represents a cost stat

### Requirement: Each row carries its period's reset line when the host can format it
For every emitted row the function SHALL call `labels.formatResetTime` (when supplied) with that
stat's raw `resetsAt` and, on a defined result, set the row's `resetLabel`, `resetIsoValue`, and
`resetAriaLabel` from it — on capped and unlimited rows alike. When `labels.formatResetTime` is
omitted or returns `undefined`, the row SHALL carry none of the three fields (absent, not
present-and-undefined) and SHALL be otherwise unchanged. The raw `resetsAt` SHALL appear nowhere in
the row.

#### Scenario: Reset strings are passed straight through
- **WHEN** `dayTokenStats.resetsAt` is `"2026-10-02T00:00:00Z"` and `formatResetTime` returns a
  display object for it
- **THEN** the day row carries that object's `label`, `isoValue`, and `ariaLabel` as `resetLabel`,
  `resetIsoValue`, and `resetAriaLabel`

#### Scenario: An unlimited row still carries its reset line
- **WHEN** `weekTokenStats` is `{ used: 3222, total: 9223372036854776000, resetsAt:
  "2026-10-05T00:00:00Z" }` and `formatResetTime` formats it
- **THEN** the week row has `isUnlimited: true` and the reset trio

#### Scenario: Reset formatting is declined
- **WHEN** `formatResetTime` is omitted, or returns `undefined` for a stat
- **THEN** that row has no `resetLabel`, `resetIsoValue`, or `resetAriaLabel` property

### Requirement: The overall status reflects capped token rows only
The result's `status` SHALL be `CatalogLimitStatus.LimitReached` when any capped emitted row's
`used/total` ratio is at or above `1`, otherwise `CatalogLimitStatus.RunningLow` when any is at or
above `0.75`, otherwise absent. Unlimited rows SHALL contribute no ratio, and cost stats SHALL not
contribute (per "Cost stats are never read").

#### Scenario: A nearly exhausted day limit drives the status
- **WHEN** `dayTokenStats` is `{ used: 1900000, total: 2000000 }`
- **THEN** `status` is `CatalogLimitStatus.RunningLow`

#### Scenario: An exhausted account budget does not mark the model
- **WHEN** every token row is below 75% of its cap and `dayCostStats` is `{ used: 100, total: 100 }`
- **THEN** `status` is absent

### Requirement: `useCatalogItems` builds the labels object and owns the app-level call site
`apps/chat/src/hooks/useCatalogItems/useCatalogItems.ts` SHALL build the `DeploymentLimitsLabels`
object inside a `useMemo` keyed on `t` and the active `language`, and pass it to
`useCatalogItemDetails` (`libs/chat-hooks/src/catalog/useCatalogItemDetails.ts`) as
`deploymentLimitsLabels`, which calls `mapDeploymentLimitsDtoToCatalogLimits` for a deployment's
details. The labels object SHALL:

- take `tokensPerDay` / `tokensPerWeek` / `tokensPerMonth` from the Usage page's existing
  `UsageI18nKeys.TodayTitle` / `ThisWeekTitle` / `ThisMonthTitle` (`usage.todayTitle`,
  `usage.thisWeekTitle`, `usage.thisMonthTitle`), so the panel and Settings → Usage name the same
  periods identically;
- take `tokenGroup`, `followsCostLimit`, and the three formatter callbacks from `CatalogI18nKeys`;
- set `formatResetTime` to `formatUsageResetTime` (`apps/chat/src/utils/usage-reset-time.ts`) bound to
  the active language and `t`, the same formatter the Usage tab and the conversation-input popover
  use.

No new i18n keys are introduced; `catalog.details.limits.spentLabel` and
`catalog.details.limits.tokensPer{Day,Week,Month}` are removed from the locale bundle and from
`CatalogI18nKeys`.

#### Scenario: The catalog passes a translated, reset-aware labels object
- **WHEN** the catalog computes `limits` for a model's details
- **THEN** `mapDeploymentLimitsDtoToCatalogLimits` receives a `labels` object whose period labels
  read "Today" / "This week" / "This month" in English and whose `formatResetTime` is defined

#### Scenario: Changing language re-derives the labels
- **WHEN** the active language changes
- **THEN** the memoised labels object is rebuilt, so period labels and reset lines are re-localised
