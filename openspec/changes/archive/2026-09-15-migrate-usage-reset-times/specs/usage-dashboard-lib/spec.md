## MODIFIED Requirements

### Requirement: UsageLimitCardGroup and UsageLimitCard public API

The library SHALL export from `src/index.ts`: the components `UsageLimitCardGroup` and
`UsageLimitCard`, the string enum `UsageLimitStatus` (`Default = 'default'`,
`RunningLow = 'runningLow'`, `LimitReached = 'limitReached'`), and the types
`UsageLimitCardData`, `UsageLimitCardGroupLabels`, `UsageLimitCardGroupColors`,
`UsageLimitCardGroupTypography`, `UsageLimitCardGroupProps`, `UsageLimitCardProps`.

`UsageLimitCardData` SHALL carry only normalized, already-formatted data: `title`,
`periodDescription`, `used: number`, `total: number`, `usedLabel: string`, `totalLabel?: string`,
`remainingLabel?: string`, `isUnlimited?: boolean`, `usedPercent?: number` (not pre-clamped — may
exceed 100), `status: UsageLimitStatus`, `progressAriaLabel: string`, and the optional preformatted
reset-time trio `resetLabel?: string`, `resetIsoValue?: string`, `resetAriaLabel?: string`. The
library SHALL treat `used`/`total` as opaque numeric values used only to drive the `ProgressBar`'s
`value`/`max`/`aria-valuenow` and SHALL NOT recompute percentages, currency formatting, or the
unlimited-sentinel check from them.

The reset-time fields SHALL be preformatted strings produced by the host. `resetLabel` is the
visible text, `resetIsoValue` is the machine-readable instant for a `<time dateTime>` attribute, and
`resetAriaLabel` is the spoken form, which names the timezone in full rather than as an offset. The
library SHALL NOT parse, format, or timezone-shift them, SHALL NOT import `Intl`, and SHALL NOT accept a locale, timezone, or raw `resetsAt` value.
When `resetLabel` is absent the card SHALL render exactly as it did before reset times existed.

`UsageLimitCardGroupProps` SHALL accept a required `cards: UsageLimitCardData[]` (in display
order), a required `labels: UsageLimitCardGroupLabels`, and an optional
`styles?: { colors?: UsageLimitCardGroupColors; typography?: UsageLimitCardGroupTypography }`.
`UsageLimitCard` SHALL accept `data: UsageLimitCardData`, `labels: UsageLimitCardGroupLabels`, and
the same optional `styles`.

#### Scenario: Multiple cards rendered
- **WHEN** `UsageLimitCardGroup` is rendered with a `cards` array of two or more entries
- **THEN** it renders one independent, equally-sized box per entry, in array order, each showing
  its own title, badge, used amount, progress bar, and captions — with no shared container or
  divider between boxes

#### Scenario: Single card provided
- **WHEN** `UsageLimitCardGroup` is rendered with a `cards` array containing exactly one entry
- **THEN** it renders a single full-width `UsageLimitCard` box for that entry

#### Scenario: No cards provided
- **WHEN** `UsageLimitCardGroup` is rendered with an empty `cards` array
- **THEN** it renders nothing (returns `null`)

#### Scenario: Standalone UsageLimitCard
- **WHEN** `UsageLimitCard` is rendered directly with a `UsageLimitCardData` value
- **THEN** it renders the same title/badge/amount/progress/caption content as one card inside
  `UsageLimitCardGroup`

#### Scenario: Reset line renders below the caption row
- **WHEN** `UsageLimitCardData` carries `resetLabel` and `resetIsoValue`
- **THEN** the card renders `resetLabel` below its existing caption row inside a `<time>` element
  whose `dateTime` attribute is `resetIsoValue`, and the positions of the existing title, badge,
  amount, progress bar, and captions are unchanged

#### Scenario: Card without a reset label is unchanged
- **WHEN** `resetLabel` is absent
- **THEN** no `<time>` element and no reset line are rendered, and the card is visually identical
  to its pre-change output

#### Scenario: Unlimited card still renders its reset line
- **WHEN** `isUnlimited` is `true` and `resetLabel` is present
- **THEN** the card renders the unlimited treatment (used amount and badge only, no ratio) together
  with the reset line

---

### Requirement: ModelLimitsSection public API

The library SHALL export `ModelLimitsSection`; the string enums `ModelLimitStatus`
(`WithinLimits`, `RunningLow`, `LimitReached`, `NoLimit`, `Unavailable`) and
`ModelLimitMetricKind` (`Finite`, `Unlimited`, `Unavailable`); and the types
`ModelLimitMetricCell`, `ModelLimitPeriodCell`, `ModelLimitPeriodStatus`,
`ModelLimitPeriodStatuses`, `ModelLimitRow`, `ModelLimitsLabels`, `ModelLimitsColors`,
`ModelLimitsTypography`, `ModelLimitsStyles`, and `ModelLimitsSectionProps`. `ModelLimitsPeriod`
SHALL no longer be exported.

`ModelLimitMetricCell` SHALL retain its normalized `kind`, preformatted labels, optional uncapped
finite `usedPercent`/`status`, and required `ariaLabel`. The library SHALL not recompute percentage,
status, formatting, unlimited classification, or supporting-label selection. It MAY receive a
host-provided `supportingLabel` for an unlimited metric, such as `Follows cost limit`.

`ModelLimitPeriodCell` SHALL contain `tokens: ModelLimitMetricCell` and
`cost: ModelLimitMetricCell`.

**BREAKING — period property rename.** The three fixed periods SHALL be named for the calendar
windows they represent, not for trailing durations. `ModelLimitRow` SHALL contain identity fields,
`day: ModelLimitPeriodCell`, `week: ModelLimitPeriodCell`, `month: ModelLimitPeriodCell`, and
host-derived `status: ModelLimitStatus`. `ModelLimitPeriodStatuses` SHALL contain `day`, `week`, and
`month`. The former names `last24Hours`, `last7Days`, and `last30Days` SHALL NOT be exported or
accepted.

`ModelLimitPeriodStatus` SHALL contain the host-derived `status: ModelLimitStatus`, an optional
`tooltipLabel`, and the optional preformatted reset trio `resetLabel?: string`,
`resetIsoValue?: string`, `resetAriaLabel?: string`, carrying the same host-formatted-strings-only
contract as `UsageLimitCardData`.

`ModelLimitsLabels` SHALL contain heading, Item/day/week/month/Status column labels
(`dayColumnLabel`, `weekColumnLabel`, `monthColumnLabel`), accessible Tokens/Cost context, model
type, metric state, status badge, and empty-state strings. It SHALL NOT require period-selector or
Requests labels.

`ModelLimitsSectionProps` SHALL accept `rows`, `labels`, optional `styles`, and optional
`emptyStateIconSize`, plus normalized overall Cost statuses/tooltips for the three fixed headers; it
SHALL NOT accept `period` or `onPeriodChange`. The library SHALL not derive header status, tooltip
copy, or reset text from row data.

#### Scenario: Fixed comparison exports are available
- **WHEN** a consumer imports from `@epam/ai-dial-usage-dashboard`
- **THEN** the fixed comparison component/types are importable, including `ModelLimitPeriodCell`,
  and `ModelLimitsPeriod` is absent from the supported public contract

#### Scenario: Period properties use calendar names
- **WHEN** a consumer constructs a `ModelLimitRow` or `ModelLimitPeriodStatuses`
- **THEN** the compiler requires `day`, `week`, and `month`, and rejects `last24Hours`,
  `last7Days`, and `last30Days`

#### Scenario: Multiple rows render in supplied order
- **WHEN** `ModelLimitsSection` receives multiple rows
- **THEN** it renders one row per entry in array order with Item, three period cells, and Status

#### Scenario: Empty rows preserve the section shell
- **WHEN** `rows` is empty
- **THEN** the heading and count `0` remain visible and the body shows `emptyStateLabel`, with no
  selector or blank table body

#### Scenario: Period header renders its reset line
- **WHEN** a `ModelLimitPeriodStatus` carries `resetLabel`
- **THEN** that period's column header renders the column label and, beneath it, `resetLabel` inside
  a `<time>` element whose `dateTime` is `resetIsoValue`

#### Scenario: Period header without a reset label is unchanged
- **WHEN** a `ModelLimitPeriodStatus` carries no `resetLabel`
- **THEN** the header renders the column label and its status indicator exactly as before

---

### Requirement: Fixed period comparison columns

`ModelLimitsSection` SHALL render exactly the fixed columns Item, the calendar day period, the
calendar week period, the calendar month period, and Status, labelled from
`labels.dayColumnLabel`, `labels.weekColumnLabel`, and `labels.monthColumnLabel`. It SHALL not
render a period selector, a minute/hour option, standalone Cost/Tokens/Requests columns, or Requests
content. Every period column SHALL render both the Tokens and attributed Cost supplied for that
period without visible Tokens or Cost subheaders.

Column labels SHALL NOT describe the periods as trailing or rolling windows.

#### Scenario: Header contains only requested columns
- **WHEN** rows are present
- **THEN** the desktop header order is Item, day, week, month, Status and no period selector or
  Requests header is rendered

#### Scenario: Periods remain visible simultaneously
- **WHEN** a row is rendered
- **THEN** all three period cells exist at once and no user action is required to compare them

## ADDED Requirements

### Requirement: Reset-time rendering is responsive, RTL-safe, and accessible

Every reset line the library renders SHALL satisfy the library's existing responsive, RTL, and
accessibility rules — on a `UsageLimitCard` and in a `ModelLimitsSection` period header alike.

- It SHALL use only logical or direction-agnostic spacing utilities; no `ml-*`/`mr-*`, `pl-*`/`pr-*`,
  `left-*`/`right-*`, or `text-left`/`text-right` class SHALL be introduced for it.
- It SHALL contain no icon, and therefore no directional icon mirroring is required.
- It SHALL wrap rather than force horizontal overflow at mobile width, and SHALL NOT introduce a new
  breakpoint.
- It SHALL render inside a `<time>` element carrying `dateTime={resetIsoValue}`.
- When `resetAriaLabel` is supplied, that text SHALL render on a visually-hidden sibling and the
  visible `<time>` SHALL be marked `aria-hidden`. It SHALL NOT be applied as `aria-label` on the
  `<time>` itself, which has no implicit ARIA role and therefore does not reliably support one.
  When the field is absent, the visible text is the line's accessible name.
- It SHALL NOT alter the card's `progressAriaLabel` or the period header's existing status-indicator
  `aria-label`.

#### Scenario: No horizontal overflow on mobile with a long reset label
- **WHEN** the group and section render at mobile width with a long formatted reset label
- **THEN** the label wraps within its container and no horizontal scrollbar appears

#### Scenario: Layout mirrors under RTL
- **WHEN** an ancestor sets `dir="rtl"`
- **THEN** the reset line mirrors with the rest of the card or header, with no element pinned to a
  physical side by a class introduced for it

#### Scenario: Reset time is machine-readable
- **WHEN** a reset line renders
- **THEN** its `<time>` element exposes the original UTC instant via `dateTime`, independent of the
  localized visible text

#### Scenario: Reset line does not displace existing accessible names
- **WHEN** a card with a reset line renders
- **THEN** the progress bar's `aria-valuetext` and the badge text are unchanged from a card without
  one
