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

Each period header component SHALL render the column label, the reset line when `resetLabel` is set, and the `PeriodStatusIndicator`. It receives that period's `ModelLimitPeriodStatus` through `headerComponentParams`.

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

#### Scenario: Header carries reset line and indicator

- **WHEN** `periodStatuses.day` has `status: LimitReached` and `resetLabel: 'Resets Sep 16, 2026, 2:00 AM GMT+2'`
- **THEN** the day column header renders the day label, a `<time>` holding the reset label, and the error `PeriodStatusIndicator`

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
