**Slicing strategy: risk-first, then vertical.** Slice 1 is the pure selection-merge contract. Slice 2 proves the riskiest assumptions on the real kit `Grid`:

- `rowSelection.enableClickSelection` merges into the kit's selection;
- Space toggling works once `suppressCellFocus: false`;
- `selectedRowIds` drives single-mode selection with no selection column.

Slice 2 then removes the catalog wrappers. Slice 3 moves the Usage table onto the `Grid`. Slices 2 and 3 are separate commits and can be reverted independently.

**Architecture guard (applies to every slice).** Neither `libs/catalog` nor `libs/usage-dashboard` may gain any of the following:

- hardcoded `/api` paths, generated-client or `server-api` imports, app contexts;
- auth, session, cookie or env access, feature flags, routing;
- analytics, telemetry or logging clients, storage keys.

`libs/usage-dashboard` must not import `ag-grid-community` or `ag-grid-react`. Relative TypeScript imports stay extensionless.

## 1. Selection merge contract (libs/catalog)

- [x] 1.1 Replace `toggleSelectedId` / `toggleAllSelectedIds` in `libs/catalog/src/utils/list-selection.ts` with one pure const-arrow helper, `mergeGridSelection(previous: ReadonlySet<string>, gridIds: ReadonlySet<string>, listedIds: readonly string[]): Set<string>`. It keeps previous ids that are hidden (not listed) or still selected, in their order, then appends newly selected grid ids in grid order. Give it JSDoc.
- [x] 1.2 Rewrite `libs/catalog/src/utils/tests/list-selection.spec.ts` around the helper's observable results. Cover: append in selection order (`{a,b}` + `c` gives `a,b,c`), checking an earlier row (`{c}` + `a` gives `c,a`), deselect keeps order, select-all with a hidden id (`{z,a}` gives `z,a,b`), clear-all keeps hidden (`{z,a,b}` gives `z`), and an empty grid result with no listed ids.
  - **Verification:** `npm run test:file -- libs/catalog/src/utils/tests/list-selection.spec.ts`

## 2. Catalog `ListView` on the kit `Grid` only (libs/catalog)

- [x] 2.1 Risk spike, kept as tests. In `libs/catalog/src/components/ListView/tests/ListView.selection.spec.tsx`, assert against the real kit `Grid` (no mock) that:
  - clicking a Name cell toggles the row through `rowSelection.enableClickSelection`;
  - Space on a focused cell toggles it once `suppressCellFocus: false`;
  - clicking the Favorite star does not toggle.
  
  Use `waitFor` for the kit's 100ms selection debounce. If any assertion cannot pass without patching the kit, stop and record a follow-up for `c:\projects\ai-dial-ui-kit` instead of adding a local workaround.
  - **Verification:** `npm run test:file -- libs/catalog/src/components/ListView/tests/ListView.selection.spec.tsx`
- [x] 2.2 Switch multiple mode in `libs/catalog/src/components/ListView/ListView.tsx` to the kit's selection:
  - pass `selectionMode={GridSelectionMode.MULTIPLE}`, `selectedRowIds`, `selectRowLabel`, `selectAllLabel`, and a `useCallback` `onSelectionChange` that calls `mergeGridSelection`;
  - toggle the row node from `onCellClicked`, skipping the Favorite and kit selection columns. This replaced `rowSelection.enableClickSelection` during apply: ag-grid's native click listener ignores the star's React `stopPropagation`.
  
  Then delete `Renders/SelectionCellRenderer.tsx`, `Renders/SelectionHeader.tsx`, `selection-context.ts`, their specs under `Renders/tests/`, and `SELECTION_COLUMN_ID`, `SELECTION_COLUMN_WIDTH` and the `isMultiSelect` parameter from `columns.ts`.
  - **Verification:** `npm run test:file -- libs/catalog/src/components/ListView/tests/ListView.selection.spec.tsx libs/catalog/src/components/ListView/tests/columns.spec.ts`
- [x] 2.3 Switch single mode:
  - pass a `useMemo` `selectedRowIds` built from `selectedItemId`, plus `rowSelection: { mode: 'singleRow', checkboxes: false, headerCheckbox: false, enableClickSelection: false }`;
  - set `suppressCellFocus: false`;
  - add an `onCellKeyDown` that calls `onItemClick` on Enter, except on the Favorite column.
  
  Remove `getRowClass`, the `redrawRows` and `refreshCells` effects, `gridApiRef`, `handleSelectionKeyDown`, `handleItemKeyDown`, `getKeyDownHandler` and the wrapper `onKeyDown` with its `eslint-disable`. The search highlight refreshes through `context.searchQuery`. Keep the `refreshCells` effect only if the highlight test below fails without it.

  Update `tests/ListView.selection.spec.tsx` ("single selection keyboard") so it reaches the cell through real focus rather than `fireEvent.keyDown` on an unfocusable node. Update `tests/ListView.spec.tsx` to assert the selected-row state through `aria-selected` on the row instead of a CSS class.
  - **Verification:** `npm run test:file -- libs/catalog/src/components/ListView/tests/ListView.spec.tsx libs/catalog/src/components/ListView/tests/ListView.selection.spec.tsx`
- [x] 2.4 Hand the whole list to the kit:
  - pass `rowData={items}`;
  - drop `domLayout: 'autoHeight'`, `animateRows`, `suppressAnimationFrame`, `suppressScrollOnNewData`, the spacers and the `useRowWindow` call;
  - keep `rowHeight: 60`.

  Delete `useRowWindow` and `RowWindow` from `libs/catalog/src/utils/scroll-window.ts`, keeping `getScrollParent`. Remove `stickyHeaderTop` from `libs/catalog/src/models/list-props.ts` and from the call sites in `libs/catalog/src/components/Catalog/Catalog.tsx` and `libs/catalog/src/components/CatalogPickerModal/CatalogPickerModal.tsx`.

  In `ListView.spec.tsx`, replace the windowing tests ("hands the grid a window…", "reserves the height…", "scrolls between bounded row windows…", "renders every row of a list shorter than the window") with one test asserting that the grid receives every item and that no spacer is rendered.
  - **Verification:** `npm run test:file -- libs/catalog/src/components/ListView/tests/ListView.spec.tsx libs/catalog/src/utils/tests/use-scroll-virtualizer.spec.tsx libs/catalog/src/components/CatalogPickerModal/tests/CatalogPickerModal.spec.tsx`
- [x] 2.5 Size the list box (design D1).
  - In `Catalog.tsx`, the list-mode wrapper becomes `flex min-h-[360px] flex-1 flex-col pb-8`, keeping the `ListMountState.Prepared` offscreen classes.
  - In `CatalogPickerModal.tsx`, the wrapper becomes `min-h-0 flex-1` with no `overflow-y-auto`.
  - Update the comment above each wrapper to match.
  - **Verification:** `npm run test:file -- libs/catalog/src/components/Catalog/tests/Catalog.spec.tsx libs/catalog/src/components/Catalog/tests/Catalog.mobile.spec.tsx libs/catalog/src/components/CatalogPickerModal/tests/CatalogPickerModal.spec.tsx`
- [x] 2.6 Move the empty state and chrome to the kit:
  - remove the `PanelEmptyState` branch, so `Grid` renders with `emptyStateTitle` (default `'No results'`) and `emptyStateDescription`;
  - put `CATALOG_CLASS.listView` on the `Grid`'s `className` and drop the `rounded-xl border` wrapper and the edge-padding arbitrary classes;
  - delete `.listContainer`, `.gridClip` and `.selectedRow` from `ListView.module.scss`.

  Remove `background`, `border`, `headerBackground`, `rowDivider`, `rowEvenBackground`, `selectedRowBorder` and `selectedRowBackground` from `ListViewColors` in `libs/catalog/src/models/list-props.ts`, and stop emitting their `--cat-list-*` variables. Also remove `selectedItemId`'s "border, tint" wording from the JSDoc in `list-props.ts` and `libs/catalog/src/models/grid-context.ts`.

  Update `ListView.spec.tsx`: the empty-state and public-class tests, and replace the zebra-override test with one asserting no `.ag-*` override is applied.
  - **Verification:** `npm run test:file -- libs/catalog/src/components/ListView/tests/ListView.spec.tsx`
- [x] 2.7 RTL check. In `ListView.selection.spec.tsx`, keep the RTL test asserting that the selection column precedes Name under `dir="rtl"`. Grep `libs/catalog/src/components/ListView/` for physical `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-` classes; none may remain.
  - **Verification:** `npm run test:file -- libs/catalog/src/components/ListView/tests/ListView.selection.spec.tsx`
- [x] 2.8 Update `libs/catalog/README.md`:
  - the `ListView` section: drop `stickyHeaderTop` and the "windows the rows itself" paragraph, describe internal scrolling, list the remaining `ListViewColors` members;
  - the multi-select section: kit selection, Space via cell focus;
  - the Overview sentence claiming both views are "windowed to the rows in view", which now applies to the card grid only.
- [x] 2.9 Run the architecture guard above over `libs/catalog`, then `npm run verify:changed`.

## 3. Usage `ModelLimitsSection` on the kit `Grid` (libs/usage-dashboard)

- [x] 3.1 Extract the domain cell renderers. Each is typed `{ data?: ModelLimitRow }`, with no ag-grid imports.
  - `ItemCell.tsx` and `StatusCell.tsx` go under `libs/usage-dashboard/src/components/ModelLimitsSection/`, moved from `ModelLimitsRow.tsx` together with the badge helpers.
  - Remove the mobile label block and `role="cell"` from `PeriodCell.tsx`.
  - Move `PeriodHeader` out of `ModelLimitsSection.tsx` into `PeriodHeader.tsx` as a header component that takes its `periodStatus`, `className` and `resetLabelClassName` through params, without `role="columnheader"`.
- [x] 3.2 Rebuild `ModelLimitsSection.tsx` on `Grid` from `@epam/ai-dial-ui-kit/grid`:
  - a `useMemo` `columnDefs` for `item`/`day`/`week`/`month`/`status`, with the per-column `minWidth`s from design D6, typed as `NonNullable<GridProps<ModelLimitRow>['columnDefs']>[number]`;
  - `defaultColDef` with sorting, filter, floating filter and resize off;
  - `domLayout: 'autoHeight'`, plus `headerHeight` and `rowHeight` per design D6;
  - `getRowId`, `withoutHeaderBorders`, `ariaLabel` set to heading plus count;
  - `emptyStateTitle={labels.emptyStateLabel}` with an empty `emptyStateDescription`.

  Keep the `h3` heading and count. Delete `ModelLimitsRow.tsx` and `MODEL_LIMITS_GRID_COLUMNS`.
- [x] 3.3 Remove `containerBackground`, `columnHeaderColor` and `rowDividerColor` from `ModelLimitsColors` in `libs/usage-dashboard/src/models/model-limits-props.ts`, and their `--mls-*` entries in `ModelLimitsSection.tsx`. Delete `.container`, `.headerRow`, `.row`, `.row:first-child`, `.columnHeader` and `.mobileColumnLabel` from `ModelLimitsSection.module.scss`, unless `PeriodHeader` still uses `.columnHeader` for its text colour token.
- [x] 3.4 Rewrite `libs/usage-dashboard/src/components/ModelLimitsSection/tests/ModelLimitsSection.spec.tsx` against the real kit `Grid`, using role and text queries (`columnheader`, `row`, `gridcell`, `progressbar`). Cover:
  - five headers in order;
  - rows in supplied order;
  - the period header's reset `<time>` and indicator;
  - the empty state with heading count `0` and no default description;
  - a grid region name that includes the count;
  - the clamped progress with the real `aria-valuetext`;
  - the type caption and cost supporting-label cases;
  - the `rowDividerColor` removal, checked at type level with `// @ts-expect-error`.

  Drop the "one responsive semantic subtree" and "vertically centers desktop row content" tests, which assert removed markup. Replace them with an RTL test that the Item column is at the inline start.
  - **Verification:** `npm run test:file -- libs/usage-dashboard/src/components/ModelLimitsSection/tests/ModelLimitsSection.spec.tsx`
- [x] 3.5 Confirm the host still renders. `apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx` passes no removed prop, so no app code changes are expected. Update the assertions in `UsageTab.spec.tsx` only if they query the former `table` role.
  - **Verification:** `npm run test:file -- apps/chat/src/pages/SettingsPage/UsageTab/tests/UsageTab.spec.tsx`
- [x] 3.6 Responsive and RTL check: logical classes only, and the 360px case has no page overflow. Use the `responsive-design` skill's parity checklist.
- [x] 3.7 Update `libs/usage-dashboard/README.md`: the `ModelLimitsSection` section, the `ModelLimitsColors` member list, and a note that the table is the ui-kit `Grid` and scrolls horizontally on narrow screens.
- [x] 3.8 Run the architecture guard above over `libs/usage-dashboard`, including the no-ag-grid-import rule, then `npm run verify:changed`.

## 4. Docs, specs and close-out

- [x] 4.1 Run `npm run validate:docs`. Fix any README import, export, class-name or link drift it reports.
- [x] 4.2 Run `npm run validate:specs` and `npm run spec:impact`. Fix any cited path that no longer exists in this change's delta specs; deleted files are referenced as "the former …".
- [x] 4.3 Run `npm run build:quiet`: bundling changes, because `usage-dashboard` now pulls in the kit grid subpath.
- [x] 4.4 Run `npm run verify:full` once.
- [x] 4.5 Follow-up, out of scope. Record (do not implement) any kit `Grid` gap found in 2.1 or 3.4, such as a missing cell focus ring or header keyboard reach, as an issue for `c:\projects\ai-dial-ui-kit`. Gaps recorded for the kit:
  - The kit `Grid` hard-sets `suppressCellFocus`, which leaves rows unreachable by keyboard. `ListView` overrides it through `additionalGridOptions`; the kit should default to cell focus, or expose a prop for it.
  - The kit has no click-to-select that respects controls inside a cell. `ListView` toggles the row from `onCellClicked`. A kit option such as `rowClickSelection` that skips interactive descendants would remove that handler.
  - The visible focus ring on a focused cell was not verified in a real browser (jsdom only). Check it during visual review; if it is missing, raise it in the kit.

## 5. Design review: "Chat table"

- [x] 5.1 Match `ModelLimitsSection` to the "Chat table" design where the chat code owns it:
  - no grid border (`wrapperBorder={false}`) inside a `rounded-xl shadow-md` card;
  - Relaxed row height (84px);
  - the version sits next to the name;
  - only the period label of a column header takes the caps class.
  - **Verification:** `npm run test:file -- libs/usage-dashboard/src/components/ModelLimitsSection/tests/ModelLimitsSection.spec.tsx`
- [x] 5.2 Add `GridAppearance.Chat` to the kit `Grid` in `c:\projects\ai-dial-ui-kit` (branch `feat/grid-chat-appearance`):
  - borderless 12px card with the MD shadow;
  - row dividers inset by the cell padding;
  - 12px hover and selected rows.

  Also remove the hover/selected top and bottom outline from every `Grid`, per the table-cell design; the hover and selected fills stay `--bg-control-accent-alpha-hover-subtle` / `--bg-control-accent-alpha-active-subtle`. Stories, spec and CHANGELOG are updated.
- [ ] 5.3 Once a kit release ships `GridAppearance`, bump `@epam/ai-dial-ui-kit` here:
  - pass `appearance={GridAppearance.Chat}` in `libs/usage-dashboard/src/components/ModelLimitsSection/ModelLimitsSection.tsx`;
  - drop the `rounded-xl shadow-md` card and `wrapperBorder={false}` there;
  - update the README and the `usage-dashboard-lib` delta spec.
  - **Verification:** `npm run test:file -- libs/usage-dashboard/src/components/ModelLimitsSection/tests/ModelLimitsSection.spec.tsx`, then `npm run verify:changed`.
