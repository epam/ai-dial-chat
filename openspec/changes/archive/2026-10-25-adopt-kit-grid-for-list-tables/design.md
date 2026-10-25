## Context

Two library tables duplicate the `@epam/ai-dial-ui-kit` 2.0 `Grid`. The kit `Grid` is exported from `@epam/ai-dial-ui-kit/grid`; the installed version is `0.16.0-dev.36` and its source is at `c:\projects\ai-dial-ui-kit\src\components\New\Grid\Grid.tsx`.

**Catalog `ListView`** (`libs/catalog/src/components/ListView/ListView.tsx`). It already mounts the kit `Grid`, but around it:

- **Row window.** `domLayout: 'autoHeight'` makes the table scroll with the page, and that switches off ag-grid's own virtualisation. To compensate, `useRowWindow` (`utils/scroll-window.ts`) slices `items` to the rows near the viewport, with spacer `div`s standing in for the rest.
- **Custom selection column.** `SelectionCellRenderer` and `SelectionHeader` read `ListSelectionContext` (`selection-context.ts`), which is fed by `toggleSelectedId` / `toggleAllSelectedIds` (`utils/list-selection.ts`). Because the grid only holds the windowed rows, the kit's own selection could never be used: select-all would have seen only the window.
- **Delegated keyboard handlers.** `handleSelectionKeyDown` (Space) and `handleItemKeyDown` (Enter/Space) sit on a wrapper `div`. The kit sets `suppressCellFocus`, so no cell can actually take focus and these handlers can't be reached with the keyboard. The tests fire `keyDown` on a `gridcell` directly, which hides that.
- **Custom chrome.**
  - `ListView.module.scss` overrides ag-grid's chrome: a sticky `.ag-header` at `--list-header-sticky-top`, a clip-path, row dividers, `.ag-row-even` zebra, and the `.selectedRow` outline and tint.
  - Seven `--cat-list-*` variables carry `ListViewColors`.
  - `getRowClass` plus a `redrawRows` effect draw the single-mode highlight.

**Usage `ModelLimitsSection`** (`libs/usage-dashboard/src/components/ModelLimitsSection/`):

- A hand-built `div role="table"` with a five-track Tailwind grid template (`MODEL_LIMITS_GRID_COLUMNS` in `ModelLimitsRow.tsx`).
- The header row is `desktop:grid` only. Each `PeriodCell` carries a duplicate mobile label and reset line for the stacked mobile layout.
- Rows are few: one per deployment with usage.

**User decisions (from the proposal):**

- The kit `Grid` is used at every width, and Usage scrolls horizontally on mobile.
- Catalog uses the kit's built-in virtualisation, so the table scrolls inside its own box.
- Catalog uses kit selection plus a thin merge that keeps selection order and the hidden selected ids.
- Table-chrome colour props are removed.

## Goals / Non-Goals

**Goals:**

- Both tables render through the kit `Grid` with only `ColDef`s, cell/header renderers for domain content, and documented `GridProps` / `additionalGridOptions`.
- Delete every wrapper the kit makes redundant: windowing, custom selection column, delegated key handlers, the hand-built ARIA table, the mobile duplicate labels, and the ag-grid chrome SCSS.
- Keep the public selection contract of `catalog-list-selection`: selection order and preservation of hidden ids.
- Leave keyboard access at least as good as today. In practice it gets better, because the kit's own cell focus becomes reachable.

**Non-Goals:**

- Changing the kit `Grid`. Any gap is raised upstream in `c:\projects\ai-dial-ui-kit`, not patched locally.
- Adding sorting or filtering (both stay off), or changing `CardGrid`, `ExtensionsSection` or the `libs/chat-hooks` usage adapters.
- New strings (no i18n keys), new endpoints, feature flags, telemetry or caching. None apply.

## Decisions

### D1. Catalog gets the whole list; the kit virtualises

**Decision.**

- `ListView` passes `rowData={items}` and drops `domLayout: 'autoHeight'`, `useRowWindow`, the spacers, `animateRows: false`, `suppressAnimationFrame` and `suppressScrollOnNewData`.
- The `Grid` fills its parent (`size-full`). ag-grid's sticky header and row virtualisation replace the custom ones.
- `rowHeight: 60` stays through `additionalGridOptions`; it overrides the kit's 40.

**Layout in `Catalog.tsx`.**

- The list wrapper becomes a flex child that fills the rest of the catalog scroll body: `flex min-h-[360px] flex-1 flex-col`, keeping `pb-8`. The `Grid` takes that height.
- When Favorites, Toolbar and Tabs leave less than 360px (short mobile viewports), the outer scroll body scrolls first. That nested scroll is accepted.
- The `ListMountState.Prepared` offscreen pre-mount stays unchanged.

**Layout in `CatalogPickerModal.tsx`.** The wrapper loses `overflow-y-auto` and keeps `min-h-0 flex-1`.

**Other consequences.**

- `stickyHeaderTop` is removed from `ListViewProps`, and both in-repo call sites stop passing it.
- `useRowWindow` and `RowWindow` are deleted from `utils/scroll-window.ts`. `getScrollParent` is kept, because `utils/use-scroll-virtualizer.ts` imports it.

**Alternative.** Keep the page-scroll window. Rejected by the user: it forces the custom selection layer to stay (see Context).

### D2. Multi-select is the kit's selection, plus one merge step

**Decision.** In `CatalogSelectionMode.Multiple`, `ListView` passes:

- `selectionMode={GridSelectionMode.MULTIPLE}`
- `selectedRowIds={selectedItemIds}`
- `selectRowLabel={selectRowAriaLabel}`
- `selectAllLabel={selectAllAriaLabel}`
- `onSelectionChange={(kitIds) => onSelectionChange(mergeGridSelection(selectedItemIds, kitIds, listedIds))}`

**The merge helper.** `mergeGridSelection` replaces the two toggle helpers in `utils/list-selection.ts`. It is pure:

1. Keep each previous id that is either not in `listedIds` (hidden by the host) or still in `kitIds`, in its previous order.
2. Append the ids from `kitIds` that were not in the previous set, in the order ag-grid reports them (`items` order).

Both `catalog-list-selection` scenarios come out of this. Select-all over `{z, a}` with listed `a, b` gives `z, a, b`. Clear-all over `{z, a, b}` gives `z`.

**Row click and keys.**

- A row click toggles in ag-grid's native `onCellClicked`, through `event.node.setSelected(!isSelected, false, 'rowClicked')`. The kit reports any source except `api`, so the merge step receives it. That handler skips the Favorite column and the kit's own selection column (`GRID_SELECTION_COLUMN_ID`).
  - *Changed during apply:* the plan was `rowSelection.enableClickSelection`. ag-grid listens to the native DOM click, so the star's React `stopPropagation` cannot stop that toggle. Only a column check inside `onCellClicked` can exclude the star.
- `onItemClick` keeps firing from `onCellClicked`, which is ag-grid's native event, not a DOM delegate.
- With cell focus on (D4), Space on a focused cell toggles the row through ag-grid's native row-selection key handling, which replaces `handleSelectionKeyDown`.

**Deleted.** `SelectionCellRenderer`, `SelectionHeader`, `selection-context.ts`, `SELECTION_COLUMN_ID`, `SELECTION_COLUMN_WIDTH`, the `isMultiSelect` parameter of `CATALOG_COLUMNS`, and `toggleSelectedId` / `toggleAllSelectedIds` with their spec. The kit draws the selection column, the `mixed` select-all, and disables select-all when there are no rows.

**Memoisation.**

- `listedIds` stays `useMemo` over `items`.
- The `onSelectionChange` passed to the `Grid` is `useCallback`. The kit reads callbacks through a ref, so even a new identity does not rebuild columns, but a stable one keeps tests deterministic.

**Alternative.** Pure kit output, with ids in row order and hidden ids dropped. Rejected by the user: it breaks the documented host contract.

### D3. Single-mode highlight uses ag-grid row selection without a column

**Decision.**

- When not in multi mode, `ListView` passes `selectedRowIds={selectedItemId ? new Set([selectedItemId]) : EMPTY}`, memoised on `selectedItemId`.
- It also passes `rowSelection: { mode: 'singleRow', checkboxes: false, headerCheckbox: false, enableClickSelection: false }`. With no `selectionMode` the kit renders no selection column and forwards this object unchanged.
- The kit's `selectedRowIds` effect selects the node with source `api`, which its handler deliberately does not report back, and the kit theme's `selectedRowBackgroundColor` tints the row.
- The `NameCellRenderer` check mark stays; it reads `context.selectedItemId`.

**Deleted.** `getRowClass`, the `redrawRows` effect, and `.selectedRow`.

**Visible change.** The 1px accent outline goes. The selected row is marked by the kit tint and the check mark.

### D4. Enable ag-grid cell focus and use native key events

**Decision.**

- `additionalGridOptions.suppressCellFocus = false`, so arrow-key cell navigation works.
- In single mode, `onCellKeyDown` calls `onItemClick(data)` on Enter, except on the Favorite column.
- Both wrapper `onKeyDown` handlers and their `eslint-disable` are removed.

**Why.** Today's delegated handlers can't be reached (Context), so this closes a real keyboard gap and meets the WCAG 2.1.1 requirement in `.claude/rules/a11y.md`, while using only ag-grid/kit mechanisms.

**Alternative.** Keep the cells unfocusable and rely on Tab to the row checkbox. That would leave single mode with no keyboard path to pick a row, so it was rejected.

### D5. Catalog chrome is the kit theme's

**Decision.**

- `withoutHeaderBorders` stays.
- `ListView.module.scss` is reduced to cell-content rules: `.favHeader`, `.starFilledIcon`, `.folderIcon`, `.selectedCheck`, `.starToggleOff`, `.name` and `.version`.
- `.listContainer`, `.gridClip` and `.selectedRow` are deleted, together with the edge-padding arbitrary classes on the wrapper.
- The `rounded-xl border` wrapper is replaced by the kit's `wrapperBorder` (default `true`).

**Colour props.**

- `ListViewColors` keeps `starFilled`, `folderIcon` and `selectedRowCheckIcon`.
- It loses `background`, `border`, `headerBackground`, `rowDivider`, `rowEvenBackground`, `selectedRowBorder` and `selectedRowBackground`, and `ListView` stops emitting the matching `--cat-list-*` variables.
- Zebra rows, previously an SCSS override, become the kit's `alternateOddRowColors` only if design asks for them; the default is off (Open Question 1).

**Empty state.** The `items.length === 0` branch with `PanelEmptyState` goes. The `Grid` renders its `NoDataContent` overlay from `emptyStateTitle` (default `'No results'`, kept) and `emptyStateDescription`. The `CATALOG_CLASS.listView` stamp moves to the `Grid`'s `className`, so the public class still marks the list box in both states.

### D6. Usage table is a kit `Grid` with domain renderers

**Columns.** `ModelLimitsSection` builds `columnDefs` (memoised on `labels`, `periodStatuses` and `typography`) for five columns:

| Column | `colId` | Cell renderer |
| --- | --- | --- |
| Item | `item` | `ItemCell`: the identity block moved out of `ModelLimitsRow` (avatar via `DeploymentIcon`, type caption, name, version) |
| Today | `day` | `PeriodCell` reading `data.day` |
| This week | `week` | `PeriodCell` reading `data.week` |
| This month | `month` | `PeriodCell` reading `data.month` |
| Status | `status` | `StatusCell`: the badge logic moved out of `ModelLimitsRow` |

`PeriodCell` loses its mobile label block. Its Tokens `MetricCell` and its `CostValue` are unchanged.

**Headers.**

- Item and Status use plain `headerName`.
- The three period columns use a `headerComponent`, `PeriodHeader` (already present in `ModelLimitsSection.tsx`), which renders the label, the reset `<time>` with its sr-only spoken form, and `PeriodStatusIndicator`. It receives its `periodStatus` through `headerComponentParams`.

**Grid options.**

- `domLayout: 'autoHeight'`: the row count is small, so the table grows with its content and the Usage page keeps a single vertical scroll.
- `headerHeight` and `rowHeight` are raised to fit the two-line header and the progress-plus-cost cell, for example `headerHeight: 56` and `rowHeight: 88`. They are fixed numbers, not `autoHeight` per column, so ag-grid needs no measuring pass.
- `defaultColDef: { sortable: false, filter: false, floatingFilter: false, resizable: false }`.
- `minWidth` per column, roughly Item 192px, periods 160px and Status 128px. Together they exceed 360px, so at mobile widths the kit's `overflow-x-auto` box scrolls horizontally while the page does not.
- `getRowId={(row) => row.id}`.
- `withoutHeaderBorders`, which also satisfies "no vertical column borders".
- `ariaLabel={`${labels.headingLabel} ${rows.length}`}`.
- The empty state is the `Grid`'s `emptyStateTitle={labels.emptyStateLabel}`, with `emptyStateDescription` set to an empty string so the kit's English default line is not shown. The `h3` heading and count stay outside the grid.

**Types without a new dependency.**

- Column defs are typed `NonNullable<GridProps<ModelLimitRow>['columnDefs']>[number]`.
- Renderers type their props as `{ data?: ModelLimitRow }` (and `{ periodStatus, ... }` for headers).
- No `ag-grid-community` import is added to `libs/usage-dashboard`, so its manifest and `docs/host-install-matrix.md` stay unchanged.

**Deleted.** `ModelLimitsRow.tsx` (its content moves into `ItemCell` and `StatusCell`), `MODEL_LIMITS_GRID_COLUMNS`, the `role="table|row|rowgroup|columnheader|cell"` markup, and the `.container`, `.headerRow`, `.row` and `.mobileColumnLabel` SCSS rules. `ModelLimitsColors` loses `containerBackground`, `columnHeaderColor` and `rowDividerColor`.

**Alternative.** Kit `Grid` on desktop and keep the cards on mobile. Rejected by the user (see proposal).

### D7. Accessibility and RTL

**Semantics and keyboard.**

- ag-grid exposes `role="grid"` / `row` / `columnheader` / `gridcell` inside the kit's named `region`. That replaces the hand-built `table` roles; both are valid tabular semantics.
- The period progress bars keep their period-specific `aria-label` / `aria-valuetext`.
- `PeriodStatusIndicator` stays focusable inside the header. It already handles its own focus and tooltip, and ag-grid header keyboard navigation reaches header components.

**Direction.**

- ag-grid mirrors column order and the horizontal scroll under `dir="rtl"`, because the kit `Grid` reads the document direction.
- Renderers keep logical classes only. No icon is mirrored: status icons and the star are direction-agnostic.

**Contrast.** Unchanged for cell content. Chrome contrast is the kit theme's.

## Risks / Trade-offs

- **[Visual change] Catalog list scrolls inside its own box.** The header no longer sticks to the page, and the selected-row outline and zebra rows disappear. → This is the user's explicit decision. List it in the PR description with before/after screenshots.
- **[Nested scroll on short viewports]** The catalog body and the grid both scroll when less than 360px remain. → Keep the `min-h-[360px]` floor and verify at 360×640 with the `responsive-design` skill.
- **[Kit selection is debounced by 100ms]** `onSelectionChange` fires after a tick. → Tests use `waitFor` / fake timers. Host UX is unaffected (it was already asynchronous through React state).
- **[`suppressCellFocus: false` overrides a kit default]** The kit's focus ring styling for cells may be minimal. → Verify the visible focus indicator. If it is missing, raise it upstream in `ai-dial-ui-kit` instead of adding local SCSS.
- **[Fixed Usage row height]** Very long names or wrapped reset lines could clip. → The name already truncates with a `title`, and the version uses `EllipsisTooltip`. Choose `rowHeight` / `headerHeight` from the design, and cover the longest reset string in a test.
- **[Breaking public API]** `stickyHeaderTop` and the removed colour members are gone. → Both libs are `private` at `0.0.1`, and in-repo call sites are updated in the same change. READMEs are updated, and `npm run validate:docs` guards the examples.

## Migration Plan

1. Land the catalog slice (D1–D5) and the usage slice (D6) as separate commits, so either can be reverted alone.
2. No data migration, endpoint or flag. Rollback is `git revert` of the slice.

## Open Questions

1. **Catalog zebra rows.** Today the list has a custom `.ag-row-even` tint. Should the kit's `alternateOddRowColors` keep alternating rows, or should the list match the kit default (no zebra)? This design assumes no zebra; it is a one-prop change either way.
2. **Usage row and header heights.** The exact `rowHeight` / `headerHeight` should come from the Figma frame if one exists. Otherwise use the D6 example values and confirm in visual review.
