# catalog-list-selection Specification

## Purpose

Opt-in, host-controlled multi-select for the catalog `ListView`: a checkbox per row, a select-all header and selection-order reporting, so hosts can pick several catalog items without rebuilding the list.

## Requirements

### Requirement: `ListView` exposes a selection mode

`ListViewProps` (`libs/catalog/src/models/list-props.ts`) SHALL include:

- `selectionMode?: CatalogSelectionMode`,
- `selectedItemIds?: ReadonlySet<string>`,
- `onSelectionChange?: (ids: Set<string>) => void`,
- `selectRowAriaLabel?: (item: CatalogItem) => string`,
- `selectAllAriaLabel?: string`.

`@epam/ai-dial-catalog`'s root entry point SHALL export the string enum `CatalogSelectionMode` with the members `Single = 'single'` and `Multiple = 'multiple'`. Omitting `selectionMode` SHALL mean `Single`.

The selection is controlled. The host owns the selected set, and `ListView` keeps no selection state of its own: it passes `selectedItemIds` to the ui-kit `Grid` as `selectedRowIds`.

The lib performs no translation. The two label props carry English defaults, `` `Select ${item.name}` `` and `'Select all'`, which hosts override with translated strings. There is no backend endpoint, no feature-flag gating and no telemetry.

#### Scenario: Enum and props are public

- **WHEN** a consumer imports from `@epam/ai-dial-catalog`
- **THEN** `CatalogSelectionMode` is importable as a value
- **AND** `ListViewProps` accepts `selectionMode`, `selectedItemIds`, `onSelectionChange`, `selectRowAriaLabel` and `selectAllAriaLabel`

#### Scenario: Single mode renders no selection column

- **WHEN** `ListView` renders without `selectionMode`, or with `CatalogSelectionMode.Single`
- **THEN** it renders no selection column
- **AND** `selectedItemId` marks its row through the `Grid`'s selected-row state and the Name-cell check mark, as the `catalog-list-view-grid` capability defines

### Requirement: Multiple mode renders a checkbox per row and a select-all header

With `selectionMode={CatalogSelectionMode.Multiple}`, `ListView` SHALL pass `selectionMode={GridSelectionMode.MULTIPLE}` to the ui-kit `Grid`. The selection column is the `Grid`'s own, rendered first, before Name.

- **Rows:** each row's control is the `Grid`'s 2.0 `Checkbox`. It is checked when the row's id is in `selectedItemIds`, and its accessible name is `selectRowAriaLabel(item)`, passed as the `Grid`'s `selectRowLabel`.
- **Header:** the `Grid`'s select-all `Checkbox` is named by `selectAllAriaLabel`, passed as `selectAllLabel`. It is:
  - checked when every listed item is selected,
  - mixed (`aria-checked="mixed"`) when some but not all are,
  - unchecked when none is.
- **No single-select highlight:** `selectedItemId` SHALL be ignored in multiple mode.

`ListView` SHALL NOT define its own selection cell renderer, selection header component or selection React context.

#### Scenario: Checked state follows the selected set

- **WHEN** `items` holds `a`, `b` and `c`, and `selectedItemIds` is `{b}`
- **THEN** only `b`'s checkbox is checked
- **AND** the select-all checkbox is mixed

#### Scenario: Rows virtualised back in keep their state

- **WHEN** a selected row scrolls out of the grid's rendered rows and back in
- **THEN** its checkbox is checked again without any host action

#### Scenario: Selection labels

- **WHEN** a host passes `selectRowAriaLabel={(item) => \`Pick ${item.name}\`}` and `selectAllAriaLabel="Pick all"`
- **THEN** the row checkbox of an item named "Web Search" is named "Pick Web Search"
- **AND** the select-all checkbox is named "Pick all"

### Requirement: Multiple mode reports selection changes in selection order

In multiple mode, `ListView` SHALL call `onSelectionChange` with a new `Set` each time the ui-kit `Grid` reports a selection change. The `Grid` reports ids in row order, so `ListView` SHALL first merge that result with `selectedItemIds` through a pure helper in `libs/catalog/src/utils/list-selection.ts`:

- an id selected before and still selected keeps its earlier position;
- a newly selected id is appended after the ids already selected;
- a deselected id is removed, and the other ids keep their order;
- an id in `selectedItemIds` that is not in `items` is kept.

**What toggles a row:**

- activating a row's checkbox;
- clicking any other cell of the row except the Favorite star cell, toggled on the row node from ag-grid's `onCellClicked`;
- pressing Space while one of the row's cells has ag-grid keyboard focus.

**`onItemClick`:** a row click still calls `onItemClick` when it is provided.

#### Scenario: Toggling preserves order

- **WHEN** `selectedItemIds` is `{a, b}` and the user checks `c`
- **THEN** `onSelectionChange` is called with a set whose iteration order is `a, b, c`
- **AND** unchecking `a` next (with `selectedItemIds` now `{a, b, c}`) reports `b, c`

#### Scenario: Selecting an earlier row appends it

- **WHEN** `items` is `a, b, c`, `selectedItemIds` is `{c}`, and the user checks `a`
- **THEN** `onSelectionChange` is called with `c, a`

#### Scenario: Row click and Space toggle

- **WHEN** the user clicks the Name cell of an unselected row, or focuses one of its cells and presses Space
- **THEN** `onSelectionChange` is called with that row's id added
- **AND** clicking the row's checkbox itself toggles it exactly once

#### Scenario: Star click does not toggle

- **WHEN** the user clicks the Favorite star of an unselected row
- **THEN** `onSelectionChange` is not called

### Requirement: Select-all acts on the listed items only

Activating the select-all checkbox SHALL work as follows.

- **Not every listed item selected:** it adds every id in `items` that is not yet selected, in `items` order, after the ids already selected.
- **Every listed item selected:** it removes the ids in `items`.
- **In both cases:** ids in `selectedItemIds` that are not in `items` SHALL be kept. These are items a host filtered out of the list.

#### Scenario: Select all with a hidden selection

- **WHEN** `items` is `a, b`, `selectedItemIds` is `{z, a}` (`z` is filtered out by the host), and the user activates select-all
- **THEN** `onSelectionChange` is called with `z, a, b`

#### Scenario: Clear all listed

- **WHEN** `items` is `a, b`, `selectedItemIds` is `{z, a, b}`, and the user activates select-all
- **THEN** `onSelectionChange` is called with `z`

### Requirement: Selection column follows the document direction

The `Grid`'s selection column SHALL sit at the inline start of the table: on the left in LTR and on the right under `dir="rtl"`, as AG Grid orders columns. `ListView` adds no selection-column markup, so no physical-direction class can come from the catalog lib.

The row checkboxes SHALL be reachable with the keyboard, both with Tab and through ag-grid cell navigation, which `ListView` enables (`suppressCellFocus: false`).

#### Scenario: Right-to-left document

- **WHEN** `document.documentElement.dir` is `rtl`
- **THEN** the selection column precedes Name in DOM order

#### Scenario: Keyboard reaches a row checkbox

- **WHEN** the user moves keyboard focus into the grid in multiple mode
- **THEN** each row checkbox can receive focus and be toggled with Space
