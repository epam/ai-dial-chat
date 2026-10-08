## Why

`ListView` (`libs/catalog/src/components/ListView/ListView.tsx`) can mark only one row, through `selectedItemId`. Hosts that let a user pick several catalog items in one go — the QuickApps editor's "Add skill" popup is the first — need a checkbox per row and a select-all control. Today they would have to rebuild the list, losing the catalog's columns, folder rendering, search highlighting and row windowing.

## What Changes

- `ListView` gets an opt-in multi-select mode: `selectionMode={CatalogSelectionMode.Multiple}`.
  - A leading selection column with a ui-kit 2.0 `Checkbox` per row.
  - A select-all `Checkbox` in that column's header. It is checked when every listed item is selected, mixed when some are, and empty otherwise.
  - Clicking a row (outside the checkbox and star cells), or pressing Space on a focused row cell, toggles that row.
- The selection is controlled by the host:
  - `selectedItemIds: ReadonlySet<string>` holds the selection;
  - `onSelectionChange(ids: Set<string>)` reports the next selection. New ids are appended, so the set's iteration order is the order the user selected items in.
- Select-all covers every item in `items`, not just the rows currently windowed into the grid. Selected ids that are not in `items` (filtered out by the host) are left untouched.
- Accessible names come from the new props `selectRowAriaLabel(item)` (default `` `Select ${item.name}` ``) and `selectAllAriaLabel` (default `'Select all'`).
- In multiple mode, the single-select highlight (accent border, tint, check mark from `selectedItemId`) is not drawn.
- New exported enum `CatalogSelectionMode { Single = 'single', Multiple = 'multiple' }`. `Single` is the default, and it keeps today's behaviour exactly.

## Non-goals

- Multi-select in `CardGrid`, `Favorites` or the composite `Catalog` component.
- Uncontrolled selection. The host always owns the selected set.
- Disabled (non-selectable) rows, and shift-click range selection.

## Alternatives considered

- *ui-kit `Grid`'s built-in `selectionMode={GridSelectionMode.MULTIPLE}`* (`@epam/ai-dial-ui-kit/grid`). Rejected: its selection lives on ag-grid row nodes. `ListView` hands the grid only the windowed slice of rows (`useRowWindow`), so select-all and `onSelectionChange` would see only the rows on screen, and scrolling would drop the selection of rows that leave the window.
- *Let the host render its own checkbox column through a new `extraColumns` prop.* More general, but it exposes ag-grid `ColDef` in the public API, which the lib keeps internal (`columns.ts`). Rejected.
- *Keep `ListView` single-select and build the picker in the host* (conservative baseline). Rejected: it duplicates the catalog list and drifts from it.

## Acceptance criteria

- Without `selectionMode`, or with `Single`, `ListView` renders and behaves exactly as before. All existing specs pass unchanged.
- With `Multiple`, every row has a checkbox named by `selectRowAriaLabel`, and the header has a select-all checkbox named by `selectAllAriaLabel`.
- Checking a row's box, clicking the row, or pressing Space on a row cell calls `onSelectionChange` with that id added (or removed). Ids that were already selected keep their order.
- Select-all with a partial selection adds every id in `items` that is not yet selected, in list order. With every listed item selected, it removes the listed ids only. Its state is checked, mixed or empty to match.
- After scrolling a long list, rows windowed back in show their correct checked state.
- RTL: the selection column is the first column at the inline start. Nothing is mirrored.

## Capabilities

### New Capabilities
- `catalog-list-selection`: row selection in the catalog `ListView`, covering the existing single highlight and the new controlled multi-select mode.

### Modified Capabilities
<!-- none: no existing spec covers ListView selection -->

## Impact

- **Lib:** `libs/catalog` only.
  - New: `src/types/selection-mode.ts`, `src/components/ListView/selection-context.ts`, `src/components/ListView/Renders/SelectionCellRenderer.tsx`, `src/components/ListView/Renders/SelectionHeader.tsx`.
  - Changed: `ListView.tsx`, `columns.ts`, `src/models/list-props.ts`, `src/index.ts` (export `CatalogSelectionMode`) and `README.md`.
- **Library isolation:** the lib still knows nothing about the host. The selection set, the change callback and every label arrive as props; persistence and the meaning of the selection stay in the host (e.g. the QuickApps `AddSkillsModal`).
- **Apps:** no change. `apps/chat` keeps single-select.
- **i18n:** no keys in the lib, per the "No i18n inside libs" rule. Two new English-default label props, `selectRowAriaLabel` and `selectAllAriaLabel`, are translated by hosts.
- **Dependencies:** none new. `Checkbox` comes from the already-required `@epam/ai-dial-ui-kit`.
- **Backward compatibility:** additive and opt-in. Rollback = revert the commit; hosts that never pass `selectionMode` are unaffected.
