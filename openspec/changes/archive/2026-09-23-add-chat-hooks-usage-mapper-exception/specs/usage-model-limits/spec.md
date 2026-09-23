## MODIFIED Requirements

### Requirement: Aggregate period cost cards

The `mapUsageDataToDashboard` adapter (in `libs/chat-hooks/src/usage/map-usage-data-to-dashboard.ts`, exported from `@epam/ai-dial-chat-hooks`'s `./utils` entry point) SHALL map the top-level
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

The adapters SHALL own all DTO field selection, unlimited-sentinel checks, status thresholds,
currency/number formatting, locale/icon resolution, and deployment joins. That work SHALL happen in
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
  `libs/chat-hooks`'s dependency on `@epam/ai-dial-usage-dashboard` is type-only

> Non-requirement edit applied with these deltas: the capability's `## Purpose` paragraph in
> `openspec/specs/usage-model-limits/spec.md` names `apps/chat/src/utils/` as the adapters' file
> location. It is updated to name `libs/chat-hooks/src/usage/`, matching the requirements above, so
> the spec does not contradict itself after archiving.
