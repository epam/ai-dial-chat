## Why

The two list tables in the product, the catalog `ListView` (browse page and `CatalogPickerModal`) and the Usage page's "Model limits" table (`ModelLimitsSection`), each carry their own table machinery. That machinery duplicates what `@epam/ai-dial-ui-kit`'s 2.0 `Grid` already provides.

- **Catalog.** `ListView` does render the kit `Grid` (`libs/catalog/src/components/ListView/ListView.tsx:345`), but wraps it in:
  - a row-windowing layer: `useRowWindow`, spacer `div`s and `domLayout: 'autoHeight'`;
  - its own selection column: `SelectionCellRenderer`, `SelectionHeader` and `selection-context.ts`;
  - two delegated keyboard handlers;
  - roughly 100 lines of SCSS that override ag-grid's chrome (sticky header, clip-path, row dividers, zebra rows, selected-row outline).
- **Usage.** `ModelLimitsSection` hand-builds an ARIA table from `div role="table|row|cell"` with a Tailwind grid template, `MODEL_LIMITS_GRID_COLUMNS` (`libs/usage-dashboard/src/components/ModelLimitsSection/ModelLimitsRow.tsx:18`). It also keeps a separate stacked mobile layout with duplicated per-period labels (`PeriodCell.tsx:84`).

Every one of these layers is something the kit `Grid` already does: virtualisation, selection with a `mixed` select-all, the empty state, row/header theming and RTL. The duplicates have drifted from the design system and have to be re-tuned on every ag-grid or kit upgrade. The request is to use only the kit and delete the extra code.

## What Changes

**Catalog `ListView` (`libs/catalog`)**

- The kit `Grid` receives every item and virtualises the rows itself.
  - The table scrolls inside its own box, and its column header sticks within that box.
  - `useRowWindow` and the spacers go, and so do `domLayout: 'autoHeight'` and the animation/scroll suppression options that only existed for the window.
  - `getScrollParent` stays, because `use-scroll-virtualizer.ts` still uses it for the card grid.
- **BREAKING** `ListViewProps.stickyHeaderTop` is removed.
- Multi-select uses the kit's own selection: `selectionMode={GridSelectionMode.MULTIPLE}`, `selectedRowIds`, `onSelectionChange`, `selectRowLabel` and `selectAllLabel`, with click-to-select toggling the row node from ag-grid's `onCellClicked`.
  - `SelectionCellRenderer`, `SelectionHeader`, `selection-context.ts`, the `SELECTION_COLUMN_ID` column and both delegated `onKeyDown` handlers are deleted.
  - A small merge step in `ListView` keeps the public selection contract, so hosts are unaffected: ids are reported in selection order, and selected ids the host filtered out of `items` are preserved.
- Single mode keeps the `selectedItemId` highlight. It is drawn through the kit's selected-row styling instead of the custom `.selectedRow` outline.
- The empty list renders the kit `Grid`'s own empty state (`emptyStateTitle` / `emptyStateDescription`) instead of a separate `PanelEmptyState` branch.
- **BREAKING** The table-chrome members of `ListViewColors` are removed, together with their `--cat-list-*` variables and SCSS overrides: `background`, `border`, `headerBackground`, `rowDivider`, `rowEvenBackground`, `selectedRowBorder` and `selectedRowBackground`. The kit `Grid` theme owns those colours. The cell-content colours `starFilled`, `folderIcon` and `selectedRowCheckIcon` stay.

**Usage `ModelLimitsSection` (`libs/usage-dashboard`)**

- The hand-built `div role="table"` is replaced by the kit `Grid`.
  - Item, Today, This week, This month and Status become `ColDef` columns with cell renderers built from the existing `MetricCell`, `PeriodCell` content and status badge.
  - The period headers, with their reset line and `PeriodStatusIndicator`, become a header component.
- The same grid renders at every width. On mobile it scrolls horizontally inside its own box, and the page itself never scrolls horizontally.
  - **BREAKING (spec)** This replaces the stacked mobile layout. `ModelLimitsRow`, `MODEL_LIMITS_GRID_COLUMNS`, the per-period mobile labels in `PeriodCell` and the `.mobileColumnLabel`, `.row` and `.headerRow` SCSS rules are deleted.
- The empty state, with its heading and `0` count still visible, comes from the `Grid` empty state instead of a separate `PanelEmptyState`.
- **BREAKING** The table-chrome members of `ModelLimitsColors` are removed, together with their `--mls-*` variables: `containerBackground`, `columnHeaderColor` and `rowDividerColor`. The content colours (name, version, value, progress, indicator, badge) stay.

**Not changing**

- No host app passes `stickyHeaderTop` from outside the lib, or any of the removed colour members, so `apps/chat` needs no code changes.
- No new user-visible strings. No i18n impact.

## Capabilities

### New Capabilities

- `catalog-list-view-grid`: how the catalog `ListView` renders through the kit `Grid`. Covers internal virtualised scrolling, the empty state, the single-mode highlight, and the colour contract that remains.

### Modified Capabilities

- `catalog-list-selection`: the selection column, checkboxes and select-all are the kit `Grid`'s own. The lib-internal selection context requirement is dropped. Space-on-cell toggling is replaced by the kit's keyboard model. Selection order and hidden-id preservation are kept through the merge step.
- `usage-dashboard-lib`: `ModelLimitsSection` renders through the kit `Grid` with ag-grid's `grid` semantics. The stacked mobile layout becomes horizontal scrolling inside the table box. `ModelLimitsColors` loses its chrome members.

## Problem / Solution / Non-goals

- **Problem:** two parallel table implementations duplicate the kit `Grid` and have drifted from it.
- **Solution:** use the kit `Grid` directly and delete the wrappers. A wrapper stays only where it carries an existing, documented public contract: the selection-order merge.
- **Non-goals:**
  - Changing the kit `Grid` itself. If a gap is found, it is fixed upstream in `c:\projects\ai-dial-ui-kit` and released as a package, not patched here.
  - Changing the card (`CardGrid`) view or `ExtensionsSection`.
  - Changing the Usage adapters in `libs/chat-hooks`.
  - Adding column sorting or filtering. Both stay off, as today.

## Alternatives considered

1. **Baseline: keep everything, only remove dead SCSS.** Rejected. It leaves both duplicate implementations in place, which is what the request asks to remove.
2. **Catalog: keep row windowing with page scroll.** Rejected (user decision). The kit's selection only knows the rows in `rowData`, so the custom selection layer would have to stay. Kit-native virtualisation removes both the window and the selection layer.
3. **Usage: kit `Grid` on desktop, stacked cards on mobile.** Rejected (user decision). It needs two component trees, which the current spec forbids, and keeps most of the code this change removes.
4. **Catalog selection: pure kit output.** Rejected (user decision). It would silently break hosts that rely on selection order and on hidden ids being preserved. A merge of about 15 lines keeps that contract.

## Library isolation

No host or external knowledge enters either lib.

- Both libs already declare `@epam/ai-dial-ui-kit` as a peer, and `libs/catalog` already depends on `ag-grid-community`.
- `libs/usage-dashboard` needs no new dependency. Column types are derived from the kit's own `GridProps<T>['columnDefs']`, and the cell renderers type only the `data` field they read, so no `ag-grid-community` import is added.
- Labels, rows and statuses still come from the host through props.

## Rollback / backward compatibility

- **Breaking for lib consumers:** `stickyHeaderTop` and the removed colour members no longer exist. In-repo consumers are updated in this change: `Catalog.tsx` and `CatalogPickerModal.tsx` pass `stickyHeaderTop={0}`. Both libs are `private` at version `0.0.1`, so there is no external semver contract to bump.
- **Rollback:** revert the change commits. No data, API or storage migration is involved.

## Impact

- **`libs/catalog`:**
  - Code: `components/ListView/**`, `utils/scroll-window.ts` (drop `useRowWindow` and `RowWindow`), `utils/list-selection.ts` (replaced by the merge helper), `models/list-props.ts`, `models/grid-context.ts`, `components/Catalog/Catalog.tsx`, `components/CatalogPickerModal/CatalogPickerModal.tsx`, `index.ts`.
  - Tests and README.
- **`libs/usage-dashboard`:**
  - Code: `components/ModelLimitsSection/**`, `models/model-limits-props.ts`, `index.ts`.
  - Tests and README.
- **Specs:** `catalog-list-selection` and `usage-dashboard-lib` are modified; `catalog-list-view-grid` is new.
- **Docs:** both lib READMEs; `docs/architecture.md` only if it names the removed windowing.

## Acceptance criteria

- `ListView` contains no `useRowWindow`, spacer, `selection-context`, `SelectionCellRenderer`, `SelectionHeader` or ag-grid chrome SCSS. Multi-select passes the selection-order and hidden-id scenarios.
- `ModelLimitsSection` renders one kit `Grid`. `ModelLimitsRow` and `MODEL_LIMITS_GRID_COLUMNS` no longer exist, and at 360px the page has no horizontal overflow.
- `npm run validate:docs` and `npm run validate:specs` pass, and lint, test and build pass for `catalog`, `usage-dashboard` and `chat`.
