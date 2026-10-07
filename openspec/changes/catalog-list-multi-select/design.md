## Context

`ListView` (`libs/catalog/src/components/ListView/ListView.tsx`) renders the ui-kit `Grid` from `@epam/ai-dial-ui-kit/grid`. Because the table scrolls with the page (`domLayout: 'autoHeight'`), `ListView` windows the rows itself with `useRowWindow`, and `Grid` only ever receives the visible slice as `rowData`.

Cell renderers read per-render data from `gridOptions.context` (`GridContext`). The single-select highlight is drawn through `getRowClass` plus `redrawRows()` whenever `selectedItemId` changes.

## Goals / Non-Goals

**Goals:** an opt-in, host-controlled multi-select whose select-all and checked state are correct across the whole `items` list, despite windowing.

**Non-Goals:** multi-select in other catalog views; uncontrolled mode; disabled rows; range selection.

## Decisions

### D1. Own selection column instead of `Grid`'s `selectionMode`
`Grid`'s selection is stored on ag-grid row nodes and reported through a debounced `selectionChanged` event. Its `SelectionHeader` counts `forEachNodeAfterFilter`, which means the windowed nodes only. With windowing that gives a select-all that covers about 20 rows, and a selection that is forgotten when rows leave the window. `ListView` therefore adds its own leading column, with the same 2.0 `Checkbox` the kit uses, and derives everything from `items` and `selectedItemIds`.

### D2. Selection state through a lib-internal React context
- `ListSelectionContext` (`selection-context.ts`, not exported) carries:
  - `selectedIds`;
  - `toggle(id)` and `toggleAll()`;
  - the computed header state (`isAllSelected`, `isSomeSelected`, `isEmpty`);
  - the two label resolvers.
- `ListView` provides it with a `useMemo`'d value.
- **Why a context:** AG Grid React (v35) renders header and cell components as React portals inside `AgGridReact`, so the context reaches them and they re-render when the selection changes.
- **Why not `gridOptions.context`:** routing selection through it would need `refreshCells` plus `refreshHeader` on every toggle, and would rebuild `gridOptions`.
- The column definitions stay stable: `CATALOG_COLUMNS` gains only a boolean `isMultiSelect` parameter.

### D3. Ordering
`toggle` and `toggleAll` build a new `Set` from `selectedItemIds`, appending or deleting. A `Set` keeps insertion order, so hosts that need the selection order (e.g. "existing first, then newly added") read it from the set's iteration order without extra API.

### D4. Row click and keyboard
- **Mouse:** `onCellClicked` toggles the row unless the clicked column is the selection column (the checkbox handles that click) or the star column.
- **Keyboard:** Space is handled by an `onKeyDown` on the grid's wrapper. It reads the row from the `row-id` attribute AG Grid stamps on each row (from `getRowId`), skips events whose target is an `input` (a focused checkbox toggles itself), and calls `preventDefault`. `onCellKeyDown` was tried first and dropped: AG Grid only fires it for the cell its own focus service holds, which is unreliable and untestable in jsdom.
- `onItemClick` keeps firing on row clicks.

### D5. Single-select highlight off in multiple mode
`getRowClass` and the context's `selectedItemId` are suppressed when `selectionMode` is `Multiple`, so a row is never marked with both a check mark and a checkbox.

## Risks / Trade-offs

- [A future ag-grid upgrade stops rendering components as portals] → The integration spec renders the real `Grid` and asserts that the header and row checkboxes reflect the context, so a regression fails CI.
- [The host passes a new `Set` on every render] → `toggle`/`toggleAll` depend on it, but the column definitions do not, so only the visible checkboxes re-render.

## Migration Plan

Additive. Release a new `@epam/ai-dial-catalog` version; hosts opt in. Rollback = revert.
