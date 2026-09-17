## 1. Types and public API surface

- [x] 1.1 Add `CatalogEmptyStateContext` interface to `libs/catalog/src/models/catalog-props.ts` (fields: `query: string`, `activeTab: string`, `hasTopicFilters: boolean`, `isMyAppsActive: boolean`), with JSDoc on the interface and each field per `libs.md`.
- [x] 1.2 Add `renderEmptyState?: (context: CatalogEmptyStateContext) => ReactNode;` to `CatalogProps` in the same file, documented with a JSDoc comment describing when it is called and the default fallback behavior.
- [x] 1.3 Export `CatalogEmptyStateContext` as a type from `libs/catalog/src/index.ts`, alongside the existing `CatalogProps`/`CatalogTitles` export line.

## 2. `Catalog` dispatch logic

- [x] 2.1 In `libs/catalog/src/components/Catalog/Catalog.tsx`, destructure `renderEmptyState` from props.
- [x] 2.2 Build the `CatalogEmptyStateContext` object from the already-resolved locals (`query`, `activeTab`, `filters.size > 0` for `hasTopicFilters`, `isMyAppsActive`), colocated next to the `tabFiltered`/`emptyTitle` derivation (around `Catalog.tsx:442`) so the mapping stays visible next to the filter pipeline it reads from.
- [x] 2.3 Compute the custom empty-state node once per render (e.g. `const customEmptyState = tabFiltered.length === 0 ? renderEmptyState?.(emptyStateContext) : undefined`), guarded so it is only invoked when `tabFiltered.length === 0` — never during the `isLoading` early return (already unconditionally returns before this point) and never when items are present.
- [x] 2.4 Replace the shared content wrapper (`Catalog.tsx:560-622`, the `div` currently holding the `CardGrid` wrapper and the conditional `ListView` wrapper) so that when `customEmptyState != null`, it renders that node alone in the slot instead of the `CardGrid`/`ListView` markup; otherwise render the existing `CardGrid`/`ListView` structure unchanged.
- [x] 2.5 Verify the container's existing conditional classes keyed on `tabFiltered.length > 0` (`Catalog.tsx:562-573`) still apply correctly for the custom-empty-state branch (i.e. the empty-state sizing/padding classes, not the populated-grid classes).

## 3. Verification

- [x] 3.1 Add/update unit tests for `Catalog` (co-located per its existing test layout) covering: prop omitted renders default empty state; prop returns `null`/`undefined` falls back to default; prop returns a node and it renders exactly once regardless of `viewMode`; switching `viewMode` while the custom node is shown does not duplicate it; context fields match internal state; context fields match externally-controlled props (`activeTab`, `filterTopics`, `isMyAppsActive`); `activeTab` is `''` when no tab is active; custom state disappears once the result set becomes non-empty; `isLoading` takes precedence over an empty result set.
- [x] 3.2 Add/confirm existing `CardGrid` and `ListView` tests still pass unmodified, confirming neither gained a new prop and standalone empty-state rendering is unaffected.
- [x] 3.3 Run `npm exec nx test catalog`, `npm exec nx lint catalog`, and `npm exec nx typecheck catalog` (or the lean-verification skill's changed-slice equivalent) for the affected slice.

## 4. Documentation

- [x] 4.1 Add a new `README.md` subsection under `### Catalog` in `libs/catalog/README.md` documenting `renderEmptyState` and `CatalogEmptyStateContext`, with a minimal compiling example (mirroring the "Overriding the Browse heading" subsection's style) and a note on re-render frequency (called on every render while the result set stays empty, same as `titles.noResultsTitle`).
- [x] 4.2 Run `npm run validate:docs` to confirm the new README example and type export are consistent with the actual public API.
