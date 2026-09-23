## MODIFIED Requirements

### Requirement: Aggregate period cost cards

The `mapUsageDataToDashboard` adapter (in `apps/chat/src/utils/map-usage-data-to-dashboard.ts`) SHALL map the top-level
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
come from a caller-supplied translate callback keyed on `UsageI18nKeys`
(`apps/chat/src/constants/translation-keys.ts`); the adapter SHALL NOT import `react-i18next`, so it
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
The adapter (in `apps/chat/src/utils/map-user-usage-to-model-limits.ts`, alongside the row adapter
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

### Requirement: Library isolation for the adapter

All DTO interpretation SHALL be app-owned. DTO field selection, unlimited-sentinel checks, status
thresholds, currency/number formatting,
locale/icon resolution, and deployment joins SHALL happen in **app-owned** adapters under
`apps/chat/src/utils/` — `map-usage-data-to-dashboard.ts` and `map-user-usage-to-model-limits.ts` —
and SHALL NOT happen in any hand-authored library. `libs/usage-dashboard` SHALL NOT import
`@epam/ai-dial-chat-api-client`, app code, app contexts, feature flags, routing, storage, or
analytics, and SHALL receive only normalized rows/cards/period statuses and localized labels through
props (see the `usage-dashboard-lib` capability).

The same coupling SHALL NOT be relocated into another library instead: it SHALL NOT be moved into
`libs/chat-shared` or `libs/chat-hooks`, and the narrow `libs/chat-hooks` generated-client exception
in AGENTS.md SHALL NOT be widened to cover presentation mapping. Isolation SHALL NOT be satisfied by
copying generated DTO interfaces into a library, by replacing the runtime
`DeploymentItemDtoTypeEnum` with equivalent hardcoded backend strings, or by using type-only imports
while a library still interprets BFF field names or the unlimited sentinel.

The adapters SHALL keep accepting host-owned callbacks (`resolveIconUrl`, `resolveDisplayName`,
`formatResetTime`) and a caller-supplied translate function, so they remain pure functions that
`UsageTab` can memoize; they SHALL NOT import `react-i18next` or read the app's contexts directly.
No library SHALL import an app adapter, and no dependency cycle SHALL be introduced.

`UsageTab` wires the app-owned adapters with `useUsageData(getUserUsage, ...)` from
`@epam/ai-dial-chat-hooks` and `useDeployments()` from the app context, and imports
`UsageLimitCardGroup` and `ModelLimitsSection` from `@epam/ai-dial-usage-dashboard`. No new context
or hook is introduced, no fetching is added or removed, and existing `useMemo`/`useCallback`
dependency arrays and subscription lifetimes are preserved.

#### Scenario: Library public API stays normalized
- **WHEN** `libs/usage-dashboard` public types are inspected
- **THEN** they expose period-shaped presentation props but no raw DTO field such as `dayTokenStats`,
  API path/client type, unlimited sentinel, or status threshold in the component props

#### Scenario: Library carries no generated-client edge
- **WHEN** `libs/usage-dashboard`'s source, barrel, `package.json`, `tsconfig.lib.json`, and
  `vite.config.mts` are inspected
- **THEN** none of them names `@epam/ai-dial-chat-api-client`

#### Scenario: The coupling is not relocated to another library
- **WHEN** `libs/chat-shared` and `libs/chat-hooks` are inspected after the move
- **THEN** neither has gained a usage-dashboard DTO mapper, a copied generated DTO interface, or a
  hardcoded substitute for `DeploymentItemDtoTypeEnum`

#### Scenario: Existing feature ownership remains unchanged
- **WHEN** the comparison table renders
- **THEN** `useUsageData` and `useDeployments` remain the only owners of fetched Usage and deployment
  state; no new context or hook is introduced

#### Scenario: No import cycle between app adapters and the library
- **WHEN** the project graph is inspected
- **THEN** `apps/chat` depends on `usage-dashboard` and `usage-dashboard` depends on neither
  `apps/chat` nor any app adapter module

> Non-requirement edit applied with these deltas: the capability's `## Purpose` paragraph in
> `openspec/specs/usage-model-limits/spec.md` states that the adapter functions live in
> `libs/usage-dashboard/src/utils/map-user-usage-to-model-limits.ts` and are exported from
> `@epam/ai-dial-usage-dashboard`. It is updated to name the app-owned location, so the spec does not
> contradict the requirements above after archiving.
