# file-manager-operation-ux Specification

## Purpose

A shared in-progress flag and the consolidated blackout overlay covering long-running file operations.

## Requirements

### Requirement: isAnyOperationInProgress derived flag on useDialFileManager

`useDialFileManager` (`libs/chat-hooks/src/files/useDialFileManager/useDialFileManager.ts`, `@epam/ai-dial-chat-hooks`) SHALL expose `isAnyOperationInProgress: boolean` on `UseDialFileManagerResult`, computed via `useMemo` as the logical OR of exactly:

- `isCreatingFolder`, `isDeleting`, `isRenaming`, `isCopying`, `isMoving`, `isUnsharing`, `isRemovingAccess`;
- `isUploadInProgress(uploadBatchState)` (from `@epam/ai-dial-chat-shared`, `libs/chat-shared/src/file-manager/upload-batch.ts`), which is `true` only while some file in the batch is `FileUploadStatus.Queued` or `Uploading`. A finished batch that is still non-null does not set the flag.

`isDownloading` SHALL NOT be included. A download is a non-blocking transfer-queue row (see `file-manager-download-queue`), so it never gates other actions.

`isLoading`, `isSearching`, and `isFileMetadataLoading` SHALL NOT be included either, because each is already contained by its own scoped loading UI:

- `isLoading` is a read (listing fetch), a distinct concept from a mutating operation;
- `isSearching` is scoped to ui-kit's own search-progress UI;
- `isFileMetadataLoading` has its own `loading` state in `fileMetadataPopupOptions`.

**State ownership**: `useDialFileManager` owns `isAnyOperationInProgress`, deriving it from its composed `useDialFileMutations`, `useDialFileSharing`, and `useDialFileUploadBatch` results; no new context is introduced.

**Memoisation**: `isAnyOperationInProgress` SHALL be recomputed via `useMemo` with dependencies `[isCreatingFolder, isDeleting, isRenaming, isCopying, isMoving, isUnsharing, isRemovingAccess, uploadBatchState]`.

#### Scenario: Flag is true while any covered operation is in flight

- **WHEN** any of `isCreatingFolder`, `isDeleting`, `isRenaming`, `isCopying`, `isMoving`, `isUnsharing`, or `isRemovingAccess` is `true`, or `uploadBatchState` has a file that is `Queued` or `Uploading`
- **THEN** `isAnyOperationInProgress` is `true`

#### Scenario: Flag is false when nothing is in flight

- **WHEN** every covered flag is `false` and `uploadBatchState` is `null` or holds only finished (`Completed`/`Failed`/`Cancelled`) files
- **THEN** `isAnyOperationInProgress` is `false`

#### Scenario: A running download does not set the flag

- **WHEN** a download is in progress (`isDownloading` is `true`) and every covered flag is `false`
- **THEN** `isAnyOperationInProgress` is `false`

#### Scenario: Metadata loading alone does not set the flag

- **WHEN** `isFileMetadataLoading` is `true` and every other covered flag is `false`
- **THEN** `isAnyOperationInProgress` is `false`

#### Scenario: Listing load alone does not set the flag

- **WHEN** `isLoading` is `true` (a folder listing is being fetched) and every other covered flag is `false`
- **THEN** `isAnyOperationInProgress` is `false`

#### Scenario: Cancelling copy/move clears the flag

- **WHEN** `cancelCopyMove` is invoked while `isCopying` or `isMoving` is `true`, and the resulting abort clears both flags back to `false` (per `file-manager-copy-move`'s existing cancel-semantics requirement)
- **THEN** `isAnyOperationInProgress` becomes `false` immediately after, with no additional wiring beyond the existing derivation

### Requirement: Consolidated blackout overlay for download, delete, rename, unshare, and remove-access

`DialFileManagerShell` (`libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`; `apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx` is a memoised wrapper around it) SHALL render **one** blackout overlay block covering four mutually-exclusive states: `isDeleting`, `isRenaming && !isMoving`, `isUnsharing`, `isRemovingAccess`. Downloads are no longer covered: they run as rows of the transfer queue (see `file-manager-download-queue`), so `isDownloading` never renders the overlay. The overlay SHALL reuse the exact existing markup: `<div aria-live="polite" className="absolute inset-0 z-52 flex items-center justify-center bg-backdrop desktop:p-4"><Spinner size={32} fullWidth={false} ariaLabel={...} /></div>`.

The `ariaLabel` SHALL be resolved by a dedicated helper (`resolveOverlayAriaLabel` in the shell module) using an if/else chain (not nested ternary expressions, per this repo's TypeScript conventions). When more than one flag is unexpectedly `true`, the precedence is `isDeleting` → `isRenaming && !isMoving` → `isUnsharing` → `isRemovingAccess`, mapping to `labels.deletingLabel` / `labels.renamingLabel` / `labels.unsharingLabel` / `labels.removingAccessLabel` respectively. The overlay SHALL NOT render when none of the four flags is `true`. `labels.downloadingLabel` is deprecated and no longer read.

Copy/move, upload and download keep their own treatments, so none of them adds the overlay:

- `OperationLoaderModal` renders while `isCopying || isMoving`.
- Upload and download progress are shown by one non-modal `TransferQueue` fixed at the bottom-end corner (`fixed bottom-4 inset-e-4 z-51`), not by a modal.

#### Scenario: Download shows no overlay

- **WHEN** `onDownloadFiles` is in flight (`isDownloading === true`)
- **THEN** no overlay renders, and the download appears as a transfer-queue row

#### Scenario: Delete shows the consolidated overlay

- **WHEN** `onDeleteFiles` is in flight (`isDeleting === true`)
- **THEN** the consolidated overlay renders with `ariaLabel={labels.deletingLabel}`

#### Scenario: Delete wins over a running download

- **WHEN** `isDeleting` and `isDownloading` are both `true`
- **THEN** the consolidated overlay renders with `ariaLabel={labels.deletingLabel}`

#### Scenario: Same-folder rename shows the consolidated overlay

- **WHEN** `isRenaming` is `true` and `isMoving` is `false`
- **THEN** the consolidated overlay renders with `ariaLabel={labels.renamingLabel}`

#### Scenario: Unshare shows the consolidated overlay

- **WHEN** `onUnshareFiles` is in flight (`isUnsharing === true`)
- **THEN** the consolidated overlay renders with `ariaLabel={labels.unsharingLabel}`

#### Scenario: Remove access shows the consolidated overlay

- **WHEN** `onRemoveFilesAccess` is in flight (`isRemovingAccess === true`)
- **THEN** the consolidated overlay renders with `ariaLabel={labels.removingAccessLabel}`

#### Scenario: Existing copy/move/upload/download treatments are unaffected

- **WHEN** `isCopying`, `isMoving`, `uploadBatchState` or `downloadBatchState` is active
- **THEN** the consolidated overlay does not additionally render. `OperationLoaderModal` (copy/move) and the `TransferQueue` (upload and download) remain the sole indicators for those operations

#### Scenario: No overlay when nothing is in flight

- **WHEN** all four consolidated flags are `false`
- **THEN** the consolidated overlay does not render at all

### Requirement: DialFileManagerModal reads the shared flag for Attach-button gating

`DialFileManagerModal` (`apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`) SHALL read `hookResult.isAnyOperationInProgress` instead of a local `isOperationInProgress` computation and pass it as the `isAnyOperationInProgress` prop to the shared `FileManagerAttachModal` (`libs/chat-shared/src/file-manager/FileManagerAttachModal/FileManagerAttachModal.tsx`), which disables the Attach button with `selectedFiles.length === 0 || isLoading || isAnyOperationInProgress` (the separate `isLoading` check is preserved).

#### Scenario: Attach button disabled while any covered operation is in flight

- **WHEN** `hookResult.isAnyOperationInProgress` is `true`
- **THEN** the Attach button is disabled, matching the modal's pre-change behavior for `isDownloading`/`isDeleting`/`isRenaming`/`isCreatingFolder`/active-upload

#### Scenario: Attach-gating behavior is unchanged for the attach profile

- **WHEN** the modal renders with `actionProfile: Attach` (which cannot reach `isCopying`/`isMoving`/`isUnsharing`/`isRemovingAccess` per `file-manager-tabs`)
- **THEN** the Attach button's disabled state is identical to what the pre-change local `isOperationInProgress` calculation would have produced for every reachable state combination

#### Scenario: Attach button still independently gated on isLoading

- **WHEN** `isLoading` is `true` and `hookResult.isAnyOperationInProgress` is `false`
- **THEN** the Attach button remains disabled, since the modal checks `isLoading` independently of the shared operation flag

### Requirement: Standalone page and destination popup require no new gating

`DialFileManagerPage` (standalone) SHALL require no code change to inherit the consolidated overlay's coverage of `isUnsharing`/`isRemovingAccess` — it already renders through the shared `DialFileManagerShell`. The destination-folder popup's confirm-gating (`folderPopupLoadingPaths`, per `file-manager-folder-picker`) and `useDialFileManager`'s existing re-entrant-call guards on `onCopyFiles`/`onMoveToFiles` (which already early-return while `isCopying`/`isMoving` is `true`) SHALL remain unchanged — this capability introduces no new popup-specific requirement.

#### Scenario: Standalone page shows the consolidated overlay without host-level changes

- **WHEN** a user triggers Unshare or Remove access from `DialFileManagerPage`
- **THEN** the same consolidated overlay renders as in the attach modal, with no `DialFileManagerPage.tsx` code referencing `isUnsharing`/`isRemovingAccess` directly

#### Scenario: Destination popup preload-loading gating is unaffected

- **WHEN** the destination-folder popup is open and browsing an uncached folder
- **THEN** `folderPopupLoadingPaths`-driven confirm-disabling behaves exactly as specified in `file-manager-folder-picker`, unaffected by the new `isAnyOperationInProgress` flag

### Requirement: i18n keys for the new overlay labels

The keys `dialFileManager.unsharingLabel` and `dialFileManager.removingAccessLabel` SHALL be added to `apps/chat/src/i18n/locales/en.json`, with matching `DialFileManagerI18nKeys.UnsharingLabel`/`RemovingAccessLabel` members in `apps/chat/src/constants/translation-keys.ts`, and corresponding `unsharingLabel`/`removingAccessLabel` fields on `DialFileManagerShellLabels` (`libs/chat-shared/src/file-manager/labels.ts`), populated by both `DialFileManagerModal` and `DialFileManagerPage`'s `labels` construction — matching the existing `downloadingLabel`/`deletingLabel`/`renamingLabel` pattern.

#### Scenario: Overlay labels use i18n keys

- **WHEN** the consolidated overlay renders for either `isUnsharing` or `isRemovingAccess`
- **THEN** its `ariaLabel` is produced via `t(DialFileManagerI18nKeys.UnsharingLabel)` or `t(DialFileManagerI18nKeys.RemovingAccessLabel)` respectively, never a raw string literal

### Requirement: RTL and accessibility

The consolidated overlay SHALL reuse the same `aria-live="polite"` + `Spinner`/`ariaLabel` pattern already established for the pre-change per-operation overlays. It SHALL NOT introduce any physical-direction Tailwind classes (`absolute inset-0` is direction-agnostic), and SHALL NOT add any new keyboard focus target (the overlay, like its pre-change predecessors, contains no interactive control).

#### Scenario: Overlay is announced via aria-live in any locale

- **WHEN** the overlay renders in any locale, including RTL (Arabic)
- **THEN** the `aria-live="polite"` region announces the translated label, and layout is unaffected by direction since the overlay uses only `inset-0`/flex-centering
