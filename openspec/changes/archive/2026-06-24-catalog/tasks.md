## 1. Library — Export & Cleanup

- [x] 1.1 Add `export type { CatalogSortOption } from './models/sort'` to `libs/catalog/src/index.ts`
- [x] 1.2 Remove the `// TODO: check details` comment from `Catalog.tsx` (implementation is correct; comment is stale)
- [x] 1.3 Set `isMyApp: deployment.isMy ?? false` in `apps/chat/src/utils/map-deployment-to-catalog-item.ts`

## 2. Library — Filter Implementation ✅ Done

- [x] 2.1 Add `isMyApp?: boolean` to `CatalogItem` in `libs/catalog/src/models/catalog-item.ts`
- [x] 2.2 Implement `Filter.tsx`: My Apps `DialCheckbox` + alphabetically sorted topic `DialCheckbox` list, `getFilterButtonLabel` helper, `toggleTopic` helper, active-label CSS class
- [x] 2.3 Add overlay/row/separator/sectionLabel/topicList styles to `Filter.module.scss`
- [x] 2.4 Update `FilterRow.tsx`: remove commented-out `<FromFilter>`, wire live `<Filter>` with all filter props
- [x] 2.5 Add `filters?`, `onFiltersChange?`, `filterValues?`, `isMyAppsActive?`, `onMyAppsChange?`, `filterFromLabel?`, `filterMyAppsLabel?`, `filterTopicsLabel?` to `ToolbarProps`
- [x] 2.6 Forward all new filter props from `Toolbar.tsx` to `FilterRow`
- [x] 2.7 Add `filters`, `isMyAppsActive` state to `Catalog.tsx`; derive `allFilterValues`; implement `topicFiltered → myAppsFiltered` pipeline; implement `clearAllFilters`; derive `isAnyFilterActive = filters.size > 0 || isMyAppsActive`
- [x] 2.8 Pass all filter state and label props from `Catalog.tsx` to `<Toolbar>`
- [x] 2.9 Add `clearAllLabel?`, `filterFromLabel?`, `filterMyAppsLabel?`, `filterTopicsLabel?` to `CatalogTitles` in `catalog-props.ts`
- [x] 2.10 Run `npm exec nx lint ai-dial-catalog` and fix any lint errors

## 4. Tests — Utilities

- [x] 4.1 Create `libs/catalog/src/utils/catalog-filter.spec.ts` covering `filterCatalogItems`: empty query returns all, name match (case-insensitive), description match, type match, no match returns empty
- [x] 4.2 Create `libs/catalog/src/utils/catalog-sort.spec.ts` covering `sortCatalogItems`: NameAZ alphabetical, featured items first, Newest by `updatedAt` descending, items without `updatedAt` last, RecentlyUpdated preserves original order, unknown key returns original order

## 5. Tests — Components

- [x] 5.1 Create `libs/catalog/src/components/Filter/tests/Filter.spec.tsx` covering: My Apps checkbox renders, topics list renders alphabetically, checking topic calls onChange, button label — only myApps, topics, both; active CSS class when filter on
- [x] 5.2 Create `libs/catalog/src/components/Toolbar/tests/Toolbar.spec.tsx` covering: title renders, Clear-all hidden when `isAnyFilterActive=false`, Clear-all visible when `isAnyFilterActive=true`, `onClearFilters` fires on click
- [x] 5.3 Create `libs/catalog/src/components/ListView/tests/ListView.spec.tsx` with ag-grid mocked; cover: renders without crashing, empty state title shown, `onToggleFavorite` called when star is toggled

## 6. Verification

- [ ] 6.1 Run `npm exec nx test ai-dial-catalog` — all tests pass
- [ ] 6.2 Run `npm exec nx typecheck ai-dial-catalog` — no type errors
- [ ] 6.3 Run `npm exec nx typecheck chat` — no type errors from the CatalogView changes
- [ ] 6.4 Run `npm exec nx build ai-dial-catalog` — build succeeds and `CatalogSortOption` is present in the dist type declarations
