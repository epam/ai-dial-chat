## MODIFIED Requirements

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
