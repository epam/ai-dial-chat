# chat-hooks-deployment-limits-mapping Specification

## Purpose

A pure, labels-injected utility in `@epam/ai-dial-chat-hooks` that maps a `DeploymentLimitsResponseDto` to a `CatalogItemLimits` display model, with no i18n dependency — all user-visible strings and formatter callbacks are supplied by the caller.

## Requirements

### Requirement: `mapDeploymentLimitsDtoToCatalogLimits` is a pure, labels-injected mapping utility owned by `chat-hooks`
`@epam/ai-dial-chat-hooks` SHALL export `mapDeploymentLimitsDtoToCatalogLimits(dto:
DeploymentLimitsResponseDto | undefined, labels: DeploymentLimitsLabels): CatalogItemLimits |
undefined` from `libs/chat-hooks/src/catalog/map-deployment-limits-to-catalog.ts`, where
`DeploymentLimitsLabels` carries the string fields `tokenGroup`, `tokensPerDay`, `tokensPerWeek`,
`tokensPerMonth` and `followsCostLimit`, plus four formatter callbacks —
`formatSpentCaption: (amount: string) => string`,
`formatValueLabel: (used: string, total: string) => string`,
`formatProgressAriaLabel: (params: { label: string; used: string; total: string }) => string` and
`formatFollowsCostLimitAriaLabel: (params: { label: string; used: string }) => string`. There are no
request or cost row label fields and no `unlimitedValue`. The function SHALL NOT import
`react-i18next`, `i18next`'s `TFunction`, or any app translation-key enum (such as `CatalogI18nKeys`).

#### Scenario: Architecture guard — no i18n or translation-key import
- **WHEN** `libs/chat-hooks` is linted and type-checked
- **THEN** the deployment-limits-mapping module's source file contains no `i18next`/`react-i18next`
  import and no import of an app translation-key enum

### Requirement: Only stats with a usable, positive total produce a row
The function SHALL, for each of the three token stat keys on `dto` (`dayTokenStats`, `weekTokenStats`, `monthTokenStats`), include a row in the result only when that stat's `total` and
`used` are both finite numbers and `total` is greater than `0`; stats that are absent, non-finite, or
have a non-positive total SHALL be omitted with no row emitted. Request stats and cost stats SHALL
NOT produce rows of their own.

#### Scenario: Absent stats are skipped
- **WHEN** `dto` omits `weekTokenStats`
- **THEN** the result contains no row for the weekly token limit

#### Scenario: A stat with a zero or negative total is skipped
- **WHEN** a token stat's `total` is `0` or negative
- **THEN** no row is emitted for that stat, even if `used` is a valid number

#### Scenario: Request and cost stats do not produce rows
- **WHEN** `dto` has only `hourRequestStats` and `monthCostStats` set
- **THEN** the function returns `undefined`

### Requirement: Rows preserve the fixed display order and per-stat label
The function SHALL emit rows in the fixed order tokens-per-day, tokens-per-week, tokens-per-month —
skipping any stat that does not qualify per the requirement above, without shifting the relative
order of the remaining rows. Each row's `label` SHALL come from the matching field of the injected
`labels` object (`tokensPerDay`, `tokensPerWeek`, `tokensPerMonth`).

#### Scenario: Display order is stable when some stats are missing
- **GIVEN** `dto` has only `dayTokenStats` and `monthTokenStats` set
- **WHEN** the function is called
- **THEN** the result's rows appear in that same relative order — tokens-per-day before
  tokens-per-month — with no gap-filling placeholder row

### Requirement: Each token row carries its period's cost spend as a caption
For each emitted token row, the function SHALL read the sibling cost stat of the same period
(`dayCostStats`, `weekCostStats`, `monthCostStats`). When that cost stat has finite `used` and
`total`, the row's `captionLabel` SHALL be `labels.formatSpentCaption(formatCost(Math.max(0, used)))`
(`formatCost` from `@epam/ai-dial-chat-shared`); the cost stat's `total` is not treated as a limit.
Otherwise `captionLabel` SHALL be `undefined`.

#### Scenario: A token row shows the spent caption
- **WHEN** `monthTokenStats` qualifies and `monthCostStats` is `{ used: 12.345, total: 25 }`
- **THEN** the tokens-per-month row's `captionLabel` is `labels.formatSpentCaption` applied to the
  `formatCost`-formatted `12.345`

#### Scenario: No cost stat means no caption
- **WHEN** `dayTokenStats` qualifies and `dayCostStats` is absent
- **THEN** the tokens-per-day row has no `captionLabel`

### Requirement: Token values use compact display formatting and full aria formatting
Each row's display values SHALL be formatted — `usedLabel`, `totalLabel`, and the strings passed
to `labels.formatValueLabel` — with a compact-notation `Intl.NumberFormat`
(`notation: 'compact'`, `maximumFractionDigits: 1`), with the used value first clamped to `0` and
truncated toward zero at its compact magnitude so it never rounds up past what was consumed. The
strings passed to the aria-label callbacks SHALL instead be formatted in full through a plain
`Intl.NumberFormat` with `maximumFractionDigits: 2`.

#### Scenario: A large used value is truncated, not rounded up
- **WHEN** a token stat has `used: 1999000`
- **THEN** its displayed used value is `"1.9M"`, not `"2M"`

#### Scenario: Aria text uses full numbers
- **WHEN** a capped token stat is `{ used: 1600000, total: 2000000 }`
- **THEN** `labels.formatValueLabel` receives `("1.6M", "2M")` and `labels.formatProgressAriaLabel`
  receives `used: "1,600,000"` and `total: "2,000,000"`

### Requirement: An unlimited total replaces the used/total pair with a follows-cost-limit note
When a token stat's `total` is at or above `Number.MAX_SAFE_INTEGER`, the function SHALL set the row's
`isUnlimited` to `true` and `noteLabel` to `labels.followsCostLimit`, SHALL NOT set
`usedLabel`/`totalLabel`, SHALL set `valueLabel` to the compact-formatted used value, and SHALL build
`ariaLabel` through `labels.formatFollowsCostLimitAriaLabel({ label, used })` with the full-formatted
used value and no total.

#### Scenario: An unlimited stat omits used/total labels
- **WHEN** a token stat's `total` is `Number.MAX_SAFE_INTEGER`
- **THEN** the row has `isUnlimited: true`, `noteLabel` equal to `labels.followsCostLimit`, no
  `usedLabel`/`totalLabel`, and `valueLabel` equal to the formatted used value

### Requirement: `valueLabel` and `ariaLabel` are built through the injected formatter callbacks
For a non-unlimited row, the function SHALL set `valueLabel` to `labels.formatValueLabel(usedLabel,
totalLabel)` with the compact-formatted strings, and `ariaLabel` to `labels.formatProgressAriaLabel({
label, used, total })` with the full-formatted strings. The function SHALL NOT construct either string
through its own template literal.

#### Scenario: Formatter callbacks receive the formatted used/total strings
- **WHEN** a row's `used`/`total` are `2`/`10`
- **THEN** `labels.formatValueLabel` is called with `("2", "10")` and its return value becomes the
  row's `valueLabel`

### Requirement: Absent or entirely-unqualified input produces `undefined`, never an empty-rows object
When `dto` is `undefined`, or when no token stat qualifies, the function SHALL return `undefined`.
Otherwise it SHALL return `{ groups: [{ label: labels.tokenGroup, rows }], status }`, never a result
with an empty `rows` array. `status` SHALL be the worst case across the qualifying stats:
`CatalogLimitStatus.LimitReached` when any capped stat's `used / total` is `>= 1`,
`CatalogLimitStatus.RunningLow` when any is `>= 0.75` and none has reached the limit, and `undefined`
otherwise (unlimited stats count as ratio `0`).

#### Scenario: `undefined` dto returns `undefined`
- **WHEN** `dto` is `undefined`
- **THEN** the function returns `undefined`

#### Scenario: A dto with no qualifying stats returns `undefined`
- **WHEN** every token stat on `dto` is absent or fails the usability check
- **THEN** the function returns `undefined`, not an object with an empty `rows` array

#### Scenario: Overall status reflects the worst stat
- **WHEN** `dayTokenStats` is `{ used: 80, total: 100 }` and `monthTokenStats` is `{ used: 100, total: 100 }`
- **THEN** the result's `status` is `CatalogLimitStatus.LimitReached` and its single group is labelled
  `labels.tokenGroup`

### Requirement: `useCatalogItems` builds the labels object and `useCatalogItemDetails` owns the call site
`apps/chat/src/hooks/useCatalogItems/useCatalogItems.ts` SHALL build a memoised `DeploymentLimitsLabels`
object from `useTranslation` (`CatalogI18nKeys.DetailsLimitsTokenGroupLabel`,
`DetailsLimitsTokensPerDay`/`Week`/`Month`, `DetailsLimitsFollowsCostLimitLabel`, and the callbacks
wrapping `DetailsLimitsSpentLabel`, `DetailsLimitsValue`, `DetailsLimitsProgressAriaLabel` and
`DetailsLimitsFollowsCostLimitAriaLabel`) and SHALL pass it as `deploymentLimitsLabels` to
`useCatalogItemDetails` from `@epam/ai-dial-chat-hooks`, which calls
`mapDeploymentLimitsDtoToCatalogLimits` when it resolves a deployment's details.
`apps/chat/src/components/CatalogView/CatalogView.tsx` SHALL NOT call the mapper itself, and the
deleted `apps/chat/src/utils/map-deployment-limits-to-catalog.ts` SHALL NOT be reintroduced.

#### Scenario: The app passes a translated labels object
- **WHEN** `useCatalogItemDetails` computes `limits` for a deployment's details
- **THEN** it calls `mapDeploymentLimitsDtoToCatalogLimits(limitsDto, deploymentLimitsLabels)` with the
  labels object built in `useCatalogItems` from `useTranslation`, not a raw `TFunction`
