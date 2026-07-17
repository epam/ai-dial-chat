## 1. Hook: isAnyOperationInProgress

- [x] 1.1 In `apps/chat/src/hooks/files/useDialFileManager.ts`, add `isAnyOperationInProgress` to `UseDialFileManagerResult` (interface + JSDoc listing all four excluded flags — `isLoading`, `isSearching`, `isFileMetadataLoading`, `isSharing` — with a one-line reason each, per design.md D5), computed via `useMemo` from `isCreatingFolder`, `isDownloading`, `isDeleting`, `isRenaming`, `isCopying`, `isMoving`, `isUnsharing`, `isRemovingAccess`, and `uploadBatchState != null`.
- [x] 1.2 Add the new field to the hook's return object alongside the existing operation booleans (near line ~2280-2303).

## 2. i18n keys

- [x] 2.1 Add `dialFileManager.unsharingLabel` and `dialFileManager.removingAccessLabel` to `apps/chat/src/i18n/locales/en.json`.
- [x] 2.2 Add matching `DialFileManagerI18nKeys.UnsharingLabel`/`RemovingAccessLabel` members to `apps/chat/src/constants/translation-keys.ts`, next to the existing `Downloading`/`DeletingLabel`/`RenamingLabel` members.

## 3. Shell: consolidate the three overlay blocks into one

- [x] 3.1 Add `unsharingLabel`/`removingAccessLabel` fields to `DialFileManagerShellLabels` (`apps/chat/src/components/DialFileManagerShell/types/labels.ts`).
- [x] 3.2 In `DialFileManagerShell.tsx`, destructure `isUnsharing`/`isRemovingAccess` from `hookResult` (already returned by the hook; not currently destructured in the shell).
- [x] 3.3 Add a small helper (co-located in the shell file, or in `apps/chat/src/utils/` if it grows beyond a few lines) that resolves the overlay's `ariaLabel` via an if/else chain (not nested ternaries) over the precedence order `isDownloading → isDeleting → (isRenaming && !isMoving) → isUnsharing → isRemovingAccess`, returning `undefined` when none apply.
- [x] 3.4 Replace the three existing separate overlay blocks (`isDownloading`, `isDeleting`, `isRenaming && !isMoving`) with **one** block: `{overlayLabel != null && <div aria-live="polite" className="absolute inset-0 z-[52] flex items-center justify-center bg-blackout desktop:p-4"><DialSpinner size={32} fullWidth={false} ariaLabel={overlayLabel} /></div>}`.
- [x] 3.5 Populate `unsharingLabel: t(DialFileManagerI18nKeys.UnsharingLabel)` and `removingAccessLabel: t(DialFileManagerI18nKeys.RemovingAccessLabel)` in both `DialFileManagerModal.tsx`'s and `DialFileManagerPage.tsx`'s `labels` construction.

## 4. Modal: consume the shared flag

- [x] 4.1 In `DialFileManagerModal.tsx`, delete the local `isOperationInProgress` calculation (lines ~403-408) and use `hookResult.isAnyOperationInProgress` in its place for the Attach-button disabled condition, keeping the existing separate `isLoading` check unchanged.

## 5. Unit tests

- [x] 5.1 Add/extend `useDialFileManager` hook tests to cover `isAnyOperationInProgress`'s composition: true for each of the eight covered flags individually, true when `uploadBatchState` is non-null, false when only `isLoading`/`isSearching`/`isFileMetadataLoading`/`isSharing` is true (one test per excluded flag), false when nothing is active, and false again immediately after `cancelCopyMove` clears `isCopying`/`isMoving`.
- [x] 5.2 Add/extend `DialFileManagerShell` component tests: the consolidated overlay renders with the correct label for each of the five covered flags individually, renders nothing when none are true, and does not render during `isCopying`/`isMoving`/upload/`isSharing` (asserting the existing dedicated modals still render instead). Add a dedicated test for the label-resolution helper's precedence order.
- [x] 5.3 Add/extend `DialFileManagerModal` component tests: Attach button is disabled when `hookResult.isAnyOperationInProgress` is true, enabled otherwise, and still independently disabled when only `isLoading` is true — replacing any existing test that asserted against the old local `isOperationInProgress` variable name/shape.
- [x] 5.4 Test names describe observable behavior (e.g., "disables Attach while any file operation is in progress", "shows the unsharing label instead of the deleting label when unshare takes precedence"), not implementation details. Use role/label/text queries, not implementation-specific selectors.

## 6. RTL and accessibility

- [x] 6.1 Confirm the consolidated overlay introduces no physical-direction Tailwind classes (it reuses `inset-0`/flex-centering, already direction-agnostic) and correctly announces via `aria-live="polite"` in both LTR and RTL — no new task beyond visual confirmation since no new logical/physical class is added.

## 7. Verification

- [x] 7.1 Run `npm exec nx test chat` for `useDialFileManager`, `DialFileManagerShell`, and `DialFileManagerModal` test suites.
- [x] 7.2 Run `npm exec nx lint chat`.
- [x] 7.3 Close with `npm exec nx affected --target=test --base=origin/development-1.0` and `npm exec nx affected --target=lint --base=origin/development-1.0`.
