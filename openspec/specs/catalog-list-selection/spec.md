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

The selection is controlled: the host owns the selected set, and `ListView` keeps no selection state of its own. The lib performs no translation. The two label props carry English defaults, `` `Select ${item.name}` `` and `'Select all'`, which hosts override with translated strings. There is no backend endpoint, no feature-flag gating and no telemetry.

#### Scenario: Enum and props are public

- **WHEN** a consumer imports from `@epam/ai-dial-catalog`
- **THEN** `CatalogSelectionMode` is importable as a value
- **AND** `ListViewProps` accepts `selectionMode`, `selectedItemIds`, `onSelectionChange`, `selectRowAriaLabel` and `selectAllAriaLabel`

#### Scenario: Single mode is unchanged

- **WHEN** `ListView` renders without `selectionMode`, or with `CatalogSelectionMode.Single`
- **THEN** it renders no selection column
- **AND** `selectedItemId` keeps drawing the selected-row border, tint and check mark exactly as before

### Requirement: Multiple mode renders a checkbox per row and a select-all header

With `selectionMode={CatalogSelectionMode.Multiple}`, `ListView` SHALL render a selection column as its first column, before Name.

- **Rows:** each row's cell holds a ui-kit 2.0 `Checkbox`. It is checked when the row's id is in `selectedItemIds`, and its accessible name is `selectRowAriaLabel(item)`.
- **Header:** the column header holds a select-all `Checkbox` named by `selectAllAriaLabel`. It is:
  - checked when every id in `items` is selected,
  - mixed (`isIndeterminate`, exposed as `aria-checked="mixed"`) when some but not all are,
  - unchecked when none is,
  - disabled when `items` is empty.
- **No single-select highlight:** the `selectedItemId` border, tint and check mark SHALL NOT be drawn in multiple mode.

The selection state SHALL reach the row and header cells through a lib-internal React context provided by `ListView`, with its value memoised. That way a change to `selectedItemIds` re-renders the checkboxes of the rows in view, and the column definitions do not change.

#### Scenario: Checked state follows the selected set

- **WHEN** `items` holds `a`, `b` and `c`, and `selectedItemIds` is `{b}`
- **THEN** only `b`'s checkbox is checked
- **AND** the select-all checkbox is mixed

#### Scenario: Rows windowed back in keep their state

- **WHEN** a row that was selected scrolls out of the rendered window and back in
- **THEN** its checkbox is checked again without any host action

#### Scenario: Selection labels

- **WHEN** a host passes `selectRowAriaLabel={(item) => \`Pick ${item.name}\`}` and `selectAllAriaLabel="Pick all"`
- **THEN** the row checkbox of an item named "Web Search" is named "Pick Web Search"
- **AND** the select-all checkbox is named "Pick all"

### Requirement: Multiple mode reports selection changes in selection order

In multiple mode, `ListView` SHALL call `onSelectionChange` with a new `Set`.

- **Selecting** an id appends it after the ids already selected.
- **Deselecting** an id removes it and keeps the other ids in their order.
- **What toggles a row:**
  - activating a row's checkbox;
  - clicking any other cell of the row, except the Favorite star cell;
  - pressing Space while a cell of that row has focus (and the focus is not already on the checkbox).
- **`onItemClick`:** a row click still calls `onItemClick` when it is provided.

#### Scenario: Toggling preserves order

- **WHEN** `selectedItemIds` is `{a, b}` and the user checks `c`
- **THEN** `onSelectionChange` is called with a set whose iteration order is `a, b, c`
- **AND** unchecking `a` next (with `selectedItemIds` now `{a, b, c}`) reports `b, c`

#### Scenario: Row click and Space toggle

- **WHEN** the user clicks the Name cell of an unselected row, or focuses one of its cells and presses Space
- **THEN** `onSelectionChange` is called with that row's id added
- **AND** clicking the row's checkbox itself toggles it exactly once

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

The selection column SHALL sit at the inline start of the table: on the left in LTR and on the right under `dir="rtl"`, as AG Grid orders columns. It SHALL use only logical spacing, and it mirrors no icon. Its checkboxes SHALL be reachable with the keyboard through the grid's cell navigation.

#### Scenario: Right-to-left document

- **WHEN** `document.documentElement.dir` is `rtl`
- **THEN** the selection column precedes Name in DOM order
- **AND** no selection-column element uses a physical `ml-`, `mr-`, `pl-`, `pr-`, `left-` or `right-` class
