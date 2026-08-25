## MODIFIED Requirements

### Requirement: ModelLimitsSection public API

The library SHALL export `ModelLimitsSection`; the string enums `ModelLimitStatus`
(`WithinLimits`, `RunningLow`, `LimitReached`, `NoLimit`, `Unavailable`) and
`ModelLimitMetricKind` (`Finite`, `Unlimited`, `Unavailable`); and the types
`ModelLimitMetricCell`, `ModelLimitPeriodCell`, `ModelLimitRow`, `ModelLimitsLabels`,
`ModelLimitsColors`, `ModelLimitsTypography`, `ModelLimitsStyles`, and
`ModelLimitsSectionProps`. `ModelLimitsPeriod` SHALL no longer be exported.

`ModelLimitMetricCell` SHALL retain its normalized `kind`, preformatted labels, optional uncapped
finite `usedPercent`/`status`, and required `ariaLabel`. The library SHALL not recompute percentage,
status, formatting, unlimited classification, or supporting-label selection. It MAY receive a
host-provided `supportingLabel` for an unlimited metric, such as `Follows cost limit`.

`ModelLimitPeriodCell` SHALL contain `tokens: ModelLimitMetricCell` and
`cost: ModelLimitMetricCell`. `ModelLimitRow` SHALL contain identity fields,
`last24Hours: ModelLimitPeriodCell`, `last7Days: ModelLimitPeriodCell`,
`last30Days: ModelLimitPeriodCell`, and host-derived `status: ModelLimitStatus`.

`ModelLimitsLabels` SHALL contain heading, Item/Last 24 hours/Last 7 days/Last 30 days/Status column,
accessible Tokens/Cost context, model type, metric state, status badge, and
empty-state strings. It SHALL NOT require period-selector or Requests labels.

`ModelLimitsSectionProps` SHALL accept `rows`, `labels`, optional `styles`, and optional
`emptyStateIconSize`, plus normalized overall Cost statuses/tooltips for the three fixed headers; it
SHALL NOT accept `period` or `onPeriodChange`. The library SHALL not derive header status or tooltip
copy from row data.

#### Scenario: Fixed comparison exports are available
- **WHEN** a consumer imports from `@epam/ai-dial-usage-dashboard`
- **THEN** the fixed comparison component/types are importable, including `ModelLimitPeriodCell`,
  and `ModelLimitsPeriod` is absent from the supported public contract

#### Scenario: Multiple rows render in supplied order
- **WHEN** `ModelLimitsSection` receives multiple rows
- **THEN** it renders one row per entry in array order with Item, three period cells, and Status

#### Scenario: Empty rows preserve the section shell
- **WHEN** `rows` is empty
- **THEN** the heading and count `0` remain visible and the body shows `emptyStateLabel`, with no
  selector or blank table body

---

### Requirement: Per-metric cell rendering by kind

Within each period cell, Tokens SHALL render using the existing finite/unlimited/unavailable
treatment. A finite token metric SHALL show `usedLabel / totalLabel` and an accessible progress bar;
the fill SHALL be clamped to `[0, 100]` while `aria-valuetext` preserves the host-provided uncapped
meaning. Unlimited Tokens SHALL show `usedLabel` and `noLimitLabel` without a progress bar.
Unavailable Tokens SHALL show `unavailableLabel` without a progress bar.

Cost SHALL render in the same period cell as only its normalized attributed-spend label when
present, or `unavailableLabel` when Unavailable. It SHALL NOT visibly render `costLabel`,
`totalLabel`, `noLimitLabel`, a per-model Cost cap, or a progress bar. The localized `costLabel`
SHALL remain available as non-visual accessible context. The component SHALL render the
host-provided value and SHALL not derive or format it. A finite token progress bar SHALL render
directly below the token value, and Cost SHALL render on its own line below that progress bar.

Each finite token progress fill color SHALL reflect that token cell's own metric status, independent
of the row's overall Status and other periods.

#### Scenario: Period cell stacks finite Tokens progress and attributed Cost
- **WHEN** a period contains finite Tokens `4K / 10K` at 40% and normalized Cost `$3.20 spent`
- **THEN** the same period cell renders `4K / 10K`, then its token progress bar, then `$3.20 spent`
  on a separate line, without a visible Cost label, per-model Cost limit, No limit text, or Cost
  progress bar

#### Scenario: Unlimited Tokens render without progress
- **WHEN** a period's Tokens kind is `Unlimited` with host-provided supporting label
  `Follows cost limit`
- **THEN** it renders the token used value plus `Follows cost limit` and no progress bar

#### Scenario: Unavailable metrics remain explicit
- **WHEN** either metric in a period is `Unavailable`
- **THEN** that metric renders `unavailableLabel`, distinct from `noLimitLabel`, without borrowing
  data from the other metric or period

#### Scenario: Over-limit tokens clamp only visual fill
- **WHEN** a finite token metric has `usedPercent: 137`
- **THEN** visual progress is capped at 100 while `aria-valuetext` retains the host's real value

---

### Requirement: Overall row status

The library SHALL render the host-provided `row.status`: `WithinLimits`, `RunningLow`, and
`LimitReached` as their labelled status treatments; `NoLimit` and `Unavailable` as localized plain
secondary text. Color SHALL never be the only status indicator. The library SHALL NOT inspect or
aggregate period metrics to derive Status.

#### Scenario: Limit reached displays the error treatment
- **WHEN** `row.status` is `LimitReached`
- **THEN** the Status column renders `limitReachedBadgeLabel` with the error accent and visible text

#### Scenario: Neutral statuses remain distinct
- **WHEN** `row.status` is `NoLimit` or `Unavailable`
- **THEN** the corresponding localized label renders as plain text and the two states remain
  textually distinguishable

---

### Requirement: Model limits table responsive and RTL layout

`ModelLimitsSection` SHALL use mobile-first styles, only the repository `mobile:`/`desktop:`
breakpoints, and logical directional properties/classes. At desktop widths it SHALL render one
aligned five-column grid: Item, Last 24 hours, Last 7 days, Last 30 days, and Status. Each period
column SHALL group its Tokens and Cost content without vertical column borders. Every desktop row's
grid items SHALL be centered along the vertical axis while preserving their horizontal text/content
alignment. Token progress tracks SHALL retain the available period-cell width, and the attributed
Cost line SHALL remain below the progress track or token supporting state.

At mobile widths each semantic row SHALL stack identity, three visibly labelled period sections,
and a visibly labelled Status in one subtree. Overall Cost status indicators SHALL remain available
beside the corresponding visible mobile period label. It SHALL not create page-level horizontal
overflow at 360px, hide any period, or mount separate desktop/mobile component trees. Long content
SHALL wrap or truncate without obscuring the accessible value. The status icons are
direction-agnostic and SHALL NOT be mirrored.

#### Scenario: Mobile preserves all periods without horizontal page scroll
- **WHEN** the section renders at 360px with long model and metric values
- **THEN** Item, all three labelled periods, and Status remain available in stacked rows without
  horizontal page overflow

#### Scenario: Desktop aligns fixed comparison columns
- **WHEN** the section renders at 769px or wider
- **THEN** header and rows share the same five grid tracks and Tokens/Cost remain grouped beneath
  their matching period header; each row cell's content is vertically centered without changing
  horizontal alignment

#### Scenario: RTL inherits through logical layout
- **WHEN** an RTL `dir` ancestor is present
- **THEN** directional spacing/alignment follows the document direction without language checks,
  physical-direction utilities, or duplicated markup

---

### Requirement: Model limits accessibility

The section SHALL expose a programmatically named table containing the row count and SHALL preserve
`table`, `rowgroup`, `row`, `columnheader`, and `cell` semantics on desktop and mobile. Each period
column header SHALL programmatically cover both Tokens and Cost in its corresponding cells; each
finite token progress bar SHALL have a period-specific accessible name and host-provided full
`aria-valuetext`. Mobile visible labels SHALL not replace or break the table associations.
Decorative empty-state and avatar imagery SHALL remain hidden from assistive technology where
redundant. A running-low/reached period status indicator SHALL be keyboard-focusable, expose its
complete host-provided tooltip as an accessible name, and provide at least a 44×44 CSS-pixel touch
target where it is shown on mobile.

#### Scenario: Overall Cost status is explained from the period header
- **WHEN** Last 24 hours overall Cost status is `LimitReached`
- **THEN** its header renders an error indicator whose accessible tooltip explains that the overall
  Last 24 hours Cost limit is reached and models cannot be used until it resets

#### Scenario: Table name includes rendered row count
- **WHEN** the section has 7 rows
- **THEN** its accessible table name includes the Model tokens limits label and count `7`

#### Scenario: Period progress has unambiguous context
- **WHEN** assistive technology reaches a model's Last 7 days token progress bar
- **THEN** its accessible name identifies Last 7 days and Tokens and its value text provides full
  used/total information

#### Scenario: Mobile retains one semantic table
- **WHEN** CSS stacks a row at mobile width
- **THEN** the same semantic table/row/cell nodes remain available and reading order is Item, Last
  24 hours, Last 7 days, Last 30 days, Status

## ADDED Requirements

### Requirement: Fixed period comparison columns

`ModelLimitsSection` SHALL render exactly the fixed columns Item, Last 24 hours, Last 7 days, Last
30 days, and Status. It SHALL not render a period selector, Last minute/Last hour option, standalone
Cost/Tokens/Requests columns, or Requests content. Every period column SHALL render both the Tokens
and attributed Cost supplied for that period without visible Tokens or Cost subheaders.

#### Scenario: Header contains only requested columns
- **WHEN** rows are present
- **THEN** the desktop header order is Item, Last 24 hours, Last 7 days, Last 30 days, Status and no
  period selector or Requests header is rendered

#### Scenario: Periods remain visible simultaneously
- **WHEN** a row is rendered
- **THEN** all three period cells exist at once and no user action is required to compare them

## REMOVED Requirements

### Requirement: Controlled period selector

**Reason**: The table renders all supported comparison periods simultaneously; selection state and
the Last minute/Last hour options are no longer part of the design.

**Migration**: Consumers remove `period` and `onPeriodChange`, provide all three fixed period cells
per row, and supply fixed period column labels.
