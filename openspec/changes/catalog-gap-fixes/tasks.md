## 1. Library — Export & Cleanup

- [ ] 1.1 Add `export type { CatalogSortOption } from './models/sort'` to `libs/catalog/src/index.ts`
- [ ] 1.2 Remove the `// TODO: check details` comment from `Catalog.tsx:113` (implementation is correct; comment is stale)

## 2. Library — Filter State Wiring

- [ ] 2.1 In `libs/catalog/src/models/toolbar-props.ts`, add optional fields `fromChecked?: Set<string>` and `onFromChange?: (checked: Set<string>) => void` to `ToolbarProps`
- [ ] 2.2 In `libs/catalog/src/components/Toolbar/Toolbar.tsx`, accept and forward `fromChecked` and `onFromChange` props to `FilterRow`
- [ ] 2.3 In `libs/catalog/src/components/Toolbar/Rows/FilterRow.tsx`, accept `fromChecked` and `onFromChange` and forward them to `<Filter>`
- [ ] 2.4 In `libs/catalog/src/components/Catalog/Catalog.tsx`, add `fromChecked` state (`useState<Set<string>>(new Set())`), derive `allFromIds` from items, compute `isAnyFilterActive = fromChecked.size > 0 && fromChecked.size < allFromIds.size`, and implement `clearAllFilters` with `useCallback(() => setFromChecked(new Set()), [])`
- [ ] 2.5 In `Catalog.tsx`, pass `fromChecked`, `onFromChange={setFromChecked}`, `isAnyFilterActive`, and `onClearFilters={clearAllFilters}` to `<Toolbar>`
- [ ] 2.6 Remove the `// TODO: implement when filters are added` and `// TODO: determine if any filter is active` comments from `Catalog.tsx`
- [ ] 2.7 Run `npm exec nx lint ai-dial-catalog` and fix any lint errors

## 3. App — About-Content Fetch

- [ ] 3.1 Create `apps/chat/src/server-api/catalog.api.ts` exporting `fetchEntityAboutContent(id: string): Promise<string | undefined>` that calls `GET /api/v1/catalog/{id}/about` via the generated API client, returns the `content` string on 200, and returns `undefined` on 404
- [ ] 3.2 In `apps/chat/src/components/CatalogView/CatalogView.tsx`, replace the `Promise.resolve(undefined)` stub with `fetchEntityAboutContent(item.id)` imported from `@/server-api/catalog.api`
- [ ] 3.3 Remove the `// TODO: replace with a real API call` comment and the `/* eslint-disable @typescript-eslint/no-empty-function */` directive from `CatalogView.tsx` if no empty functions remain
- [ ] 3.4 Run `npm exec nx lint chat` and fix any lint errors

## 4. Tests — Utilities

- [ ] 4.1 Create `libs/catalog/src/utils/catalog-filter.spec.ts` with tests for `filterCatalogItems` covering: empty query returns all, name match (case-insensitive), description match, no match returns empty
- [ ] 4.2 Create `libs/catalog/src/utils/catalog-sort.spec.ts` with tests for `sortCatalogItems` covering: NameAZ, Newest, RecentlyUpdated, unknown key

## 5. Tests — Components

- [ ] 5.1 Create `libs/catalog/src/components/Toolbar/tests/Toolbar.spec.tsx` covering: title renders, Clear-all hidden when `isAnyFilterActive=false`, Clear-all visible when `isAnyFilterActive=true`, `onClearFilters` fires on click
- [ ] 5.2 Create `libs/catalog/src/components/ListView/tests/ListView.spec.tsx` with ag-grid mocked; cover: renders without crashing, empty state title shown, `onToggleFavorite` called when star is toggled

## 6. Verification

- [ ] 6.1 Run `npm exec nx test ai-dial-catalog` — all tests pass
- [ ] 6.2 Run `npm exec nx typecheck ai-dial-catalog` — no type errors
- [ ] 6.3 Run `npm exec nx typecheck chat` — no type errors from the CatalogView changes
- [ ] 6.4 Run `npm exec nx build ai-dial-catalog` — build succeeds and `CatalogSortOption` is present in the dist type declarations
