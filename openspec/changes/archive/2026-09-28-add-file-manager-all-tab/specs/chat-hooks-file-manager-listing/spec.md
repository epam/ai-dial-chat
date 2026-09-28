## ADDED Requirements

### Requirement: Listing activity is controllable with isActive

`useDialFileListing` and `useDialFileManager` SHALL accept an optional `isActive?: boolean`. Its JSDoc SHALL state the default, `true`.

While `isActive` is `false`, the hook SHALL:

- issue no `DialFilesApi` call (no navigation fetch, no `listSharedByMe`, no expand, popup, or search fetch)
- report `isLoading: false`
- keep returning its single root node in `items`

When `isActive` changes from `false` to `true`, the hook SHALL fetch the current `folderPath` exactly as on mount. Existing callers that omit the option SHALL behave exactly as before.

#### Scenario: Inactive listing makes no requests

- **WHEN** `useDialFileListing` mounts with `isActive: false`
- **THEN** no `DialFilesApi` method is called, and `isLoading` is `false`

#### Scenario: Activation loads the root

- **WHEN** `isActive` changes from `false` to `true`
- **THEN** exactly one listing request is issued for `folderPath === ''`, using the hook's `activeTab` source

#### Scenario: Expand is a no-op while inactive

- **WHEN** `onExpandedPathsChange` is called while `isActive` is `false`
- **THEN** no folder fetch is issued

### Requirement: A sessionKey change resets the listing like a tab switch

`useDialFileListing` and `useDialFileManager` SHALL accept an optional `sessionKey?: string`. A change in `sessionKey` SHALL run the same reset as an `activeTab` change, clearing:

- `cache` and `listingPermissionsCache`
- `folderPath`
- `sharedRootIds` and `sharedRootMetaRef`
- the expanding and errored tracking sets
- popup-loading state
- search state
- `expandedPaths`

Omitting the option (`undefined`) SHALL never trigger a reset on its own.

#### Scenario: Changing sessionKey resets navigation

- **WHEN** the listing has navigated into `reports/` and `sessionKey` changes from `'all'` to `'my_files'` while `activeTab` stays `my_files`
- **THEN** `folderPath` becomes `''`, `expandedPaths` becomes empty, and the cache is cleared before the root is refetched

#### Scenario: Stable sessionKey keeps state

- **WHEN** the host re-renders with the same `sessionKey`
- **THEN** no reset occurs, and cached folders are retained
