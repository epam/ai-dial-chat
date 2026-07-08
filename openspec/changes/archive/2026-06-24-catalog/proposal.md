## Why

`libs/catalog` shipped production UI with three stub implementations that silently no-op at runtime — `clearAllFilters`, the filter-active guard, and the Filter component body — plus near-zero test coverage (one spec file for 69 source files). Closing these gaps makes the filter chip UX fully operational.

## What Changes

- **Complete the filter-active state tracking** in `Catalog.tsx`: replace the `// TODO: determine if any filter is active` stub with real logic derived from `filters` and `isMyAppsActive` state.
- **Implement `clearAllFilters`** in `Catalog.tsx`: replace the no-op stub with a callback that resets `filters` and `isMyAppsActive` to their defaults.
- **Implement `Filter.tsx`**: My Apps toggle + alphabetically sorted topic checkboxes inside a `DialDropdown`, with an active-state label.
- **Export `CatalogSortOption`** from `libs/catalog/src/index.ts` — it is defined in `models/sort.ts` but was not re-exported.
- **Set `isMyApp` in `mapDeploymentToCatalogItem`**: populate `CatalogItem.isMyApp` from `deployment.isMy ?? false` so the My Apps filter reflects the deployment's personal-folder flag.
- **Add test coverage** for `ListView`, `Toolbar`, `Filter`, `catalog-filter.ts` utility, and `catalog-sort.ts` utility — currently untested.

## Capabilities

### New Capabilities

- `catalog-filter-active-state`: Active filter state tracking (`filters`, `isMyAppsActive`, `isAnyFilterActive`, `clearAllFilters`) and full `Filter` component implementation (My Apps toggle + topic checkboxes) inside `libs/catalog`.
- `catalog-lib-unit-tests`: Unit test suites for `ListView`, `Toolbar`, `Filter` components and the `catalog-filter` / `catalog-sort` utilities in `libs/catalog`.

### Modified Capabilities

- `catalog-query-filtering`: `ToolbarProps` gains `filters?`, `onFiltersChange?`, `filterValues?`, `isMyAppsActive?`, `onMyAppsChange?`, `filterFromLabel?`, `filterMyAppsLabel?`, `filterTopicsLabel?`; `CatalogTitles` gains corresponding label fields. All additive, non-breaking.

## Impact

- `libs/catalog/src/models/catalog-item.ts` — adds `isMyApp?: boolean` field.
- `libs/catalog/src/models/catalog-props.ts` — adds label fields to `CatalogTitles`.
- `libs/catalog/src/models/toolbar-props.ts` — adds filter-related props.
- `libs/catalog/src/components/Filter/Filter.tsx` — full implementation.
- `libs/catalog/src/components/Toolbar/Rows/FilterRow.tsx` — wired to live `Filter`.
- `libs/catalog/src/components/Catalog/Catalog.tsx` — removes TODO stubs; adds filter pipeline.
- `libs/catalog/src/index.ts` — adds `CatalogSortOption` to exports.
- `apps/chat/src/utils/map-deployment-to-catalog-item.ts` — sets `isMyApp` from `deployment.isMy`.
- No breaking changes; all additions are optional fields.
