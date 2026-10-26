# catalog-list-view-grid Specification

## Purpose

The catalog `ListView` renders its items through the ui-kit `Grid` only: the table chrome, virtualization, selection states and keyboard focus come from the kit, while `libs/catalog` supplies the columns, cell renderers and the host callbacks for picking and favouriting items.

## Requirements

### Requirement: `ListView` renders every item through the ui-kit `Grid`

`ListView` (`libs/catalog/src/components/ListView/ListView.tsx`) SHALL render the 2.0 `Grid` from `@epam/ai-dial-ui-kit/grid` and pass it the full `items` array as `rowData`. Row virtualisation SHALL be the `Grid`'s own.

`ListView` SHALL NOT:

- slice `items` into a row window;
- render spacer elements standing in for off-screen rows;
- set `domLayout: 'autoHeight'`.

`useRowWindow` and `RowWindow` SHALL NOT exist in `libs/catalog/src/utils/scroll-window.ts`. `getScrollParent` stays there for `libs/catalog/src/utils/use-scroll-virtualizer.ts`.

Every row SHALL keep a fixed height of 60px, passed as `rowHeight` through `additionalGridOptions`.

This state is owned by `ListView`'s props. The lib adds no context, hook or host adapter.

#### Scenario: Grid receives the whole list

- **WHEN** `ListView` renders 500 items
- **THEN** the `Grid` receives all 500 items as `rowData`
- **AND** no spacer element precedes or follows the grid

#### Scenario: Rows keep a fixed height

- **WHEN** items with short and long names are rendered
- **THEN** every row is 60px tall

### Requirement: `ListView` scrolls inside its own box

`ListView` SHALL fill the height of its parent. The `Grid` SHALL scroll its rows vertically inside that box, and its column header SHALL stay visible at the top of the box while the rows scroll.

`ListViewProps` SHALL NOT include `stickyHeaderTop`.

- In `libs/catalog/src/components/Catalog/Catalog.tsx`, the list SHALL fill the space left below the Favorites strip, Toolbar and Tabs, with a minimum height of 360px.
- In `libs/catalog/src/components/CatalogPickerModal/CatalogPickerModal.tsx`, the list SHALL fill the popup body below the search and filter controls.

#### Scenario: Header stays visible while rows scroll

- **WHEN** the list holds more rows than fit in its box and the user scrolls the rows
- **THEN** the column header remains visible at the top of the list box

#### Scenario: Short viewport keeps a usable list

- **WHEN** the catalog renders in list mode at 360×640
- **THEN** the list box is at least 360px tall
- **AND** the page has no horizontal overflow

### Requirement: Empty list uses the `Grid` empty state

When `items` is empty, `ListView` SHALL still render the `Grid`, and the `Grid`'s own empty state SHALL show `emptyStateTitle` (default `'No results'`) and `emptyStateDescription`. `ListView` SHALL NOT render a separate `PanelEmptyState` branch.

The public class `CATALOG_CLASS.listView` SHALL mark the list's root element both with rows and when empty.

#### Scenario: Empty items

- **WHEN** `ListView` renders with `items=[]` and `emptyStateTitle="Nothing found"`
- **THEN** the grid shows "Nothing found" as its empty-state headline
- **AND** the element carrying `CATALOG_CLASS.listView` is present

### Requirement: Single-mode highlight uses the `Grid` row selection

Outside `CatalogSelectionMode.Multiple`, the row whose id equals `selectedItemId` SHALL be shown as selected in two ways:

- the `Grid`'s selected-row state, passed as `selectedRowIds` with an ag-grid `singleRow` selection that has no checkboxes, no header checkbox and no click selection;
- the check mark in its Name cell.

`ListView` SHALL NOT draw the selected row through `getRowClass` or a custom outline class, and SHALL NOT force a row redraw when `selectedItemId` changes.

#### Scenario: Selected item is marked

- **WHEN** `ListView` renders items `a`, `b` with `selectedItemId="b"`
- **THEN** only row `b` has ag-grid's selected-row state
- **AND** only row `b`'s Name cell shows the check mark
- **AND** no selection column is rendered

### Requirement: Rows can be picked from the keyboard

`ListView` SHALL enable ag-grid cell focus by passing `suppressCellFocus: false` through `additionalGridOptions`, so the arrow keys move between cells.

In single mode with `onItemClick` set, pressing Enter on a focused cell SHALL call `onItemClick(item)` through ag-grid's `onCellKeyDown`. This SHALL NOT apply on the Favorite column, whose star button handles its own keys.

`ListView` SHALL NOT attach a delegated `onKeyDown` handler to a wrapper element.

#### Scenario: Enter picks a row

- **WHEN** a cell of row "Beta" has keyboard focus and the user presses Enter
- **THEN** `onItemClick` is called with the "Beta" item

#### Scenario: Other keys do not pick

- **WHEN** a cell of row "Beta" has keyboard focus and the user presses `a`
- **THEN** `onItemClick` is not called

### Requirement: Table chrome comes from the `Grid` theme

`ListView` SHALL style the table frame, header, row dividers, row background and selected-row tint only through the `Grid` theme and its documented props (`appearance`, `wrapperBorder`, `withoutHeaderBorders`, `alternateOddRowColors`). It SHALL pass `appearance={GridAppearance.Chat}`, so the kit draws the borderless 12px card with the MD shadow and the inset row dividers. `libs/catalog/src/components/ListView/ListView.module.scss` SHALL NOT target ag-grid's internal `.ag-*` classes, except to right-align the Favorite column header.

`ListViewColors` SHALL contain only `starFilled`, `folderIcon` and `selectedRowCheckIcon`. It SHALL NOT contain `background`, `border`, `headerBackground`, `rowDivider`, `rowEvenBackground`, `selectedRowBorder` or `selectedRowBackground`.

#### Scenario: Removed colour members are rejected

- **WHEN** a consumer passes `styles={{ colors: { rowDivider: '#000' } }}` to `ListView`
- **THEN** TypeScript reports `rowDivider` as an unknown property of `ListViewColors`

#### Scenario: Cell-content colours still apply

- **WHEN** a consumer passes `styles={{ colors: { folderIcon: '#7c3aed' } }}`
- **THEN** the folder cell's icon uses `#7c3aed`

### Requirement: Direction follows the document

The ag-grid column order and horizontal scroll SHALL follow `document.documentElement.dir`. `ListView` cell renderers SHALL use only logical spacing classes and SHALL NOT mirror any icon.

#### Scenario: Right-to-left document

- **WHEN** `document.documentElement.dir` is `rtl`
- **THEN** the Name column renders at the inline start of the grid
- **AND** no `ListView` renderer uses a physical `ml-`, `mr-`, `pl-`, `pr-`, `left-` or `right-` class
