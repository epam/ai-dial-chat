## ADDED Requirements

### Requirement: `ModelLimitsSection` renders its table through the ui-kit `Grid`

`ModelLimitsSection` (`libs/usage-dashboard/src/components/ModelLimitsSection/ModelLimitsSection.tsx`) SHALL render its table as one 2.0 `Grid` from `@epam/ai-dial-ui-kit/grid`, with `rowData={rows}` and `getRowId` returning `row.id`.

**Columns.** It SHALL declare exactly five columns, in this order:

| `colId` | Header | Cell renderer |
| --- | --- | --- |
| `item` | `labels.itemColumnLabel` | identity (avatar, type caption, name, version) |
| `day` | header component, `labels.dayColumnLabel` | period cell for `row.day` |
| `week` | header component, `labels.weekColumnLabel` | period cell for `row.week` |
| `month` | header component, `labels.monthColumnLabel` | period cell for `row.month` |
| `status` | `labels.statusColumnLabel` | status badge or neutral status text |

Each period header component SHALL render the column label, the reset-time info icon when `resetLabel` is set, and the `PeriodStatusIndicator`. It receives that period's `ModelLimitPeriodStatus` through `headerComponentParams`.

**Grid options.**

- Sorting, filtering, floating filters and column resizing SHALL be off.
- The grid SHALL size its height to its rows (`domLayout: 'autoHeight'`).
- It SHALL use `withoutHeaderBorders` and `appearance={GridAppearance.Chat}`. The kit draws the borderless 12px card with the MD shadow and the inset row dividers, so the section adds no card or border of its own.
- Rows SHALL use the design's Relaxed density, 84px.

**What SHALL NOT exist:**

- `ModelLimitsSection` SHALL NOT render hand-authored `role="table"`, `role="row"`, `role="rowgroup"`, `role="columnheader"` or `role="cell"` elements.
- The former `ModelLimitsRow.tsx` and `MODEL_LIMITS_GRID_COLUMNS` SHALL NOT exist.

**Dependencies.** `libs/usage-dashboard` SHALL NOT import `ag-grid-community` or `ag-grid-react`. Column definitions are typed from the kit's `GridProps`.

#### Scenario: One grid with five columns

- **WHEN** `ModelLimitsSection` renders two rows
- **THEN** exactly one ui-kit `Grid` is rendered
- **AND** its column headers read Item, the day label, the week label, the month label and Status, in that order
- **AND** it renders two data rows in `rows` order

#### Scenario: Header carries reset info icon and indicator

- **WHEN** `periodStatuses.day` has `status: LimitReached` and `resetLabel: 'Resets Sep 16, 2026, 2:00 AM GMT+2'`
- **THEN** the day column header renders the day label, a focusable info icon whose tooltip holds the reset label in a `<time>`, and the error `PeriodStatusIndicator`

#### Scenario: Empty rows use the grid empty state

- **WHEN** `rows` is empty
- **THEN** the heading with count `0` remains above the grid
- **AND** the grid's empty state shows `labels.emptyStateLabel`, with no kit default description line

### Requirement: `ModelLimitsColors` covers cell content only

`ModelLimitsColors` SHALL NOT contain `containerBackground`, `columnHeaderColor` or `rowDividerColor`. The table frame, header and row dividers come from the `Grid` theme. `ModelLimitsSection.module.scss` SHALL NOT target ag-grid's internal `.ag-*` classes.

Every other `ModelLimitsColors` member SHALL keep its current meaning and fallback: heading, heading count, name, model type, version, value, secondary value, progress, indicator, badge and neutral status.

#### Scenario: Removed chrome colour is rejected

- **WHEN** a consumer passes `styles={{ colors: { rowDividerColor: '#000' } }}`
- **THEN** TypeScript reports `rowDividerColor` as an unknown property of `ModelLimitsColors`

#### Scenario: Content colour still applies

- **WHEN** a consumer passes `styles={{ colors: { errorBadgeBackground: '#f00' } }}` and a row has status `LimitReached`
- **THEN** that row's status badge background is `#f00`

## MODIFIED Requirements

### Requirement: Model limits table responsive and RTL layout

`ModelLimitsSection` SHALL render the same ui-kit `Grid`, with the same five columns, at every viewport width. It SHALL NOT mount separate desktop and mobile component trees, and SHALL NOT render per-cell mobile column labels.

**Column widths.** Each column SHALL declare a minimum width: Item at least 192px, each period at least 160px, Status at least 128px. When the viewport is narrower than their sum, the grid SHALL scroll horizontally inside its own box, and the page SHALL NOT scroll horizontally.

**Period columns.** Each period column SHALL group its Tokens and Cost content without vertical column borders. Row content SHALL be vertically centred within each cell while keeping its horizontal alignment. Token progress tracks SHALL take the available period-cell width, and the attributed Cost line SHALL stay below the progress track or the token supporting state.

**Long content** SHALL wrap or truncate without hiding the accessible value.

**Direction.** Column order and horizontal scroll SHALL follow the document direction through ag-grid. Renderers SHALL use only logical directional classes and the repository `mobile:`/`desktop:` breakpoints. The status icons are direction-agnostic and SHALL NOT be mirrored.

#### Scenario: Mobile scrolls the table, not the page

- **WHEN** the section renders at 360px with long model and metric values
- **THEN** Item, all three periods and Status remain available as grid columns
- **AND** the grid box scrolls horizontally
- **AND** the page has no horizontal overflow

#### Scenario: Desktop aligns fixed comparison columns

- **WHEN** the section renders at 769px or wider
- **THEN** the header and rows share the same five grid columns
- **AND** Tokens and Cost stay grouped beneath their matching period header
- **AND** each cell's content is vertically centred without changing its horizontal alignment

#### Scenario: RTL inherits through ag-grid and logical layout

- **WHEN** an RTL `dir` ancestor is present
- **THEN** the Item column renders at the inline start
- **AND** directional spacing follows the document direction without language checks, physical-direction utilities or duplicated markup

### Requirement: Model limits accessibility

The section SHALL be accessible through the ui-kit `Grid`'s own semantics, as follows.

**Grid semantics.**

- The section SHALL expose the ui-kit `Grid`'s named region, with `ariaLabel` set to `labels.headingLabel` followed by the row count.
- ag-grid's `grid`, `row`, `columnheader` and `gridcell` semantics SHALL be kept at every width.
- Each period column header SHALL cover both the Tokens and the Cost content of its cells.

**Progress bars.** Each finite token progress bar SHALL have a period-specific accessible name and the host-provided full `aria-valuetext`.

**Decorative imagery.** Empty-state and avatar imagery SHALL stay hidden from assistive technology where it is redundant.

**Period status indicator.** A running-low or limit-reached indicator in a period header SHALL:

- be keyboard-focusable;
- expose its complete host-provided tooltip as its accessible name;
- provide at least a 44×44 CSS-pixel touch target.

#### Scenario: Overall Cost status is explained from the period header

- **WHEN** the day overall Cost status is `LimitReached`
- **THEN** its header renders an error indicator
- **AND** the indicator's accessible tooltip explains that the overall day Cost limit is reached and models cannot be used until the period resets

#### Scenario: Grid name includes rendered row count

- **WHEN** the section has 7 rows
- **THEN** the grid region's accessible name includes the Model tokens limits label and count `7`

#### Scenario: Period progress has unambiguous context

- **WHEN** assistive technology reaches a model's week token progress bar
- **THEN** its accessible name identifies the week period and Tokens
- **AND** its value text gives the full used/total information

#### Scenario: Reading order is stable

- **WHEN** assistive technology reads a row
- **THEN** its cells are announced in the order Item, Today, This week, This month, Status

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

`ModelLimitsSectionProps` SHALL accept `rows`, `labels`, and optional `styles`,
plus normalized overall Cost statuses/tooltips for the three fixed headers; it
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

#### Scenario: Period header renders its reset time behind an info icon
- **WHEN** a `ModelLimitPeriodStatus` carries `resetLabel`
- **THEN** that period's column header renders the column label and a focusable info icon named by
  `resetAriaLabel` (or `resetLabel`), whose tooltip holds `resetLabel` inside a `<time>` element
  whose `dateTime` is `resetIsoValue`; no reset line renders in the header

#### Scenario: Period header without a reset label is unchanged
- **WHEN** a `ModelLimitPeriodStatus` carries no `resetLabel`
- **THEN** the header renders the column label and its status indicator exactly as before

### Requirement: Reset-time rendering is responsive, RTL-safe, and accessible

Every reset time the library renders SHALL satisfy the library's existing responsive, RTL, and
accessibility rules — as a reset line on a `UsageLimitCard`, and behind an info icon in a
`ModelLimitsSection` period header.

**Period header info icon.** A `ModelLimitsSection` period header SHALL NOT render a reset line.
`PeriodResetInfo` (`libs/usage-dashboard/src/components/ModelLimitsSection/PeriodResetInfo.tsx`)
SHALL render a focusable `IconInfoCircle` beside the column label. Its accessible name is
`resetAriaLabel`, or `resetLabel` when no spoken form is supplied, because a tooltip never reaches a
touch-only device. Its kit `Tooltip` holds the `<time dateTime={resetIsoValue}>` with `resetLabel`.
It SHALL provide at least a 44×44 CSS-pixel touch target on mobile. The info icon is symmetric and
SHALL NOT be mirrored in RTL.

**Card reset line.** The rules below apply to the `UsageLimitCard` reset line:

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
- **WHEN** the group renders at mobile width with a long formatted reset label
- **THEN** the label wraps within its container and no horizontal scrollbar appears

#### Scenario: Period header reset time is reachable without a pointer
- **WHEN** a period header carries a reset time
- **THEN** its info icon is in the tab order and its accessible name states the reset time

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
