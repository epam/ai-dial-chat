## Why

The Catalog's sort selection (`Newest`, `Name A-Z`, `Recently Updated`) and the "From" topic filter currently live in internal `useState` inside `libs/catalog/src/components/Catalog/Catalog.tsx` and reset to their defaults on every page load or remount. Users who set a preferred sort order or narrow the catalog to specific topics have to redo it every visit, which is a repeated, avoidable friction point.

## What Changes

- Lift `sortKey` and the topic filter (`filters: Set<string>`) out of `Catalog`'s internal state into controlled props on `CatalogProps` (`sortKey`/`onSortChange`, `filterTopics`/`onFilterTopicsChange`), following the same controlled-prop pattern already used for `publishExpandedPaths`/`onPublishExpandedPathsChange`. Both remain optional and uncontrolled-by-default so existing consumers (e.g. `CatalogModal`) are unaffected.
- Add a new `apps/chat/src/hooks/useCatalogSortFilterPreference/useCatalogSortFilterPreference.ts` hook that reads the persisted `sortKey`/`filterTopics` from `localStorage` on mount and writes back on every change, following the `useFavoriteApplications` hook shape (state + setter, no lib-side storage access).
- Wire `CatalogView` to use this hook and pass `sortKey`/`onSortChange`/`filterTopics`/`onFilterTopicsChange` into `Catalog`.
- Persisted filter topics that no longer exist in the current catalog item set (e.g. a topic was removed upstream) are silently dropped rather than shown as an empty/stuck selection.

## Capabilities

### New Capabilities

- `catalog-sort-filter-persistence`: Persisting the user's chosen catalog sort key and topic filter selection to `localStorage` and restoring them on load, via an app-level hook and controlled `Catalog` props.

### Modified Capabilities

(none — `Catalog`'s sort/filter props are additive and optional; no existing spec documents the current uncontrolled behavior as a requirement)

## Impact

- `libs/catalog/src/components/Catalog/Catalog.tsx` — accept controlled `sortKey`/`onSortChange`/`filterTopics`/`onFilterTopicsChange` props, falling back to internal state when absent.
- `libs/catalog/src/models/catalog-props.ts` — new optional props on `CatalogProps`.
- `apps/chat/src/hooks/useCatalogSortFilterPreference/useCatalogSortFilterPreference.ts` — new hook (localStorage read/write).
- `apps/chat/src/components/CatalogView/CatalogView.tsx` — wire the new hook into `Catalog`.
- `apps/chat/src/components/DeploymentSelector/CatalogModal.tsx` — unaffected (does not opt into the new controlled props, keeps current uncontrolled behavior).
