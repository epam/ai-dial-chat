## Context

`libs/catalog` is a host-agnostic React library. It manages all catalog state internally (query, sort, view mode, entity-type tab, filter). The app layer (`apps/chat/src/components/CatalogView`) wires the catalog to real data sources and API calls via props and callbacks.

Three stubs silently no-op at runtime today:

1. **`clearAllFilters` (Catalog.tsx:161–162)** — the function body is empty. The `fromChecked` filter state does not exist yet; the `Filter` component (`Filter.tsx`) has its tree-checkbox body commented out, but the `FilterRow` already expects the `isAnyFilterActive` / `onClearFilters` contract to work.
2. **`isAnyFilterActive` (Catalog.tsx:183–184)** — hardcoded to `false`.
3. **`fetchAboutContent` (CatalogView.tsx:47–50)** — always resolves `undefined`; the backend endpoint does not exist yet.

Additionally `CatalogSortOption` is defined in `models/sort.ts` but missing from `index.ts`, and the library has near-zero test coverage (1 spec file for 69 sources).

## Goals / Non-Goals

**Goals:**
- Add `fromFilter: Set<string>` state to `Catalog.tsx`; derive `isAnyFilterActive` from it; implement `clearAllFilters` to reset it.
- Pass `fromChecked` / `onFromChange` through `Toolbar` → `FilterRow` → `Filter` so the commented-out `FromFilter` slot has correct wiring when the tree-checkbox UI is completed.
- Export `CatalogSortOption` from `libs/catalog/src/index.ts`.
- Remove the no-longer-needed `// TODO: check details` comment (the `pendingItemIdRef` pattern is correct as-is).
- Implement `onFetchAboutContent` in `CatalogView` using a new `server-api` adapter function that calls `GET /api/v1/catalog/{id}/about`.
- Add Vitest unit tests for `catalog-filter.ts`, `catalog-sort.ts`, `Toolbar`, and `ListView`.

**Non-Goals:**
- Completing the `Filter` tree-checkbox UI (TreeCheckboxRow rendering). The state machine wiring is in scope; the visual checkbox tree is not.
- Adding new entity-type filter chips beyond the existing tab pattern.
- Paginating the grid view (virtualizer already handles this).
- Backend cache invalidation strategy for about-content.

## Decisions

### D1: `fromChecked` lives in `Catalog` internal state, not in `CatalogProps`

All other interactive state (query, sort, viewMode, activeTab) is internal to `Catalog`. Making `fromFilter` internal keeps the lib self-contained and matches the existing pattern. The app only provides raw items; it never manages filter state.

*Alternative considered*: Lift `fromFilter` to `CatalogProps` as a controlled prop (like a controlled input). Rejected — it contradicts the library-isolation rule (the host shouldn't need to know catalog-internal filter semantics).

### D2: `isAnyFilterActive` = `fromChecked.size > 0 && fromChecked.size < allFromIds.size`

The `fromChecked` set stores the *checked* (included) IDs. An empty set or full set both mean "no filter active". The `allFromIds` are derived from the current `items` prop on each render.

*Alternative*: Store *excluded* IDs instead. Rejected — the `Filter` component API uses `checked` semantics matching the UI convention.

### D3: `clearAllFilters` resets `fromChecked` to the empty set (no selection = all items shown)

Convention: empty `fromChecked` means no filter applied, consistent with `filterCatalogItems` — when there are no filters, all items pass.

### D4: `onFetchAboutContent` wired via a new thin `server-api` adapter function

The new function `fetchEntityAboutContent(id: string): Promise<string | undefined>` lives in `apps/chat/src/server-api/catalog.api.ts`. It calls `GET /api/v1/catalog/{id}/about` through the generated `@epam/chat-api-client`. `CatalogView` passes it as the `onFetchAboutContent` prop. The lib never knows about the endpoint.

### D5: Test targets — utilities first, then components

`catalog-filter.ts` and `catalog-sort.ts` have pure functions — easiest high-value coverage. `Toolbar` and `ListView` are integration-style tests using `@testing-library/react`. The existing `Catalog.spec.tsx` pattern is the reference.

## Risks / Trade-offs

- **`fromChecked` wiring with commented-out tree UI** → The state machine is correct but the filter row will show only the filter icon with no actual controls until `Filter.tsx`'s checkbox tree is implemented. This is intentional — the stub is replaced by correct-but-empty state wiring.
- **Backend `GET /api/v1/catalog/{id}/about` endpoint doesn't exist yet** → `fetchEntityAboutContent` will return `undefined` until the endpoint ships; `DetailsPanel` already falls back to `item.longDescription` when `aboutContent === undefined`. No regression.
- **Test flakiness with ag-grid in ListView tests** → ag-grid requires a DOM with real dimensions. Tests should use `vi.mock` for `@epam/ai-dial-ui-kit` ag-grid wrapper or render with `container.style.height = '600px'` to avoid zero-height grid edge cases.

## Migration Plan

All changes are additive or internal:
- `CatalogProps` gains no new required fields; the filter state is internal.
- `index.ts` export addition is backwards-compatible.
- No database migrations, no deployment steps.
- No rollback complexity — the stubs are restored trivially if needed.

## Open Questions

- Should the `Filter` tree checkbox rows be implemented in this change or tracked separately? Currently scoped OUT — only state wiring is in scope.
- The `GET /api/v1/catalog/{id}/about` backend endpoint design is out of scope here; `catalog-about-content-fetch` spec documents the expected contract so the frontend adapter can be wired correctly when the endpoint ships.
