## Requirements

### Requirement: isAnyOperationInProgress derived flag on useDialFileManager

`useDialFileManager` (`apps/chat/src/hooks/files/useDialFileManager.ts`) SHALL expose `isAnyOperationInProgress: boolean` on `UseDialFileManagerResult`, computed via `useMemo` as the logical OR of exactly: `isCreatingFolder`, `isDownloading`, `isDeleting`, `isRenaming`, `isCopying`, `isMoving`, `isUnsharing`, `isRemovingAccess`, and `uploadBatchState != null`.

`isLoading`, `isSearching`, and `isFileMetadataLoading` SHALL NOT be included in this composition. Each is already fully contained by its own scoped loading UI: `isLoading` represents a read (listing fetch), a distinct concept from a mutating operation; `isSearching` is scoped to ui-kit's own search-progress UI; `isFileMetadataLoading` has its own `loading` state in `fileMetadataPopupOptions`.

**State ownership**: `useDialFileManager` owns `isAnyOperationInProgress`; no new context is introduced.

**Memoisation**: `isAnyOperationInProgress` SHALL be recomputed via `useMemo` with dependencies `[isCreatingFolder, isDownloading, isDeleting, isRenaming, isCopying, isMoving, isUnsharing, isRemovingAccess, uploadBatchState]`.

#### Scenario: Flag is true while any covered operation is in flight

- **WHEN** any of `isCreatingFolder`, `isDownloading`, `isDeleting`, `isRenaming`, `isCopying`, `isMoving`, `isUnsharing`, or `isRemovingAccess` is `true`, or `uploadBatchState` is non-null
- **THEN** `isAnyOperationInProgress` is `true`

#### Scenario: Flag is false when nothing is in flight

- **WHEN** every covered flag is `false` and `uploadBatchState` is `null`
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

`DialFileManagerShell` SHALL render **one** blackout overlay block — replacing the three previously-separate blocks for `isDownloading`/`isDeleting`/`isRenaming && !isMoving` — covering five mutually-exclusive states: `isDownloading`, `isDeleting`, `isRenaming && !isMoving`, `isUnsharing`, `isRemovingAccess`. The overlay SHALL reuse the exact existing markup: `<div aria-live="polite" className="absolute inset-0 z-[52] flex items-center justify-center bg-blackout desktop:p-4"><DialSpinner size={32} fullWidth={false} ariaLabel={...} /></div>`.

The `ariaLabel` SHALL be resolved by a dedicated helper using an if/else chain (not nested ternary expressions, per this repo's TypeScript conventions), in this precedence order when more than one flag is unexpectedly `true` simultaneously: `isDownloading` → `isDeleting` → `isRenaming && !isMoving` → `isUnsharing` → `isRemovingAccess`, mapping to `labels.downloadingLabel` / `labels.deletingLabel` / `labels.renamingLabel` / `labels.unsharingLabel` / `labels.removingAccessLabel` respectively. The overlay SHALL NOT render when none of the five flags is `true`.

This overlay SHALL NOT render simultaneously with `OperationLoaderModal` (copy/move) or `UploadProgressModal` (upload) — those retain their existing dedicated treatments unchanged, since both render through ui-kit's portal-based `DialPopup` and never coincide with the five consolidated states in `useDialFileManager`'s existing per-action state model.

#### Scenario: Download shows the consolidated overlay

- **WHEN** `onDownloadFiles` is in flight (`isDownloading === true`)
- **THEN** the consolidated overlay renders with `ariaLabel={labels.downloadingLabel}`

#### Scenario: Delete shows the consolidated overlay

- **WHEN** `onDeleteFiles` is in flight (`isDeleting === true`)
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

#### Scenario: Existing copy/move/upload treatments are unaffected

- **WHEN** `isCopying`, `isMoving`, or `uploadBatchState` is active
- **THEN** the consolidated overlay does not additionally render — `OperationLoaderModal` and `UploadProgressModal` remain the sole indicator for those operations, exactly as before this change

#### Scenario: No overlay when nothing is in flight

- **WHEN** all five consolidated flags are `false`
- **THEN** the consolidated overlay does not render at all

### Requirement: DialFileManagerModal reads the shared flag for Attach-button gating

`DialFileManagerModal` SHALL replace its local `isOperationInProgress` computation with `hookResult.isAnyOperationInProgress`, used identically to disable the Attach button (`selectedFiles.length === 0 || isLoading || isAnyOperationInProgress`, preserving the existing separate `isLoading` check). No other logic in `DialFileManagerModal` changes.

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

The keys `dialFileManager.unsharingLabel` and `dialFileManager.removingAccessLabel` SHALL be added to `apps/chat/src/i18n/locales/en.json`, with matching `DialFileManagerI18nKeys.UnsharingLabel`/`RemovingAccessLabel` members in `apps/chat/src/constants/translation-keys.ts`, and corresponding `unsharingLabel`/`removingAccessLabel` fields added to `DialFileManagerShellLabels` (`apps/chat/src/components/DialFileManagerShell/types/labels.ts`), populated by both `DialFileManagerModal` and `DialFileManagerPage`'s `labels` construction — matching the existing `downloadingLabel`/`deletingLabel`/`renamingLabel` pattern.

#### Scenario: Overlay labels use i18n keys

- **WHEN** the consolidated overlay renders for either `isUnsharing` or `isRemovingAccess`
- **THEN** its `ariaLabel` is produced via `t(DialFileManagerI18nKeys.UnsharingLabel)` or `t(DialFileManagerI18nKeys.RemovingAccessLabel)` respectively, never a raw string literal

### Requirement: RTL and accessibility

The consolidated overlay SHALL reuse the same `aria-live="polite"` + `DialSpinner`/`ariaLabel` pattern already established for the pre-change per-operation overlays. It SHALL NOT introduce any physical-direction Tailwind classes (`absolute inset-0` is direction-agnostic), and SHALL NOT add any new keyboard focus target (the overlay, like its pre-change predecessors, contains no interactive control).

#### Scenario: Overlay is announced via aria-live in any locale

- **WHEN** the overlay renders in any locale, including RTL (Arabic)
- **THEN** the `aria-live="polite"` region announces the translated label, and layout is unaffected by direction since the overlay uses only `inset-0`/flex-centering
