## ADDED Requirements

### Requirement: Sub-hook ownership map
`useDialFileManager` SHALL be composed from five focused sub-hooks, each owning exactly one concern's state, effects, and `server-api/files.api` calls, with no concern's state or handlers duplicated across two sub-hooks:

- `useDialFileListing` SHALL own: per-tab/per-folder listing cache (`cache`, `listingPermissionsCache`), current `folderPath`/`path`, tree expand/collapse state (`expandedPaths`, `loadedPaths`, `folderPopupLoadingPaths`), search (`isSearching`, `searchResults`, debounce), shared-root navigation metadata (`sharedRootMetaRef`, `sharedRootIds`, `sharedByMePaths`), the tab-switch cache-reset effect, and the shared cache-invalidation/retry primitives (`invalidateFolders`, `bumpRetry`) that the other four sub-hooks call.
- `useDialFileUploadBatch` SHALL own: `uploadBatchState`, the upload abort controller, `onUploadFiles`, `onUploadArchive`, `onValidateUpload`, `cancelUpload`, `clearUploadBatch`.
- `useDialFileMutations` SHALL own: `isCreatingFolder`, `isDownloading`, `isDeleting`, `isRenaming`, `isCopying`, `isMoving`, the copy/move abort controller, `onCreateFolder`, `onCreateFolderValidate`, `onDownloadFiles`, `onDeleteFiles`, `onRenameValidate`, `onMoveToFiles`, `onCopyFiles`, `cancelCopyMove`.
- `useDialFileSharing` SHALL own: `shareTarget`, `isSharing`, `isUnsharing`, `isRemovingAccess`, the share abort controller, `onManagePermissions`, `onCloseShareModal`, `onCreateShareLink`, `onUnshareFiles`, `onRemoveFilesAccess`.
- `useDialFileMetadata` SHALL own: `fileMetadata`, `isFileMetadataLoading`, `onGetInfo`, `clearMetadata`.

#### Scenario: Every result field maps to exactly one owning sub-hook
- **WHEN** any field of `UseDialFileManagerResult` is inspected
- **THEN** it SHALL originate from exactly one of the five sub-hooks listed above, or from the composer's own tab/action-profile-derived UI fields (`visibleColumns`, `actionLabels`, `dateLocale`, `dateOptions`, `sharedWithMeIds`, `uploadEnabled`, `isNewButtonDisabled`, `disabledNewButtonTooltip`, `isAnyOperationInProgress`), and never from two different sub-hooks

### Requirement: Composer public contract equivalence
`useDialFileManager` SHALL continue to accept `UseDialFileManagerOptions` and return `UseDialFileManagerResult` with the exact same field names, types, and semantics as before decomposition, so that `DialFileManagerShell`, `DialFileManagerModal`, and `DialFileManagerPage` require no changes to consume it.

#### Scenario: Consumers require no changes
- **WHEN** `DialFileManagerShell`, `DialFileManagerModal`, or `DialFileManagerPage` calls `useDialFileManager(options)` after the decomposition
- **THEN** the returned object SHALL satisfy the same `UseDialFileManagerResult` interface consumed before the decomposition, with no prop renames, removals, or type changes

#### Scenario: isAnyOperationInProgress preserves its exact inclusion list
- **WHEN** the composer computes `isAnyOperationInProgress`
- **THEN** it SHALL be the logical OR of exactly `isCreatingFolder`, `isDownloading`, `isDeleting`, `isRenaming`, `isCopying`, `isMoving`, `isUnsharing`, `isRemovingAccess`, and `uploadBatchState != null`, deliberately excluding `isLoading`, `isSearching`, `isFileMetadataLoading`, and `isSharing` exactly as it did before decomposition

### Requirement: Shared cache invalidation stays centralized
Any sub-hook whose mutation invalidates listing cache entries (`useDialFileUploadBatch`, `useDialFileMutations`, `useDialFileSharing`) SHALL invalidate the shared cache only through `useDialFileListing`'s exposed `invalidateFolders`/`bumpRetry` callbacks, never by holding or mutating a separate copy of `cache`/`listingPermissionsCache`/`retryCounter`.

#### Scenario: A mutation invalidates only its affected folder keys
- **WHEN** `useDialFileMutations`'s delete/rename/copy/move handler completes (success or partial failure)
- **THEN** it SHALL call `useDialFileListing`'s `invalidateFolders` with exactly the set of affected parent-folder API paths, followed by `bumpRetry`, matching the pre-decomposition behavior of deleting those cache keys and incrementing `retryCounter`

### Requirement: Existing tab, variant, and actionProfile behavior is preserved
Decomposition SHALL NOT change any tab-dependent (`MyFiles`/`Shared`/`Organization`), variant-dependent (`Attach`/`Standalone`/`FolderPicker`), or actionProfile-dependent (`Attach`/`Browse`/`Full`) behavior — including which actions are exposed, which columns are visible, and whether upload/copy/move/share actions are gated — as already defined by `dial-file-manager-attach-ui`, `file-manager-tabs`, `file-manager-sharing`, and `file-manager-copy-move`.

#### Scenario: Attach variant still excludes copy/move/duplicate and sharing actions
- **WHEN** `useDialFileManager` is used with `variant: Attach` (actionProfile `Attach`) after decomposition
- **THEN** `actionLabels` SHALL NOT include Copy, Move, Duplicate, ManagePermissions, or RemoveAccess, exactly as before decomposition
