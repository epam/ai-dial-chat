## ADDED Requirements

### Requirement: Listing hook owns the shared cache and is the sole writer

`@epam/ai-dial-chat-hooks` SHALL export `useDialFileListing`, which owns
the per-folder listing cache (`cache`), the listing-permissions cache
(`listingPermissionsCache`), current `folderPath`, tree expand/collapse
state, search state, and Shared-tab navigation metadata
(`sharedRootMetaRef`, `sharedRootIds`, `sharedByMePaths`), and exposes
`invalidateFolders`, `bumpRetry`, and `mergeCreatedFolder` as the only
mutation entry points other hooks may use to affect this cache. The hook
SHALL accept an injected `DialFilesApi` instance and SHALL NOT import
`apps/chat/src/server-api/files.api` or any application context.

#### Scenario: Tab switch fully resets cache and navigation state

- **WHEN** `activeTab` changes
- **THEN** `cache`, `listingPermissionsCache`, `folderPath`,
  `sharedRootIds`, `sharedRootMetaRef`, expanding/errored tracking sets,
  popup-loading state, search state, and `expandedPaths` are all reset

#### Scenario: Invalidating a visible folder refetches in place instead of purging

- **WHEN** `invalidateFolders` is called with an API path that is an
  ancestor of the current `folderPath` or is currently expanded
- **THEN** the hook refetches that folder via the injected `DialFilesApi`
  and merges the result into the cache in place, rather than deleting the
  cache entry outright (avoiding a flash of empty state)

#### Scenario: Invalidating a non-visible folder purges immediately

- **WHEN** `invalidateFolders` is called with an API path that is neither
  an ancestor of `folderPath` nor expanded
- **THEN** the cache entry for that path is deleted immediately without a
  refetch

### Requirement: Search always searches from the current folder and cancels stale requests

`onSearchFiles` SHALL ignore its `folder` parameter and always search from
the hook's own `folderPath`, SHALL debounce for 300ms, and SHALL cancel any
in-flight search before starting a newer one so a slower stale response can
never overwrite a newer result. Searching the Shared tab's root SHALL filter
already-cached root items client-side instead of issuing a recursive listing
call.

#### Scenario: A newer search cancels an in-flight older search

- **WHEN** a second `onSearchFiles` call is made before the first's debounce
  window elapses
- **THEN** only one `DialFilesApi` call is made, for the second query

#### Scenario: Shared-tab root search uses cached items, not a network call

- **WHEN** `onSearchFiles` is called while `activeTab = Shared` and
  `folderPath` is the Shared root
- **THEN** results are filtered from the already-cached root listing and no
  additional `DialFilesApi.listSharedFiles`/`listFiles` call is made

### Requirement: Folder-expand and destination-popup preload deduplicate concurrent fetches

`onExpandedPathsChange` and `onFolderPopupPathChange` SHALL each track
in-flight and previously-errored folder paths so that expanding an
already-loading or already-cached folder issues no duplicate fetch, and
collapsing a previously-errored folder clears its errored state to allow a
retry on the next expand.

#### Scenario: Expanding an already-loading folder issues no duplicate fetch

- **WHEN** `onExpandedPathsChange` is called for a folder that is already
  being fetched via a concurrent popup preload
- **THEN** no second `DialFilesApi` call is made for that folder

#### Scenario: Collapsing a previously-errored folder allows a retry

- **WHEN** a folder's expand fetch previously failed and the folder is then
  collapsed and re-expanded
- **THEN** the hook retries the fetch instead of silently refusing because
  of the earlier error

### Requirement: Folder-load and metadata failures are reported as structured notifications, not translated strings

`useDialFileListing` and `useDialFileMetadata` SHALL report fetch failures
through the injected `onNotification` callback using a library-owned reason
identifier, and SHALL NOT import `react-i18next` or reference any
translation-key enum.

#### Scenario: A folder-expand failure reports a structured reason

- **WHEN** `DialFilesApi.listFiles` rejects during folder expansion
- **THEN** `onNotification` is called with a structured event identifying
  the failure as a folder-load failure, and the hook itself renders no
  translated text

### Requirement: Metadata retrieval resolves the correct bucket per item origin

`@epam/ai-dial-chat-hooks` SHALL export `useDialFileMetadata`, which resolves
the correct bucket for a metadata request based on the clicked item's
origin (own bucket for `my_files`, owner bucket for Shared items via
`sharedRootMetaRef`, item's own bucket for Organization items), independent
of the shared listing cache.

#### Scenario: Shared nested item resolves the owner's bucket

- **WHEN** `onGetInfo` is called for a nested Shared-tab item
- **THEN** the metadata request resolves and uses the owning user's bucket,
  not the current user's bucket

### Requirement: Tab configuration reads its tab list from an injected value, not a context

`@epam/ai-dial-chat-hooks` SHALL export `useDialFileManagerTabConfig`,
accepting `fileManagerTabs: string[] | undefined` as a plain parameter
instead of reading `AppConfigContext`, and preserving the exact reset
behavior: when the current `activeTab` is excluded from the configured set,
reset to the first still-enabled tab in priority order `[MyFiles, Shared,
Organization]`, falling back to `MyFiles`.

#### Scenario: Active tab resets when excluded by the injected configuration

- **WHEN** `fileManagerTabs` excludes the currently active tab
- **THEN** the hook resets the active tab to the highest-priority tab still
  present in `fileManagerTabs`

#### Scenario: Unrecognized configured tab ids are ignored

- **WHEN** `fileManagerTabs` contains an id with no matching entry in the
  host's `allTabs`
- **THEN** that id is silently excluded from the returned `tabs` list
