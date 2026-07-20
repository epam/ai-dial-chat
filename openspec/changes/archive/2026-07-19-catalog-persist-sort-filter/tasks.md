## 1. Catalog lib: controlled sort/filter props

- [x] 1.1 Add `sortKey?`, `onSortChange?`, `filterTopics?`, `onFilterTopicsChange?` to `CatalogProps` in `libs/catalog/src/models/catalog-props.ts` with JSDoc (including defaults) on each.
- [x] 1.2 In `libs/catalog/src/components/Catalog/Catalog.tsx`, derive effective `sortKey`/`filters` from `props.sortKey ?? internalSortKey` and `props.filterTopics ?? internalFilters`; call both the internal setter and the optional prop callback on change.
- [x] 1.3 Update/add unit tests for `Catalog` covering uncontrolled (default) behavior and controlled `sortKey`/`filterTopics` behavior per the spec scenarios.

## 2. App hook: useCatalogSortFilterPreference

- [x] 2.1 Create `apps/chat/src/hooks/useCatalogSortFilterPreference/useCatalogSortFilterPreference.ts`, built on the existing `useLocalStorage` hook, implementing validate/fallback for `sortKey` (`StorageKey.CatalogSortKey`) and `filterTopics` (`StorageKey.CatalogFilterTopics`).
- [x] 2.2 Add JSDoc explaining why persistence lives at the app edge (library isolation) per AGENTS.md.
- [x] 2.3 Add unit tests in `apps/chat/src/hooks/useCatalogSortFilterPreference/tests/useCatalogSortFilterPreference.spec.ts` covering all scenarios in `specs/catalog-sort-filter-persistence/spec.md` (no persisted value, valid restore, invalid/malformed fallback, persist-on-change, storage-write failure).

## 3. Wire into CatalogView

- [x] 3.1 In `apps/chat/src/components/CatalogView/CatalogView.tsx`, call `useCatalogSortFilterPreference` and compute the reconciled `filterTopics` via `useMemo` (intersection with the union of `catalogItems` topics).
- [x] 3.2 Pass `sortKey`, `onSortChange={setSortKey}`, `filterTopics={reconciledFilterTopics}`, `onFilterTopicsChange={setFilterTopics}` to `Catalog`, gated behind `!isSelectorMode`.
- [x] 3.3 Add/update `CatalogView` tests covering: persisted values applied on mount, stale topic dropped when absent from current items, and sort change updates the hook's setter.
- [x] 3.4 Confirm `CatalogModal` (`apps/chat/src/components/DeploymentSelector/CatalogModal.tsx`) is left unchanged and its existing tests still pass unmodified.
