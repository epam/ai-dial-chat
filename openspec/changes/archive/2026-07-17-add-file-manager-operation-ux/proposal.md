## Why

`useDialFileManager` tracks nine independent "operation in progress" booleans (`isCreatingFolder`, `isDownloading`, `isDeleting`, `isRenaming`, `isCopying`, `isMoving`, `isSharing`, `isUnsharing`, `isRemovingAccess`) plus `isFileMetadataLoading`, `isSearching`, `isLoading`, and `uploadBatchState`, but exposes no single combined flag — each consumer has to remember which subset applies to it. Today only two consumers do this enumeration, and both do it incompletely:

- `DialFileManagerShell` renders three near-identical, separately-coded blackout overlay blocks for `isDownloading`/`isDeleting`/`isRenaming`, `UploadProgressModal` for uploads, and `OperationLoaderModal` for `isCopying`/`isMoving` — but **`isUnsharing` and `isRemovingAccess` have no busy indicator at all**. Per `file-manager-sharing`'s own requirement, both calls fire immediately with no confirmation step, so today a user gets zero visual feedback between clicking Unshare/Remove access and the listing refreshing — indistinguishable from the click not having registered.
- `DialFileManagerModal` computes a local `isOperationInProgress = isDownloading || isDeleting || isRenaming || isCreatingFolder || uploadBatchState != null` (checked alongside a *separately*-tested `isLoading`) to disable the Attach button. This duplicates enumeration logic that belongs in the hook, and would silently miss `isCopying`/`isMoving`/`isUnsharing`/`isRemovingAccess` if the attach flow's action profile were ever widened to expose those actions.

This is step 17 of the #7505 migration roadmap: introduce one hook-owned `isAnyOperationInProgress` contract so every host reads from a single source of truth, consolidate the shell's duplicated per-operation overlay JSX into one block, and close the missing-feedback gap for unshare/remove-access.

## What Changes

- `useDialFileManager` exposes a new derived `isAnyOperationInProgress: boolean` — the OR of every *mutating, not-already-modal-scoped* operation flag: `isCreatingFolder`, `isDownloading`, `isDeleting`, `isRenaming`, `isCopying`, `isMoving`, `isUnsharing`, `isRemovingAccess`, and `uploadBatchState != null`. Four flags are deliberately **excluded**, each already fully contained by its own scoped loading UI (see design.md D5 for the per-flag justification): `isLoading` (read, not a mutation — a distinct concept from "an operation is in flight"), `isSearching` (ui-kit-owned search progress UI), `isFileMetadataLoading` (own `loading` state inside `fileMetadataPopupOptions`), and `isSharing` (`ShareFileModal` is already a foreground `DialPopup` dialog that blocks interaction with its own backdrop — folding its submit state into a page-level flag would be redundant, not additive).
- `DialFileManagerShell` **consolidates** its three existing separate overlay blocks (`isDownloading`, `isDeleting`, `isRenaming && !isMoving`) plus the two currently-missing states (`isUnsharing`, `isRemovingAccess`) into **one** overlay block driven by a single non-nested-ternary label-resolution helper, reusing the exact existing visual/`aria-live` markup. This closes the unshare/remove-access feedback gap without stacking a sixth near-duplicate JSX block on top of the existing five.
- `UploadProgressModal` (upload) and `OperationLoaderModal` (copy/move, with its existing cancel button from #7503) are **left untouched** — they carry richer, operation-specific UX (progress, cancel) that a generic blackout must not replace. Cancelling copy/move already clears `isCopying`/`isMoving` (per `file-manager-copy-move`'s existing cancel-semantics requirement), so `isAnyOperationInProgress` clears automatically by construction — no new wiring needed, just an explicit test asserting it.
- `DialFileManagerModal` replaces its local `isOperationInProgress` recomputation with `hookResult.isAnyOperationInProgress` (kept alongside its existing, separate `isLoading` check) to gate the Attach button — same observable behavior today (the attach action profile cannot reach copy/move/unshare/remove-access), but now backed by the single hook-level contract instead of a host-local enumeration that would silently drift out of sync if the attach profile is ever widened.
- `DialFileManagerPage` (standalone) and the destination-folder popup need **no code change**: both already inherit `DialFileManagerShell`'s consolidated overlay (standalone shares the same shell), and the popup's own action-guard behavior (copy/move calls already internally short-circuit re-entrant calls via existing `isCopying`/`isMoving` checks in `useDialFileManager`, and the shell's blackout already blocks re-triggering an action while one is in flight) is unaffected and requires no new gating.

## Capabilities

### New Capabilities

- `file-manager-operation-ux`: the `isAnyOperationInProgress` hook contract, its exact boolean composition (and the reasoning for each exclusion), the consolidated blackout overlay in `DialFileManagerShell`, and `DialFileManagerModal`'s switch to the shared contract for Attach-button gating.

### Modified Capabilities

_None._ `file-manager-sharing` does not currently state any UI-loading requirement for `onUnshareFiles`/`onRemoveFilesAccess` (it is silent on it), so adding busy-state coverage here is additive, not a change to an existing normative requirement in that spec. The pre-existing `isDownloading`/`isDeleting`/`isRenaming` overlay behavior in `DialFileManagerShell` was never captured as a normative requirement in any archived spec either (it predates `file-manager-shell`'s own spec text), so consolidating its JSX is an implementation detail, not a requirement change.

## Impact

- **Modified file**: `apps/chat/src/hooks/files/useDialFileManager.ts` — add the `isAnyOperationInProgress` derived value (via `useMemo`) to `UseDialFileManagerResult`.
- **Modified file**: `apps/chat/src/components/DialFileManagerShell/DialFileManagerShell.tsx` — replace the three separate overlay blocks with one consolidated block covering five states, driven by a small label-resolution helper (if/else chain, not nested ternaries per this repo's TypeScript conventions).
- **Modified file**: `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx` — remove the local `isOperationInProgress` calculation, read `hookResult.isAnyOperationInProgress` instead (its separate `isLoading` check is unchanged).
- **No backend, no DTO change.** Two new i18n keys (`dialFileManager.unsharingLabel`, `dialFileManager.removingAccessLabel`) following the existing `downloadingLabel`/`deletingLabel`/`renamingLabel` pattern.
- **Not breaking**: purely additive/consolidating; rollback is reverting the three files above independently (they have no cross-dependency beyond the shared hook field).
