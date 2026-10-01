## ADDED Requirements

### Requirement: Reset times are displayed in the catalog details Limits tab

The `Limits` tab of the catalog details panel SHALL display the reset time for each token-limit row
(current UTC day, week, and month) whose stat carries a `resetsAt` that formats successfully, using
the same `LimitRow` markup, `<time dateTime>` / visually-hidden spoken-form pattern, and
`usage.resetsAtLabel` / `usage.resetsAtAriaLabel` strings as the conversation-input popover. The line
SHALL render on unlimited ("follows cost limit") rows as well as capped ones.

Degradation SHALL match the popover's: an absent, unparseable, or unformattable `resetsAt` yields no
reset line and leaves the row's figures, progress bar, and the tab's status untouched; a past
`resetsAt` is rendered verbatim. The panel SHALL NOT arm a boundary-triggered re-fetch — it fetches
on open, like the popover.

No new i18n keys are introduced. **RTL:** text only, logical utilities, `dir` inherited through the
cascade. **Responsive:** the line lives in the row's label column and wraps at mobile width.
**Memoisation:** the labels object carrying `formatResetTime` is `useMemo`-ed on `t` and the active
language.

#### Scenario: Each period row shows its reset time

- **WHEN** a model's `dayTokenStats`, `weekTokenStats`, and `monthTokenStats` carry `resetsAt`
  values `2026-10-02T00:00:00Z`, `2026-10-05T00:00:00Z`, and `2026-11-01T00:00:00Z`
- **THEN** the Today, This week, and This month rows each show a reset line with the formatted local
  date-time and timezone, and a `<time>` element whose `dateTime` is the original UTC string

#### Scenario: A malformed reset time costs nothing but the line

- **WHEN** `dayTokenStats.resetsAt` is `"not-a-date"`
- **THEN** the day row renders its figures and progress bar unchanged, shows no reset line, and no
  error is surfaced

#### Scenario: The panel arms no boundary timer

- **WHEN** the details panel renders rows carrying future reset boundaries
- **THEN** no `setTimeout` is armed for those boundaries and no request is issued beyond the
  open-time fetch

## MODIFIED Requirements

### Requirement: `libs/catalog` never interprets a reset timestamp

`libs/catalog` SHALL be held to the same constraint already placed on `libs/usage-dashboard`: it
SHALL NOT parse, format, or timezone-shift a `resetsAt` value, construct a `Date`, call a date/time
`Intl` API, or receive a locale, a timezone, a `TFunction`, or a raw `resetsAt` at all. Its props
carry only the preformatted `resetLabel` / `resetIsoValue` / `resetAriaLabel` strings.

All interpretation SHALL remain at the application edge in
`apps/chat/src/utils/usage-reset-time.ts`, supplied to the mapper as a `formatResetTime` callback
typed against the structural `FormatResetTime` / `ResetTimeDisplay` declared in
`libs/chat-hooks/src/usage/`. `libs/chat-hooks` SHALL NOT import the app's own `ResetTimeDisplay`
type, and the two shapes SHALL stay field-for-field identical so the app's
`formatUsageResetTime` return value satisfies the library's type with no cast at the call site.

`@epam/ai-dial-catalog` SHALL NOT export a `FormatResetTime`, a `ResetTimeDisplay`, or any
reset-time mapper of its own.

#### Scenario: Library never interprets a timestamp

- **WHEN** `libs/catalog`'s sources are inspected
- **THEN** no file parses, formats, or timezone-shifts a `resetsAt` value, constructs a `Date`, or
  calls a date/time `Intl` API, and no file receives a raw `resetsAt`; the module-boundary lint
  passes

#### Scenario: The app edge does the formatting

- **WHEN** the conversation-input popover builds its `CatalogItemLimits` value
- **THEN** it passes `formatUsageResetTime` bound to the active locale and `t` into
  `mapDeploymentLimitsToInput`, and only the strings that callback returned reach `libs/catalog`

#### Scenario: The catalog details panel formats at the app edge too

- **WHEN** the catalog details panel builds its `CatalogItemLimits` value
- **THEN** `useCatalogItems` passes `formatUsageResetTime` bound to the active language and `t` as
  `DeploymentLimitsLabels.formatResetTime` into `mapDeploymentLimitsDtoToCatalogLimits`, and only
  the strings that callback returned reach `libs/catalog`
