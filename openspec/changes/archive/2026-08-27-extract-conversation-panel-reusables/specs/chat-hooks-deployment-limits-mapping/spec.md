## ADDED Requirements

### Requirement: `mapDeploymentLimitsDtoToCatalogLimits` is a pure, labels-injected mapping utility owned by `chat-hooks`
`@epam/ai-dial-chat-hooks` SHALL export `mapDeploymentLimitsDtoToCatalogLimits(dto:
DeploymentLimitsResponseDto | undefined, labels: DeploymentLimitsLabels): CatalogItemLimits |
undefined`, where `DeploymentLimitsLabels` carries ten flat string fields (`requestsPerHour`,
`requestsPerDay`, `tokensPerMinute`, `tokensPerDay`, `tokensPerWeek`, `tokensPerMonth`,
`costPerMinute`, `costPerDay`, `costPerWeek`, `costPerMonth`), an `unlimitedValue` string, and two
formatter callbacks — `formatValueLabel: (used: string, total: string) => string` and
`formatProgressAriaLabel: (params: { label: string; used: string; total: string }) => string`. The
function SHALL NOT import `react-i18next`, `i18next`'s `TFunction`, or any app translation-key enum
(such as `CatalogI18nKeys`).

#### Scenario: Architecture guard — no i18n or translation-key import
- **WHEN** `libs/chat-hooks` is linted and type-checked
- **THEN** the deployment-limits-mapping module's source file contains no `i18next`/`react-i18next`
  import and no import of an app translation-key enum

### Requirement: Only stats with a usable, positive total produce a row
For each of the ten known stat keys on `dto`, the function SHALL include a row in the result only when
that stat's `total` and `used` are both finite numbers and `total` is greater than `0`; stats that are
absent, non-finite, or have a non-positive total SHALL be omitted from the result with no row emitted.

#### Scenario: Absent stats are skipped
- **WHEN** `dto` omits `weekTokenStats`
- **THEN** the result contains no row for the weekly token limit

#### Scenario: A stat with a zero or negative total is skipped
- **WHEN** a stat's `total` is `0` or negative
- **THEN** no row is emitted for that stat, even if `used` is a valid number

### Requirement: Rows preserve the fixed display order and per-stat label
The function SHALL emit rows in the fixed order: requests-per-hour, requests-per-day,
tokens-per-minute, tokens-per-day, tokens-per-week, tokens-per-month, cost-per-minute, cost-per-day,
cost-per-week, cost-per-month — skipping any stat that does not qualify per the requirement above,
without shifting the relative order of the remaining rows. Each row's `label` SHALL come from the
matching field of the injected `labels` object.

#### Scenario: Display order is stable when some stats are missing
- **GIVEN** `dto` has only `hourRequestStats` and `monthCostStats` set
- **WHEN** the function is called
- **THEN** the result's rows appear in that same relative order — requests-per-hour before
  cost-per-month — with no gap-filling placeholder rows

### Requirement: Cost stats are currency-formatted, non-cost stats are number-formatted
Stats whose key ends in `CostStats` SHALL have their `used`/`total` values formatted through a USD
currency `Intl.NumberFormat`; every other stat SHALL be formatted through a plain
`Intl.NumberFormat`. Both formatters SHALL cap fraction digits at 2.

#### Scenario: A cost stat is formatted as currency
- **WHEN** `monthCostStats` is `{ used: 12.345, total: 25 }`
- **THEN** the row's `usedLabel`/`totalLabel` are currency-formatted (e.g. `"$12.35"`/`"$25.00"`)

#### Scenario: A non-cost stat is formatted as a plain number
- **WHEN** `hourRequestStats` is `{ used: 2, total: 10 }`
- **THEN** the row's `usedLabel`/`totalLabel` are `"2"`/`"10"`, not currency-formatted

### Requirement: An unlimited total replaces the used/total pair with an unlimited indicator
When a stat's `total` is at or above `Number.MAX_SAFE_INTEGER`, the function SHALL set the row's
`isUnlimited` to `true` and SHALL NOT set `usedLabel`/`totalLabel`; the row's `valueLabel` SHALL be
`labels.unlimitedValue`, and the `total` argument passed to `labels.formatProgressAriaLabel` SHALL also
be `labels.unlimitedValue`.

#### Scenario: An unlimited stat omits used/total labels
- **WHEN** a stat's `total` is `Number.MAX_SAFE_INTEGER`
- **THEN** the row has `isUnlimited: true`, no `usedLabel`/`totalLabel`, and `valueLabel` equal to
  `labels.unlimitedValue`

### Requirement: `valueLabel` and `ariaLabel` are built through the injected formatter callbacks
For a non-unlimited row, the function SHALL set `valueLabel` to `labels.formatValueLabel(usedLabel,
totalLabel)` and `ariaLabel` to `labels.formatProgressAriaLabel({ label, used: usedLabel, total:
totalLabel })`. The function SHALL NOT construct either string through its own template literal.

#### Scenario: Formatter callbacks receive the formatted used/total strings
- **WHEN** a row's `used`/`total` format to `"2"`/`"10"`
- **THEN** `labels.formatValueLabel` is called with `("2", "10")` and its return value becomes the
  row's `valueLabel`

### Requirement: Absent or entirely-unqualified input produces `undefined`, never an empty-rows object
When `dto` is `undefined`, or when every known stat is absent/unqualified, the function SHALL return
`undefined` rather than `{ rows: [] }`.

#### Scenario: `undefined` dto returns `undefined`
- **WHEN** `dto` is `undefined`
- **THEN** the function returns `undefined`

#### Scenario: A dto with no qualifying stats returns `undefined`
- **WHEN** every stat on `dto` is absent or fails the usability check
- **THEN** the function returns `undefined`, not an object with an empty `rows` array

### Requirement: `CatalogView` builds the labels object and owns the app-level call site
`apps/chat/src/components/CatalogView/CatalogView.tsx` SHALL build a `DeploymentLimitsLabels` object from
`useTranslation` (mapping each `CatalogI18nKeys` entry to the corresponding flat field, and wrapping
`CatalogI18nKeys.DetailsLimitsValue`/`CatalogI18nKeys.DetailsLimitsProgressAriaLabel` in the two
formatter callbacks) and SHALL call the relocated `mapDeploymentLimitsDtoToCatalogLimits` from
`@epam/ai-dial-chat-hooks` instead of the deleted `apps/chat/src/utils/map-deployment-limits-to-catalog.ts`.

#### Scenario: CatalogView passes a translated labels object
- **WHEN** `CatalogView` computes `limits` for a catalog item's details
- **THEN** it calls `mapDeploymentLimitsDtoToCatalogLimits(limitsDto, labels)` with a `labels` object
  built from `useTranslation`, not a raw `TFunction`
