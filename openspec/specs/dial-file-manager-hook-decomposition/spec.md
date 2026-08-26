# dial-file-manager-hook-decomposition Specification

## Purpose

Specifies the internal ownership map between `useDialFileManager` (exported
from `@epam/ai-dial-chat-hooks`) and the five focused sub-hooks it composes
— `useDialFileListing`, `useDialFileUploadBatch`, `useDialFileMutations`,
`useDialFileSharing`, `useDialFileMetadata` — and the equivalence contract
guaranteeing the composer's public options/result shape and all existing
file-manager behavior are preserved by that decomposition, now that the
subsystem lives in `@epam/ai-dial-chat-hooks` behind an injected
`DialFilesApi` port instead of directly inside `apps/chat`.

## Requirements

### Requirement: Sub-hook ownership map

`useDialFileManager` (exported from `@epam/ai-dial-chat-hooks`) SHALL be
composed from five focused sub-hooks, each owning exactly one concern's
state, effects, and `DialFilesApi` operation-port calls, with no concern's
state or handlers duplicated across two sub-hooks:

- `useDialFileListing` SHALL own: per-tab/per-folder listing cache (`cache`, `listingPermissionsCache`), current `folderPath`/`path`, tree expand/collapse state (`expandedPaths`, `loadedPaths`, `folderPopupLoadingPaths`), search (`isSearching`, `searchResults`, debounce), shared-root navigation metadata (`sharedRootMetaRef`, `sharedRootIds`, `sharedByMePaths`), the tab-switch cache-reset effect, and the shared cache-mutation primitives (`invalidateFolders`, `bumpRetry`, `mergeCreatedFolder`) that the other four sub-hooks call. It MAY additionally expose `cache`, `listingPermissionsCache`, `sharedRootMetaRef`, and `setFolderPath` as read/narrow-write surface consumed by sibling sub-hooks (destination-conflict checks, owner-bucket resolution, and post-delete/-rename folder-path correction), provided no sibling hook holds its own copy of this state.
- `useDialFileUploadBatch` SHALL own: `uploadBatchState`, the upload abort controller, `onUploadFiles`, `onUploadArchive`, `onValidateUpload`, `cancelUpload`, `clearUploadBatch`.
- `useDialFileMutations` SHALL own: `isCreatingFolder`, `isDownloading`, `isDeleting`, `isRenaming`, `isCopying`, `isMoving`, the copy/move abort controller, `onCreateFolder`, `onCreateFolderValidate`, `onDownloadFiles`, `onDeleteFiles`, `onRenameValidate`, `onMoveToFiles`, `onCopyFiles`, `cancelCopyMove`.
- `useDialFileSharing` SHALL own: `isUnsharing`, `isRemovingAccess`, `onUnshareFiles`, `onRemoveFilesAccess`.
- `useDialFileMetadata` SHALL own: `fileMetadata`, `isFileMetadataLoading`, `onGetInfo`, `clearMetadata`.

None of the five sub-hooks SHALL import `apps/chat/src/server-api/files.api`, `AppConfigContext`, `react-i18next`, or `apps/chat/src/hooks/useOperationNotification` directly. Each SHALL instead receive an injected `DialFilesApi` operation-port instance (`useDialFileListing`, `useDialFileMetadata`, `useDialFileMutations`, `useDialFileSharing`, `useDialFileUploadBatch`), and `useDialFileMutations` SHALL additionally emit a structured `onOperationSuccess` event instead of calling `useOperationNotification` itself.

#### Scenario: Every result field maps to exactly one owning sub-hook

- **WHEN** any field of `UseDialFileManagerResult` is inspected
- **THEN** it SHALL originate from exactly one of the five sub-hooks listed above, or from the composer's own tab/action-profile-derived UI fields (`visibleColumns`, `actionLabels`, `dateLocale`, `dateOptions`, `sharedWithMeIds`, `uploadEnabled`, `isNewButtonDisabled`, `disabledNewButtonTooltip`, `isAnyOperationInProgress`), and never from two different sub-hooks

#### Scenario: No sub-hook imports the application's files transport directly

- **WHEN** any of the five sub-hooks needs to list, fetch, or mutate files
- **THEN** it calls the `DialFilesApi` instance passed into `useDialFileManager`'s options, and no sub-hook module imports `apps/chat/src/server-api/files.api`

### Requirement: Composer public contract equivalence

`useDialFileManager`, now exported from `@epam/ai-dial-chat-hooks` instead of `apps/chat/src/hooks/files/useDialFileManager.ts`, SHALL continue to accept `UseDialFileManagerOptions` and return `UseDialFileManagerResult` with the exact same field names, types, and semantics as before this move, so that `DialFileManagerShell`, `DialFileManagerModal`, and `DialFileManagerPage` require only an import-path change (plus supplying the newly-injected `filesApi: DialFilesApi`, `labels`, `locale`, and `fileManagerTabs` options) — no consumer-visible field, type, or behavior change.

#### Scenario: Consumers require only an import-path and injected-port change

- **WHEN** `DialFileManagerShell`, `DialFileManagerModal`, or `DialFileManagerPage` calls `useDialFileManager(options)` from `@epam/ai-dial-chat-hooks`, supplying `filesApi`, `labels`, `locale`, and `fileManagerTabs`
- **THEN** the returned object SHALL satisfy the same `UseDialFileManagerResult` interface consumed before the move, with no prop renames, removals, or type changes to any field other than the newly-required options

#### Scenario: isAnyOperationInProgress preserves its exact inclusion list

- **WHEN** the composer computes `isAnyOperationInProgress`
- **THEN** it SHALL be the logical OR of exactly `isCreatingFolder`, `isDownloading`, `isDeleting`, `isRenaming`, `isCopying`, `isMoving`, `isUnsharing`, `isRemovingAccess`, and `uploadBatchState != null`, deliberately excluding `isLoading`, `isSearching`, and `isFileMetadataLoading`, exactly as before the move to `@epam/ai-dial-chat-hooks`
