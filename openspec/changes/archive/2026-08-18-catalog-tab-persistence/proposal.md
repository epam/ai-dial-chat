## Why

The Catalog page's active tab (Models, Prompts, Agents, Skills, Deployments) lives only in `Catalog`'s local `useState`, uncontrolled from the app layer. Any remount — a page refresh, or `navigate()` back from an entity's editor — throws that state away and the tab always resolves to the first entry in `TAB_ORDER` (Models). As more tabs (Skills, Agents) have been added, this context loss is increasingly disruptive.

## What Changes

- Make `Catalog` (`libs/catalog`) accept controlled `activeTab`/`onActiveTabChange` props, following the same controlled/uncontrolled pattern already used for `sortKey`/`filterTopics` (`catalog-sort-filter-persistence`); it keeps working uncontrolled when the props are omitted.
- Add an `apps/chat` hook, `useCatalogActiveTabPreference`, that persists the active tab to `localStorage` (new `StorageKey.CatalogActiveTab`) and reconciles it against the currently available tabs, mirroring `useCatalogSortFilterPreference` exactly (no query param, no routing changes — same mechanism as sort key and topic filters).
- Wire the persisted tab into `CatalogView`: on mount it resolves from `localStorage` (falling back to the first available tab, i.e. Models, when nothing is persisted or the persisted tab is no longer available); every tab switch persists immediately.
- No change is needed to `handleEdit`/`createOptions`'s `ReturnUrl` construction: because every tab switch already persists to `localStorage`, the tab the user was on when they clicked Edit is already the persisted value by the time the editor saves/cancels and navigates back to `ROUTES.Catalog` — `CatalogView` picks it back up from `localStorage` on remount, same as a plain refresh.
- Leave `CatalogModal` (selector mode) unaffected — it stays uncontrolled/session-only, same as sort/filter persistence.

## Capabilities

### New Capabilities

- `catalog-tab-persistence`: controlled `activeTab` prop on `Catalog`, and a `useCatalogActiveTabPreference` hook (mirroring `useCatalogSortFilterPreference`) that persists the active tab to `localStorage` and reconciles it against the currently available tabs on every mount — covering page refresh and return-from-editor navigation alike, since both are plain remounts that read the same persisted value.

### Modified Capabilities

- none (no existing spec file currently documents the Catalog tab-selection behavior at the requirement level; this is a new capability, not a change to a documented one).

## Impact

- `libs/catalog/src/components/Catalog/Catalog.tsx`, `libs/catalog/src/models/catalog-props.ts` — new optional controlled props, no breaking change to existing consumers.
- `apps/chat/src/components/CatalogView/CatalogView.tsx` — uses the new persistence hook to control `Catalog`'s active tab; no change to `handleEdit`/`createOptions`.
- `apps/chat/src/types/storage-key.ts` (new `StorageKey.CatalogActiveTab`).
- New hook file `apps/chat/src/hooks/useCatalogActiveTabPreference/useCatalogActiveTabPreference.ts` plus co-located tests.
