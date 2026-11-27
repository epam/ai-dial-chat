## MODIFIED Requirements

### Requirement: Catalog accepts controlled sort and filter props

`CatalogProps` (`libs/catalog/src/models/catalog-props.ts`) SHALL gain four new optional properties:

- `sortKey?: CatalogSortKey`
- `onSortChange?: (key: CatalogSortKey) => void`
- `filterTopics?: Set<string>`
- `onFilterTopicsChange?: (topics: Set<string>) => void`

`Catalog` (`libs/catalog/src/components/Catalog/Catalog.tsx`) SHALL use `props.sortKey ?? internalSortKey` and `props.filterTopics ?? internalFilters`, so it stays fully functional when the props are omitted (uncontrolled; current behaviour unchanged). When `onSortChange` or `onFilterTopicsChange` is supplied, `Catalog` SHALL call it on every matching user interaction, in addition to updating its own internal fallback state.

`Catalog` SHALL NOT read or write `localStorage`, `sessionStorage` or any other browser storage API. It stays host-agnostic per AGENTS.md §Library isolation.

i18n keys needed: none. This requirement adds no user-visible strings; the labels are covered by `catalog-topic-filter`.

RTL impact: none (no new layout).

#### Scenario: Uncontrolled Catalog behaves exactly as before

- **WHEN** `Catalog` is rendered without `sortKey`, `onSortChange`, `filterTopics` or `onFilterTopicsChange`
- **THEN** it defaults to `CatalogSortKey.RecentlyUpdated` and an empty topic filter, and sorting and filtering run entirely from internal state

#### Scenario: Controlled sortKey overrides internal state

- **WHEN** `Catalog` is rendered with `sortKey={CatalogSortKey.Newest}`
- **THEN** the catalog list is sorted by `CatalogSortKey.Newest` and the sort dropdown shows "Newest" as selected, regardless of any internal default

#### Scenario: Selecting a sort option calls onSortChange

- **WHEN** the user selects "Name A-Z" from the sort dropdown and `onSortChange` is supplied
- **THEN** `onSortChange` is called with `CatalogSortKey.NameAZ`

#### Scenario: Controlled filterTopics overrides internal state

- **WHEN** `Catalog` is rendered with `filterTopics={new Set(['nlp'])}`
- **THEN** only items whose `topics` include `'nlp'` are shown in the Browse section, regardless of internal filter state

#### Scenario: Checking a topic calls onFilterTopicsChange

- **WHEN** the user checks a topic in the topic filter dropdown and `onFilterTopicsChange` is supplied
- **THEN** `onFilterTopicsChange` is called at once with a `Set<string>` that holds the checked topic(s)

### Requirement: useCatalogSortFilterPreference hook persists sort key and topic filter

A custom hook `useCatalogSortFilterPreference` SHALL exist at `apps/chat/src/hooks/useCatalogSortFilterPreference/useCatalogSortFilterPreference.ts`. It is built on the existing `apps/chat/src/hooks/useLocalStorage.ts` hook and does not call `localStorage` directly, except for the one-time removal of the old key described below.

`apps/chat/src/types/storage-key.ts` SHALL define these `StorageKey` members:

- `CatalogSortKey` (`'catalogSortKey'`)
- `CatalogFilterTopics` (`'catalogFilterTopics'`)
- `CatalogFolderSelection` (`'catalogFolderSelection'`)

The former `CatalogIsMyAppsActive` member is removed.

The hook SHALL:

- Call `useLocalStorage<string>(StorageKey.CatalogSortKey, CatalogSortKey.RecentlyUpdated)` to get the persisted sort key string and its setter.
- Call `useLocalStorage<string[]>(StorageKey.CatalogFilterTopics, [])` to get the persisted filter topics array and its setter.
- Call `useLocalStorage<unknown>(StorageKey.CatalogFolderSelection, null)` for the persisted folder selection.
- Expose `sortKey: CatalogSortKey`, `setSortKey: (key: CatalogSortKey) => void`, `filterTopics: Set<string>`, `setFilterTopics: (topics: Set<string>) => void`, `folderSelection: CatalogFolderSelection` and `setFolderSelection: (selection: CatalogFolderSelection) => void`.
- Validate the sort key against the `CatalogSortKey` enum. An unknown value falls back to `CatalogSortKey.RecentlyUpdated` (`resolveCatalogSortKey` from `@epam/ai-dial-chat-hooks`).
- Rehydrate the filter topics array as a `Set` of its string entries, dropping non-string entries. A non-array value falls back to an empty `Set` (`parseCatalogFilterTopics` from `@epam/ai-dial-chat-hooks`).
- Validate the folder selection with the pure `parseCatalogFolderSelection` (`apps/chat/src/hooks/useCatalogSortFilterPreference/parse-catalog-folder-selection.ts`). It accepts an object whose `root` is absent or a `CatalogFolderRootKind` value and whose `path` is an array of strings. Any other value gives `{ path: [] }`.
- Forward every `setSortKey`, `setFilterTopics` (as `Array.from(topics)`) and `setFolderSelection` call to the matching `useLocalStorage` setter.
- Remove the former `catalogIsMyAppsActive` entry once on mount, inside a `try`/`catch` effect.
- Otherwise rely on `useLocalStorage`'s own `try`/`catch` handling for `localStorage` read and write failures.

The hook SHALL NOT call `useTranslation`, read route params or make network requests.

i18n keys needed: none.

RTL impact: none.

#### Scenario: No persisted values on first visit

- **WHEN** the hook mounts and `localStorage` has no catalog entries
- **THEN** `sortKey` is `CatalogSortKey.RecentlyUpdated`, `filterTopics` is an empty `Set`, and `folderSelection` is `{ path: [] }`

#### Scenario: Persisted sort key is restored

- **WHEN** the hook mounts and `localStorage.getItem(StorageKey.CatalogSortKey)` returns `JSON.stringify('newest')`
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

#### Scenario: Persisted folder selection is restored

- **WHEN** the stored folder selection is `'{"root":"organization","path":["Design Assets"]}'`
- **THEN** `folderSelection` is `{ root: 'organization', path: ['Design Assets'] }`

#### Scenario: Malformed folder selection falls back to All entities

- **WHEN** the stored folder selection is `'{"root":"nope","path":"x"}'`
- **THEN** `folderSelection` is `{ path: [] }`

#### Scenario: The removed "My" key is cleaned up

- **WHEN** the hook mounts and `localStorage` holds `catalogIsMyAppsActive`
- **THEN** that entry is removed and no "My" state is exposed

#### Scenario: setSortKey persists the new value

- **WHEN** `setSortKey(CatalogSortKey.NameAZ)` is called
- **THEN** `localStorage.getItem(StorageKey.CatalogSortKey)` returns `JSON.stringify(CatalogSortKey.NameAZ)` and `sortKey` updates to `CatalogSortKey.NameAZ`

#### Scenario: setFilterTopics persists the new value

- **WHEN** `setFilterTopics(new Set(['agents']))` is called
- **THEN** `localStorage.getItem(StorageKey.CatalogFilterTopics)` returns `'["agents"]'` and `filterTopics` updates to `Set { 'agents' }`

#### Scenario: localStorage write failure does not throw

- **WHEN** `setSortKey` is called and the underlying `useLocalStorage` setter's `localStorage.setItem` call throws (for example, quota exceeded)
- **THEN** the hook's `sortKey` state still updates in memory and no error propagates out of the hook

### Requirement: CatalogView reconciles and wires persisted preferences into Catalog

`CatalogView` (`apps/chat/src/components/CatalogView/CatalogView.tsx`) SHALL use `useCatalogSortFilterPreference` to get `sortKey`, `setSortKey`, `filterTopics`, `setFilterTopics`, `folderSelection` and `setFolderSelection`.

- **Topics.** Before passing `filterTopics` to `Catalog`, `CatalogView` SHALL get `reconciledFilterTopics` from the app hook `useCatalogItems` (`apps/chat/src/hooks/useCatalogItems/useCatalogItems.ts`), which receives the persisted topics as `persistedFilterTopics`. That hook calls the pure helper `reconcileFilterTopics(persistedFilterTopics, visibleCatalogItems)` from `@epam/ai-dial-chat-hooks`. It SHALL return only the persisted topics present in the current visible item set, without mutating either input.
- **Folder.** `useCatalogItems` SHALL also receive `persistedFolderSelection` and `folderRoots`, and return `reconciledFolderSelection`: the persisted selection when `isFolderSelectionValid(selection, buildCatalogFolderTree(visibleCatalogItems, folderRoots))` holds, and `{ path: [] }` otherwise. The check SHALL be skipped while the items are loading, so a slow load does not reset the stored folder.
- **Selector and hide-owned filtering.** These SHALL use the pure `chat-hooks` derivations (`filterCatalogItemsBySelector`, `filterHiddenOwnedItems`) inside `useCatalogItems`, keeping the current filter order and item order.
- **Selector mode.** `CatalogView` SHALL forward `sortKey`, `onSortChange`, `filterTopics`, `onFilterTopicsChange`, `folderSelection` and `onFolderSelectionChange` only outside selector mode. In selector mode these props SHALL be `undefined`, so `Catalog` keeps session-only internal state. `folderRoots` is passed in both modes.
- **Outside selector mode**, `Catalog` SHALL receive:
  - `sortKey={sortKey}` and `onSortChange={setSortKey}`;
  - `filterTopics={reconciledFilterTopics}` and `onFilterTopicsChange={setFilterTopics}`;
  - `folderSelection={reconciledFolderSelection}` and `onFolderSelectionChange={setFolderSelection}`.
- **Unchanged pickers.** `CatalogModal` (`apps/chat/src/components/DeploymentSelector/CatalogModal.tsx`) renders `CatalogView` with `isSelectorMode` and SHALL NOT be changed.

The persistence hook and `StorageKey` stay app-owned. The pure helpers SHALL NOT read or write storage, contexts, routes, translations or feature flags.

Memoisation: the reconciled topics, the reconciled folder selection, `folderRoots` and the visible item derivations SHALL stay memoized. Feature flag: none. Accessibility and RTL: no change.

#### Scenario: Persisted sort, filter and folder are applied on page load

- **WHEN** the stored sort is Newest, the stored topic `nlp` exists in a visible item, and the stored folder Organization › Design Assets exists
- **THEN** `Catalog` receives Newest, a set holding `nlp`, and that folder selection

#### Scenario: Stale persisted topic is dropped when no longer present

- **WHEN** the stored topic `deprecated-topic` is absent from the visible items
- **THEN** `Catalog` receives an empty topic set and shows unfiltered results

#### Scenario: Stale persisted folder falls back to All entities

- **WHEN** the stored folder Organization › Archived no longer exists among the loaded items
- **THEN** `Catalog` receives `{ path: [] }`

#### Scenario: Changing sort updates persisted storage

- **WHEN** the user selects a different sort option
- **THEN** `setSortKey` updates the app-owned preference

#### Scenario: Selector and hide-owned filtering preserve order

- **WHEN** selector types and hide-owned mode remove items
- **THEN** the remaining items keep their source order before topic reconciliation

#### Scenario: CatalogModal is unaffected

- **WHEN** `CatalogModal` is rendered in selector mode
- **THEN** it neither reads nor writes catalog sort, filter or folder storage, and resets its session-only selections on remount
