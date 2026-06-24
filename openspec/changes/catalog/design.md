## Context

`libs/catalog` is a host-agnostic React library. It manages all catalog state internally (query, sort, view mode, entity-type tab, filter). The app layer (`apps/chat/src/components/CatalogView`) wires the catalog to real data sources via props and callbacks.

Three stubs were present at the start of this change:

1. **`clearAllFilters` (Catalog.tsx)** — the function body was empty.
2. **`isAnyFilterActive` (Catalog.tsx)** — hardcoded to `false`.
3. **`Filter.tsx` body** — topic checkboxes were commented out; My Apps toggle was absent.

Additionally `CatalogSortOption` was missing from `index.ts`, and `CatalogItem.isMyApp` was not populated by the app mapper.

## Goals / Non-Goals

**Goals:**
- Add `filters: Set<string>` and `isMyAppsActive: boolean` state to `Catalog.tsx`; derive `isAnyFilterActive` from them; implement `clearAllFilters`.
- Implement `Filter.tsx`: My Apps `DialCheckbox` toggle + alphabetically sorted topic checkboxes inside a `DialDropdown`.
- Pass all filter props through `Toolbar` → `FilterRow` → `Filter`.
- Set `isMyApp` in `mapDeploymentToCatalogItem` from `deployment.isMy ?? false`.
- Export `CatalogSortOption` from `libs/catalog/src/index.ts`.
- Remove the stale `// TODO: check details` comment from `Catalog.tsx`.
- Add Vitest unit tests for `catalog-filter.ts`, `catalog-sort.ts`, `Toolbar`, `Filter`, and `ListView`.

**Non-Goals:**
- `onFetchAboutContent` wiring in `CatalogView` — deferred until the backend endpoint ships.
- Adding entity-type filter chips beyond the existing tab pattern.
- Paginating the grid view (virtualizer already handles this).

## Decisions

### D1: `filters` and `isMyAppsActive` live in `Catalog` internal state, not in `CatalogProps`

All other interactive state (query, sort, viewMode, activeTab) is internal to `Catalog`. Keeping filter state internal matches the existing pattern and the library-isolation rule — the app never manages catalog-internal filter state.

### D2: `isAnyFilterActive` = `filters.size > 0 || isMyAppsActive`

Both conditions independently constitute an active filter. Clearing all filters resets both to their defaults (`new Set()` and `false`).

### D3: My Apps filter uses `CatalogItem.isMyApp`; the lib does not know about "Personal" folder

The lib tests `item.isMyApp === true` — it does not inspect `item.folder`. The app sets `isMyApp` from `deployment.isMy` in `mapDeploymentToCatalogItem`. This keeps host-specific folder semantics out of the library.

### D4: `isMyApp` populated in `mapDeploymentToCatalogItem` from `deployment.isMy`

`DeploymentItemDto.isMy` is the canonical personal-app flag. Items where `isMy: true` already receive the "Personal" folder label. Setting `isMyApp: deployment.isMy ?? false` in the mapper is the single source of truth — no duplication.

### D5: Test targets — utilities first, then components

`catalog-filter.ts` and `catalog-sort.ts` have pure functions — easiest high-value coverage. `Toolbar`, `Filter`, and `ListView` use `@testing-library/react` integration-style tests.

## Risks / Trade-offs

- **`fetchAboutContent` remains a stub in `CatalogView`** — deferred until the backend endpoint ships. `DetailsPanel` already falls back to `item.description` when `aboutContent === undefined`. No regression.
- **Test flakiness with ag-grid in ListView tests** — ag-grid requires a DOM with real dimensions. Tests should use `vi.mock` for the ag-grid wrapper or set `container.style.height` explicitly.

## Migration Plan

All changes are additive or internal:
- `CatalogProps` gains no new required fields; filter state is internal.
- `index.ts` export addition is backwards-compatible.
- `isMyApp` is a new optional field on `CatalogItem`; existing items without it are unaffected.
- No database migrations, no deployment steps.
