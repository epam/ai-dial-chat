## ADDED Requirements

### Requirement: useDialFileManager exposes onSearchFiles for recursive file search

`useDialFileManager` SHALL expose an `onSearchFiles(query: string) => void` callback. When called with a non-empty query, the hook SHALL fetch a recursive listing from the BFF using the active tab's listing function (`listFiles` / `listSharedFiles` / `listPublicFiles`) with `{ recursive: true }`, apply a client-side name-contains filter on the query, and expose the matching items through the existing `items` return value.

The hook SHALL debounce `onSearchFiles` calls by 300 ms. Any in-flight search request SHALL be cancelled (via `AbortController`) when a new query arrives or when the component unmounts.

The hook SHALL expose `isSearching: boolean` that is `true` while the debounced request is in flight. When the query becomes empty, `isSearching` SHALL return to `false` and `items` SHALL revert to the cached folder contents for the current path.

State ownership: `useDialFileManager` hook — internal `searchQuery` and `searchResults` refs/state; `items` is derived from search results when query is non-empty.
Feature flag: none — enabled unconditionally when `DialFileManagerShell` sets `searchable: true`.
RTL: none — search is direction-agnostic.
Memoisation: `onSearchFiles` wrapped in `useCallback`; `items` derivation in `useMemo`.
Cache: search results are NOT stored in the per-folder `Map` cache; they are ephemeral for the duration of the active query.
No new BFF endpoint — reuses existing `listFiles` / `listSharedFiles` / `listPublicFiles` with `recursive: true`.

#### Scenario: Search returns matching files

- **WHEN** user types "report" in the search field
- **THEN** `items` contains all files across all subfolders whose name includes "report" (case-insensitive)
- **AND** `isSearching` transitions from `true` to `false` once results are loaded

#### Scenario: Empty query restores folder view

- **WHEN** user clears the search field after a previous search
- **THEN** `items` reverts to the cached folder contents for the current path
- **AND** `isSearching` is `false`

#### Scenario: Rapid typing debounces requests

- **WHEN** user types three characters within 100 ms
- **THEN** only one BFF request is made (after the 300 ms debounce settles)

#### Scenario: Tab switch during search clears search state

- **WHEN** user switches from My Files tab to Shared tab while a search query is active
- **THEN** the search query is cleared, `items` shows the root of the new tab, and `isSearching` is `false`

#### Scenario: Search on Shared tab uses shared listing endpoint

- **WHEN** user is on the Shared tab and types a search query
- **THEN** `listSharedFiles` is called with `{ recursive: true }` (not `listFiles`)

---

### Requirement: DialFileManagerShell enables search UI

`DialFileManagerShell` SHALL pass `navigationPanelOptions={{ searchable: true, hideSearchPathItemName: true }}` to `DialFileManager` and wire `onSearchFiles` from `useDialFileManager` to the `DialFileManager` search callback prop.

When `isSearching` is `true`, the shell SHALL display a loading indicator within the file grid area (using the existing skeleton/spinner pattern).

When search returns zero results, the shell SHALL display a generic "No results found" empty state (i18n key: `dialFileManager.search.emptyStateTitle`).

RTL: none — `DialFileManager` handles search input direction internally.
i18n keys: `dialFileManager.search.emptyStateTitle`.
Accessibility: search input provided by `DialFileManager` ui-kit component; no additional ARIA attributes needed from the host.

#### Scenario: Search input visible in modal

- **WHEN** `DialFileManagerShell` is rendered
- **THEN** the `DialFileManager` navigation panel shows a search input (`searchable: true`)

#### Scenario: Search path item name hidden

- **WHEN** search results are displayed
- **THEN** the full item path is shown in the breadcrumb instead of just the file name (`hideSearchPathItemName: true`)

#### Scenario: Loading indicator during search

- **WHEN** a search query is debounced and the BFF request is in flight
- **THEN** the file grid area shows a loading skeleton or spinner

#### Scenario: Empty state for no search results

- **WHEN** the search completes and no files match the query
- **THEN** the empty state copy uses key `dialFileManager.search.emptyStateTitle`
