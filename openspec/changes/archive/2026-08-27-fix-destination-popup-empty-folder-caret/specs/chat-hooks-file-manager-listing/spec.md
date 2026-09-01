## MODIFIED Requirements

### Requirement: Folder-expand and destination-popup preload deduplicate concurrent fetches

`onExpandedPathsChange` and `onFolderPopupPathChange` SHALL share API-path-keyed cache, in-flight, and previously-errored tracking so that an already-loading or already-cached folder issues no duplicate fetch. `onFolderPopupPathChange` SHALL additionally track the exact File Manager virtual path, including a trailing slash for a non-root folder, in `folderPopupLoadingPaths` while the listing is pending and as a candidate for cache-derived `loadedPaths`.

On successful completion, including a response with `items: []`, the listing SHALL be inserted into the shared cache before the exact path is removed from `folderPopupLoadingPaths`; cache presence SHALL then include the path in `loadedPaths`. On failure, the exact path SHALL be removed from `folderPopupLoadingPaths` without adding a cache entry or marking the path loaded. Collapsing a previously-errored outer-tree folder SHALL clear its errored state to allow a retry on the next expand.

State ownership: `useDialFileListing` owns the shared listing cache, exact destination-popup candidate paths, `folderPopupLoadingPaths`, and cache-derived `loadedPaths`. The hook SHALL remain host-agnostic and use only the injected `DialFilesApi`. Feature flag: none. i18n: no new keys. RTL: none. Memoisation: popup and expansion callbacks SHALL use `useCallback`; `loadedPaths` SHALL use `useMemo`. Accessibility and observability: none added. Cache: the existing API-path-keyed cache has no TTL; existing mutation invalidation and tab-switch reset behavior remain unchanged.

#### Scenario: Expanding an already-loading folder issues no duplicate fetch

- **WHEN** `onExpandedPathsChange` is called for a folder that is already being fetched via a concurrent popup preload
- **THEN** no second `DialFilesApi` call is made for that folder

#### Scenario: Popup joins an outer-tree request

- **WHEN** `onFolderPopupPathChange` observes a folder already being fetched by `onExpandedPathsChange`
- **THEN** the exact virtual path is added to `folderPopupLoadingPaths` without issuing a second request
- **AND** that path is removed from `folderPopupLoadingPaths` when the shared request settles

#### Scenario: Successful empty popup listing is loaded

- **WHEN** a destination-popup listing succeeds with `items: []`
- **THEN** an empty array is stored under the folder's API path in the shared cache
- **AND** the exact virtual path is removed from `folderPopupLoadingPaths`
- **AND** the exact virtual path is present in `loadedPaths`

#### Scenario: Failed popup listing is not loaded

- **WHEN** a destination-popup listing rejects
- **THEN** the exact virtual path is removed from `folderPopupLoadingPaths`
- **AND** no cache entry is created for that API path
- **AND** the virtual path is absent from `loadedPaths`

#### Scenario: Collapsing a previously-errored folder allows a retry

- **WHEN** a folder's expand fetch previously failed and the folder is then collapsed and re-expanded
- **THEN** the hook retries the fetch instead of silently refusing because of the earlier error
