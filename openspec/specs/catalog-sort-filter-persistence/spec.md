# Spec: catalog-sort-filter-persistence

## Purpose

Persisting the catalog's sort key and topic filter, and reconciling them into the controlled `Catalog` component.

## Requirements

### Requirement: Catalog accepts controlled sort and filter props

`CatalogProps` (`libs/catalog/src/models/catalog-props.ts`) SHALL gain four new optional properties:

- `sortKey?: CatalogSortKey`
- `onSortChange?: (key: CatalogSortKey) => void`
- `filterTopics?: Set<string>`
- `onFilterTopicsChange?: (topics: Set<string>) => void`

`Catalog` (`libs/catalog/src/components/Catalog/Catalog.tsx`) SHALL use `props.sortKey ?? internalSortKey` and `props.filterTopics ?? internalFilters` so it remains fully functional when the props are omitted (uncontrolled, current behavior unchanged). When `onSortChange`/`onFilterTopicsChange` are supplied, `Catalog` SHALL call them on every corresponding user interaction in addition to updating its own internal fallback state.

`Catalog` SHALL NOT read or write `localStorage`, `sessionStorage`, or any other browser storage API — it remains host-agnostic per AGENTS.md §Library isolation.

i18n keys needed: none (no new user-visible strings; existing sort/filter labels are unchanged).

RTL impact: none (no new layout).

#### Scenario: Uncontrolled Catalog behaves exactly as before

- **WHEN** `Catalog` is rendered without `sortKey`, `onSortChange`, `filterTopics`, or `onFilterTopicsChange`
- **THEN** it defaults to `CatalogSortKey.RecentlyUpdated` and an empty topic filter, and sorting/filtering works entirely from internal state as it does today

#### Scenario: Controlled sortKey overrides internal state

- **WHEN** `Catalog` is rendered with `sortKey={CatalogSortKey.Newest}`
- **THEN** the catalog list is sorted using `CatalogSortKey.Newest` and the sort dropdown shows "Newest" as selected, regardless of any internal default

#### Scenario: Selecting a sort option calls onSortChange

- **WHEN** the user selects "Name A-Z" from the sort dropdown and `onSortChange` is supplied
- **THEN** `onSortChange` is called with `CatalogSortKey.NameAZ`

#### Scenario: Controlled filterTopics overrides internal state

- **WHEN** `Catalog` is rendered with `filterTopics={new Set(['nlp'])}`
- **THEN** only items whose `topics` include `'nlp'` are shown in the Browse section, regardless of internal filter state

#### Scenario: Applying a topic filter calls onFilterTopicsChange

- **WHEN** the user checks a topic in the "From" filter dropdown and clicks Apply, and `onFilterTopicsChange` is supplied
- **THEN** `onFilterTopicsChange` is called with a `Set<string>` containing the checked topic(s)

---

### Requirement: useCatalogSortFilterPreference hook persists sort key and topic filter

A custom hook `useCatalogSortFilterPreference` SHALL be created at `apps/chat/src/hooks/useCatalogSortFilterPreference/useCatalogSortFilterPreference.ts`, built on top of the existing `apps/chat/src/hooks/useLocalStorage.ts` hook rather than calling `localStorage` directly.

`apps/chat/src/types/storage-key.ts` SHALL gain two new `StorageKey` members: `CatalogSortKey` and `CatalogFilterTopics`.

The hook SHALL:

- Call `useLocalStorage<string>(StorageKey.CatalogSortKey, CatalogSortKey.RecentlyUpdated)` to obtain the persisted sort key string and its setter.
- Call `useLocalStorage<string[]>(StorageKey.CatalogFilterTopics, [])` to obtain the persisted filter topics array and its setter.
- Expose `sortKey: CatalogSortKey`, `setSortKey: (key: CatalogSortKey) => void`, `filterTopics: Set<string>`, and `setFilterTopics: (topics: Set<string>) => void`.
- Validate the value from `useLocalStorage` against the `CatalogSortKey` enum; an unknown value falls back to `CatalogSortKey.RecentlyUpdated`.
- Rehydrate the filter topics array from `useLocalStorage` as `new Set(parsed)`; a non-array value falls back to an empty `Set`.
- On every `setSortKey` call, forward the new value to the underlying `useLocalStorage` setter for `StorageKey.CatalogSortKey`.
- On every `setFilterTopics` call, forward `Array.from(topics)` to the underlying `useLocalStorage` setter for `StorageKey.CatalogFilterTopics`.
- Rely on `useLocalStorage`'s own `try`/`catch` handling for `localStorage` read/write failures (e.g. storage disabled, quota exceeded) — the hook does not need its own storage-access error handling.

The hook SHALL NOT call `useTranslation`, read route params, or make network requests.

i18n keys needed: none (hook has no user-visible strings).

RTL impact: none.

#### Scenario: No persisted values on first visit

- **WHEN** the hook mounts and `localStorage` has no `dial:catalog:sortKey` or `dial:catalog:filterTopics` entries
- **THEN** `sortKey` is `CatalogSortKey.RecentlyUpdated` and `filterTopics` is an empty `Set`

#### Scenario: Persisted sort key is restored

- **WHEN** the hook mounts and `localStorage.getItem('dial:catalog:sortKey')` returns `'newest'`
- **THEN** `sortKey` is `CatalogSortKey.Newest`

#### Scenario: Invalid persisted sort key falls back to default

- **WHEN** the hook mounts and `localStorage.getItem(StorageKey.CatalogSortKey)` returns `JSON.stringify('not-a-real-key')`
- **THEN** `sortKey` is `CatalogSortKey.RecentlyUpdated`

#### Scenario: Persisted filter topics are restored

- **WHEN** the hook mounts and `localStorage.getItem(StorageKey.CatalogFilterTopics)` returns `'["nlp","vision"]'`
- **THEN** `filterTopics` is `Set { 'nlp', 'vision' }`

#### Scenario: Malformed persisted filter topics fall back to empty set

- **WHEN** the hook mounts and `localStorage.getItem(StorageKey.CatalogFilterTopics)` returns `'{not valid json'`
- **THEN** `filterTopics` is an empty `Set` and no error is thrown

#### Scenario: setSortKey persists the new value

- **WHEN** `setSortKey(CatalogSortKey.NameAZ)` is called
- **THEN** `localStorage.getItem(StorageKey.CatalogSortKey)` returns `JSON.stringify(CatalogSortKey.NameAZ)` and `sortKey` updates to `CatalogSortKey.NameAZ`

#### Scenario: setFilterTopics persists the new value

- **WHEN** `setFilterTopics(new Set(['agents']))` is called
- **THEN** `localStorage.getItem(StorageKey.CatalogFilterTopics)` returns `'["agents"]'` and `filterTopics` updates to `Set { 'agents' }`

#### Scenario: localStorage write failure does not throw

- **WHEN** `setSortKey` is called and the underlying `useLocalStorage` setter's `localStorage.setItem` call throws (e.g. quota exceeded)
- **THEN** the hook's `sortKey` state still updates in memory and no error propagates out of the hook

---

### Requirement: CatalogView reconciles and wires persisted preferences into Catalog

`CatalogView` (`apps/chat/src/components/CatalogView/CatalogView.tsx`) SHALL use `useCatalogSortFilterPreference` to obtain `sortKey`, `setSortKey`, `filterTopics`, and `setFilterTopics`.

- Before passing `filterTopics` to `Catalog`, `CatalogView` SHALL reconcile it against the current catalog item set: compute the union of all `topics` across the memoized `catalogItems`, and pass only the intersection of persisted `filterTopics` with that union. This reconciliation SHALL be wrapped in `useMemo` keyed on `catalogItems` and the hook's `filterTopics`.
- `CatalogView` SHALL only forward `sortKey`, `onSortChange`, `filterTopics`, and `onFilterTopicsChange` to `Catalog` when it is not rendered in selector mode (`isSelectorMode` is falsy); in selector mode these four props SHALL be `undefined` so `Catalog` falls back to its own internal, session-only sort/filter state. `CatalogView` SHALL still call `useCatalogSortFilterPreference` unconditionally (the hook read is harmless), but its values are only wired to `Catalog` outside selector mode.
- Outside selector mode, `Catalog` SHALL receive `sortKey={sortKey}`, `onSortChange={setSortKey}`, `filterTopics={reconciledFilterTopics}`, and `onFilterTopicsChange={setFilterTopics}`.
- `CatalogModal` (`apps/chat/src/components/DeploymentSelector/CatalogModal.tsx`) renders `CatalogView` with `isSelectorMode`. Because of the selector-mode gating above, `CatalogModal` SHALL NOT be changed and its sort/filter behavior remains uncontrolled and session-only (resets whenever the modal is closed and reopened).

Memoisation: the reconciled `filterTopics` value SHALL be wrapped in `useMemo`.

Feature flag: none required.

Accessibility: no change — the sort dropdown and filter panel already carry their existing ARIA semantics; this requirement only changes which values drive them.

#### Scenario: Persisted sort and filter are applied on page load

- **WHEN** `CatalogView` mounts and `useCatalogSortFilterPreference` restores `sortKey: CatalogSortKey.Newest` and `filterTopics: Set { 'nlp' }`, and at least one loaded catalog item has topic `'nlp'`
- **THEN** the rendered `Catalog` sorts items by "Newest" and shows only items with the `'nlp'` topic, with no additional user interaction

#### Scenario: Stale persisted topic is dropped when no longer present in items

- **WHEN** `useCatalogSortFilterPreference` restores `filterTopics: Set { 'deprecated-topic' }` and no loaded catalog item has that topic
- **THEN** `Catalog` receives an empty `filterTopics` set and shows all items unfiltered

#### Scenario: Changing sort in the UI updates persisted storage

- **WHEN** the user selects a different sort option in the rendered `Catalog`
- **THEN** `setSortKey` (and therefore `localStorage`) is updated with the new selection

#### Scenario: CatalogModal is unaffected

- **WHEN** `CatalogModal` is rendered
- **THEN** it does not read from or write to `localStorage` for sort or filter state, and its sort/filter selections reset when the modal is closed and reopened
