## Why

`libs/catalog` ships production UI but contains three stub implementations that silently no-op at runtime — `clearAllFilters`, the filter-active guard, and the about-content fetch — plus near-zero test coverage (one spec file for 69 source files). Closing these gaps is prerequisite work before the filter chip UX and about-content tab can be shipped correctly.

## What Changes

- **Complete the filter-active state tracking** in `Catalog.tsx`: replace the `// TODO: determine if any filter is active` stub with real logic derived from the filter state passed via `CatalogProps`.
- **Implement `clearAllFilters`** in `Catalog.tsx`: replace the no-op stub with a callback that resets all active filter keys to their default values and notifies the parent.
- **Export `CatalogSortOption`** from `libs/catalog/src/index.ts` — it is defined in `models/sort.ts` but not re-exported, forcing consumers to import from the internal path.
- **Wire `onFetchAboutContent`** in `apps/chat/src/components/CatalogView/CatalogView.tsx`: replace the `Promise.resolve(undefined)` placeholder with a real API call through `server-api`.
- **Add test coverage** for `ListView`, `Toolbar`, `Filter`, `catalog-filter.ts` utility, and `catalog-sort.ts` utility — currently untested.

## Capabilities

### New Capabilities

- `catalog-filter-active-state`: Active filter state tracking and `clearAllFilters` wiring inside the `Catalog` component and the `CatalogProps` contract.
- `catalog-about-content-fetch`: Real implementation of the about-content fetch from the app layer through a `server-api` adapter, replacing the `Promise.resolve(undefined)` stub.
- `catalog-lib-unit-tests`: Unit test suites for `ListView`, `Toolbar`, `Filter` components and the `catalog-filter` / `catalog-sort` utilities in `libs/catalog`.

### Modified Capabilities

- `catalog-query-filtering`: The `CatalogProps` interface gains `onClearFilters?: () => void` and `isAnyFilterActive?: boolean` fields to support the new active-state and clear wiring (additive, non-breaking).

## Impact

- `libs/catalog/src/models/catalog-props.ts` — adds `onClearFilters` and `isAnyFilterActive` fields.
- `libs/catalog/src/components/Catalog/Catalog.tsx` — removes three TODO stubs; uses the new props.
- `libs/catalog/src/index.ts` — adds `CatalogSortOption` to exports.
- `apps/chat/src/components/CatalogView/CatalogView.tsx` — replaces `Promise.resolve(undefined)` with a real API call.
- `apps/chat/src/server-api/` — new or extended function for fetching entity about-content.
- No breaking changes; all `CatalogProps` additions are optional fields.
