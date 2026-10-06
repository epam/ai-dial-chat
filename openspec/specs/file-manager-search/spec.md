# file-manager-search Specification

## Purpose

Recursive file search exposed by `useDialFileManager` (`libs/chat-hooks`) and enabled in the file-manager shell (`libs/chat-shared`).

## Requirements

### Requirement: useDialFileManager exposes onSearchFiles for recursive file search

`useDialFileManager` (`libs/chat-hooks/src/files/useDialFileManager/useDialFileManager.ts`) SHALL expose an `onSearchFiles(folder: string, query: string) => void` callback, implemented by `useDialFileListing` and forwarded unchanged. When called with a non-blank query, the hook SHALL fetch a recursive listing of the current folder through `fetchForSearch` (`dial-file-manager-mapping.util.ts`) with `recursive: true` — `filesApi.listFiles` for My files, `filesApi.listPublicFiles` for Organization, and, for a nested Shared folder, `filesApi.listFiles` against the owning shared root's bucket and path — and expose the whole recursive listing, unfiltered, through `searchResults: DialFile[] | null`. At the Shared tab's root no request is made: the already-cached root items are used as the results. The hook SHALL NOT filter by the query: `DialFileManager` calls `onSearchFiles` once per search session and applies the case-insensitive name-contains filter for that query and every later one itself, so pre-filtering by the first query would hide matches for a replacement query.

The hook SHALL debounce `onSearchFiles` calls by 300 ms. Every call SHALL immediately cancel the pending debounce timer and any in-flight search (a cancellation flag, not an `AbortController`), so a slower stale fetch never overwrites newer results; the timer and in-flight search are also cancelled on unmount. A failed search resolves `searchResults` to `[]`.

The hook SHALL expose `isSearching: boolean` that is `true` while the debounced request is in flight, and `clearSearchResults()`. When the query becomes blank, `searchResults` SHALL return to `null` and `isSearching` to `false`; `items` (the folder contents for the current path) is never replaced by search results.

State ownership: `useDialFileListing` hook — internal `searchResults`/`isSearching` state and debounce/cancel refs; the query itself is owned by `DialFileManager`.
Feature flag: none — enabled unconditionally when `DialFileManagerShell` sets `searchable: true`.
RTL: none — search is direction-agnostic.
Memoisation: `onSearchFiles` and `clearSearchResults` wrapped in `useCallback`.
Cache: search results are NOT stored in the per-folder `Map` cache; they are ephemeral for the duration of the active query.
No new BFF endpoint — reuses existing `listFiles` / `listPublicFiles` with `recursive: true`.

#### Scenario: Search returns matching files

- **WHEN** user types "report" in the search field
- **THEN** the grid shows all files across all subfolders whose name includes "report" (case-insensitive)
- **AND** `isSearching` transitions from `true` to `false` once results are loaded

#### Scenario: Replacing a non-empty query searches the new query

- **GIVEN** the current folder contains `A.svg` and `B.svg`
- **WHEN** user searches "A.svg" and then replaces the whole query with "B.svg" without clearing it first
- **THEN** the grid shows `B.svg`

#### Scenario: Empty query restores folder view

- **WHEN** user clears the search field after a previous search
- **THEN** `searchResults` is `null`, the grid shows the cached folder contents for the current path
- **AND** `isSearching` is `false`

#### Scenario: Rapid typing debounces requests

- **WHEN** user types three characters within 100 ms
- **THEN** only one BFF request is made (after the 300 ms debounce settles)

#### Scenario: Tab switch during search clears search state

- **WHEN** user switches from My Files tab to Shared tab while a search query is active
- **THEN** the pending/in-flight search is cancelled, `searchResults` is `null`, `items` shows the root of the new tab, and `isSearching` is `false`

#### Scenario: Search on Shared tab searches the shared root's own bucket

- **WHEN** user is inside a shared folder on the Shared tab and types a search query
- **THEN** `listFiles` is called with the shared root's `bucket`, its path in that bucket, and `recursive: true`
- **AND** at the Shared tab root, the cached root items are used and no request is made

---

### Requirement: DialFileManagerShell enables search UI

`DialFileManagerShell` (`libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`) SHALL pass `navigationPanelOptions={{ searchable: true, placeholder: labels.searchPlaceholderByTab?.[tab] }}` and `hideSearchPathItemName={true}` to `DialFileManager`, and wire `onSearchFiles`, `searchInProgress={isSearching}`, `searchResults={searchResults ?? []}`, and `clearSearchResults` from the file-manager controller.

When `isSearching` is `true`, `DialFileManager` displays its own loading state in the file grid area via `searchInProgress`.

When a completed search is shown (`searchResults != null && !isSearching`), the shell SHALL use the host-supplied `labels.searchEmptyStateTitle` as the empty-state title. The app hosts (`DialFileManagerModal`, `DialFileManagerPage`) supply `t(BasicI18nKeys.NoResults)` — key `basic.noResults`, "No results found".

RTL: none — `DialFileManager` handles search input direction internally.
i18n keys: `basic.noResults` (host-supplied through `labels.searchEmptyStateTitle`; the lib does not import i18n).
Accessibility: search input provided by `DialFileManager` ui-kit component; no additional ARIA attributes needed from the host.

#### Scenario: Search input visible in modal

- **WHEN** `DialFileManagerShell` is rendered
- **THEN** the `DialFileManager` navigation panel shows a search input (`searchable: true`)

#### Scenario: Search path item name hidden

- **WHEN** search results are displayed
- **THEN** the full item path is shown in the breadcrumb instead of just the file name (`hideSearchPathItemName: true`)

#### Scenario: Loading indicator during search

- **WHEN** a search query is debounced and the BFF request is in flight
- **THEN** `DialFileManager` receives `searchInProgress={true}` and shows its loading state in the file grid area

#### Scenario: Empty state for no search results

- **WHEN** the search completes and no files match the query
- **THEN** the empty state title is `labels.searchEmptyStateTitle` ("No results found", `basic.noResults`, in the app hosts)
