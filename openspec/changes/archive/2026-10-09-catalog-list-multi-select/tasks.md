Slicing strategy: **risk-first**. Slice 1 proves the riskiest assumption first — that a React context reaches AG Grid's header and cell components in the real `Grid` while rows are windowed. Slice 2 adds the click, keyboard and select-all behaviour on top. Slice 3 covers the public API and docs.

Architecture guard (all slices): `libs/catalog` gains no host knowledge. There are no `/api` paths, no i18n, no app contexts and no storage. The selection, the change callback and all labels arrive as props.

## 1. Selection column renders from a context (risk-first)

- [x] 1.1 Add `libs/catalog/src/types/selection-mode.ts` with the JSDoc'd string enum `CatalogSelectionMode { Single = 'single', Multiple = 'multiple' }`.
- [x] 1.2 Add `libs/catalog/src/components/ListView/selection-context.ts`:
  - `ListSelectionContext` with its value interface;
  - a `useListSelection()` hook that throws outside the provider.
  - It is lib-internal: not exported from `index.ts`.
- [x] 1.3 Add `libs/catalog/src/components/ListView/Renders/SelectionCellRenderer.tsx` (row `Checkbox`) and `Renders/SelectionHeader.tsx` (select-all `Checkbox` with checked/mixed/disabled states). Both read `useListSelection()`.
- [x] 1.4 Extend `CATALOG_COLUMNS` in `libs/catalog/src/components/ListView/columns.ts` with a trailing `isMultiSelect = false` parameter. When it is set, prepend the selection column: `colId: 'selection'`, fixed width, not sortable or resizable, `headerComponent: SelectionHeader`, `cellRenderer: SelectionCellRenderer`.
- [x] 1.5 Add the props to `ListViewProps` (`libs/catalog/src/models/list-props.ts`) with JSDoc. In `ListView.tsx`:
  - compute the context value with `useMemo` from `items`, `selectedItemIds`, `onSelectionChange` and the labels;
  - wrap the grid in the provider;
  - pass `isMultiSelect` to `CATALOG_COLUMNS`;
  - suppress `selectedItemId` and `getRowClass` in multiple mode.
- [x] 1.6 Tests:
  - `libs/catalog/src/components/ListView/Renders/tests/SelectionCellRenderer.spec.tsx` and `Renders/tests/SelectionHeader.spec.tsx`: checked state, mixed/empty/full/disabled header states, accessible names, and calling `toggle`/`toggleAll`.
  - `libs/catalog/src/components/ListView/tests/ListView.selection.spec.tsx`: renders the **real** `Grid`, and asserts that the header and row checkboxes reflect `selectedItemIds` and update on rerender.
  - `columns.spec.ts`: the selection column comes first only when `isMultiSelect` is set.
  - Verification: `npm exec nx -- test @epam/ai-dial-catalog -- src/components/ListView`, `npm exec nx -- lint @epam/ai-dial-catalog`, `npm exec nx -- typecheck @epam/ai-dial-catalog`.

## 2. Toggle, select-all and keyboard behaviour

Depends on 1.

- [x] 2.1 In `selection-context.ts` / `ListView.tsx`, implement `toggle` (append or delete, order kept) and `toggleAll` (add the missing listed ids in `items` order, or remove all listed ids; ids that are not listed are kept). Both are wrapped in `useCallback`.
- [x] 2.2 In `ListView.tsx`'s `gridOptions`:
  - `onCellClicked` toggles in multiple mode, except in the selection and star columns, and still calls `onItemClick`;
  - Space on a row cell toggles that row: handled by an `onKeyDown` on the grid wrapper from the row's `row-id` (see design D4), skipped when the target is an `input`, with `preventDefault`.
- [x] 2.3 Tests in `ListView.selection.spec.tsx`:
  - checking `c` on `{a, b}` reports `a, b, c`;
  - unchecking keeps order;
  - a Name-cell click toggles and still calls `onItemClick`;
  - clicking a checkbox toggles once;
  - Space on a focused cell toggles;
  - select-all adds the missing ids in order and keeps hidden ids;
  - select-all with everything selected clears only the listed ids;
  - a single-mode render is unchanged, with no checkbox and the `selectedItemId` highlight still drawn.
  - Verification: as in 1.6.

## 3. Public API and docs

Depends on 2.

- [x] 3.1 Export `CatalogSelectionMode` from `libs/catalog/src/index.ts`, next to `CatalogViewMode`.
- [x] 3.2 Update the `### ListView` section of `libs/catalog/README.md` with a multi-select example: `selectionMode`, `selectedItemIds`, `onSelectionChange` and the two label props, plus a note that select-all covers every `items` entry and that iteration order is selection order.
- [x] 3.3 RTL check: the selection column cells use only logical classes. Add an assertion to `ListView.selection.spec.tsx` that the selection column precedes Name under `dir="rtl"`.
- [x] 3.4 Final verification:
  - `npm exec nx -- run-many -t lint,typecheck,test,build -p @epam/ai-dial-catalog`;
  - `npm run validate:docs`;
  - `npm run validate:specs`;
  - `openspec validate catalog-list-multi-select --strict`.
