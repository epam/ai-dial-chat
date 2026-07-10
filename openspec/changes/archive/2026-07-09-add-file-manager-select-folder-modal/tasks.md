## 1. i18n keys

- [x] 1.1 Add the nine i18n keys listed in `specs/file-manager-folder-picker/spec.md` (`folderPickerAddFolderLabel`, `folderPickerHiddenFilesLabel`, `copyHeaderSingle`, `copyHeaderMultiple`, `moveHeaderSingle`, `moveHeaderMultiple`, `moveSourceDisabledTooltip`, `folderPickerEmptyStateTitle`, `folderPickerEmptyStateDescription`) to `apps/chat/src/i18n/locales/en.json`
- [x] 1.2 Add matching enum members to `DialFileManagerI18nKeys` in `apps/chat/src/constants/translation-keys.ts`

## 2. Shell labels and options wiring

- [x] 2.1 Extend `DialFileManagerShellLabels` (`apps/chat/src/components/DialFileManagerShell/types/labels.ts`) with `addFolderLabel`, `hiddenFilesSwitcherLabel`, `getCopyHeader: (count: number, name?: string) => string`, `getMoveHeader: (count: number, name?: string) => string`, `moveSourceDisabledTooltip`, `folderPickerEmptyStateTitle`, `folderPickerEmptyStateDescription`
- [x] 2.2 Derive the `DialFileManagerDestinationFolderPopupOptions` type alias in `labels.ts` the same way `ConflictResolutionPopupOptions`/`RenameValidationMessages` are already derived (`NonNullable<DialFileManagerComponentProps['destinationFolderPopupOptions']>`)
- [x] 2.3 In `DialFileManagerShell.tsx`, add a `destinationFolderPopupOptions` `useMemo` mapping `labels.copyLabel`/`labels.moveLabel`/`labels.addFolderLabel`/`labels.hiddenFilesSwitcherLabel`/`labels.getCopyHeader`/`labels.getMoveHeader`/`labels.moveSourceDisabledTooltip`/`labels.folderPickerEmptyStateTitle`/`labels.folderPickerEmptyStateDescription` onto the ui-kit option fields (`copyLabel`, `moveLabel`, `addFolderLabel`, `hiddenFilesSwitcherLabel`, `getCopyHeader`, `getMoveHeader`, `disabledPathTooltip`, `emptyStateTitle`, `emptyStateDescription`), following the existing `deleteConfirmationOptions`/`conflictResolutionPopupOptions` `useMemo` pattern in the same file
- [x] 2.4 Pass `destinationFolderPopupOptions` as a new prop to the `<DialFileManager>` element in `DialFileManagerShell.tsx`
- [x] 2.5 Run `npm exec nx lint chat` and `npm exec nx build chat` — both must pass (typecheck clean; the one pre-existing `eslint` failure in `Login.tsx`/`test-setup.ts`/`apply-chunk.spec.ts` is unrelated to this change — those files are untouched)

## 3. sourceFolder for move mode

- [x] 3.1 In `DialFileManagerShell.tsx`, compute the common parent folder of the current `selectedPaths` (reuse the same parent-folder derivation already used by `add-file-manager-copy-move`'s `onMoveToFiles` same-folder/cross-folder partition in `useDialFileManager.ts` — extract it to a shared helper in `apps/chat/src/utils/resolve-dial-file-api-path.ts` if not already exported, rather than duplicating the logic)
- [x] 3.2 Pass the computed common parent as `destinationFolderPopupOptions.sourceFolder` only when every selected item shares that parent; pass `undefined` when the selection spans multiple parents
- [x] 3.3 Write a unit test in `apps/chat/src/components/DialFileManagerShell/tests/DialFileManagerShell.spec.tsx` covering: single-parent selection sets `sourceFolder`, multi-parent selection leaves it `undefined`
- [x] 3.4 Run `npm exec nx test chat` — must pass

## 4. DialFileManagerPage label resolution

- [x] 4.1 In `DialFileManagerPage.tsx`, add `addFolderLabel: t(DialFileManagerI18nKeys.FolderPickerAddFolderLabel)`, `hiddenFilesSwitcherLabel: t(DialFileManagerI18nKeys.FolderPickerHiddenFilesLabel)`, `moveSourceDisabledTooltip: t(DialFileManagerI18nKeys.MoveSourceDisabledTooltip)`, `folderPickerEmptyStateTitle: t(DialFileManagerI18nKeys.FolderPickerEmptyStateTitle)`, `folderPickerEmptyStateDescription: t(DialFileManagerI18nKeys.FolderPickerEmptyStateDescription)` to the `labels` object
- [x] 4.2 Add `getCopyHeader`/`getMoveHeader` as `useCallback`s (or inline functions inside the existing `labels` `useMemo`) that branch on `count === 1` to call `t(DialFileManagerI18nKeys.CopyHeaderSingle, { name })` / `t(DialFileManagerI18nKeys.CopyHeaderMultiple, { count })` and the Move equivalents — mirror the existing `deleteConfirmTitle`/`deleteConfirmBody` branching style already in this file
- [x] 4.3 Add the new fields to the `labels` `useMemo`'s dependency array (no change needed — new fields close over `t` only, already listed)
- [x] 4.4 Run `npm exec nx test chat` and `npm exec nx lint chat` — both must pass

## 5. Verify add-folder path targeting inside the popup

- [x] 5.1 Write an integration test (in `DialFileManagerShell.spec.tsx` or `DialFileManagerPage.spec.tsx`, whichever can drive the popup's internal folder-creation call) that opens the destination-folder popup, navigates to a folder different from the outer grid's current folder, triggers folder creation, and asserts `onCreateFolder` (from `useDialFileManager`) is called with the popup's browsed path — not the outer grid's path (implemented as: a hook-level regression test in `useDialFileManager.spec.tsx` proving `onCreateFolder`'s call-time path argument wins over the hook's own current `folderPath`, plus a shell-level test in `DialFileManagerShell.spec.tsx` proving the shell forwards `onCreateFolder` to `DialFileManager` unchanged — real ui-kit popup internals are never unmocked elsewhere in this suite, so this is the faithful equivalent within existing conventions)
- [x] 5.2 If the test reveals the fallback resolves to the wrong path, add an explicit `onCreateFolder`/`onCreateFolderValidate` override inside `destinationFolderPopupOptions` that reads the popup's own current path instead of relying on the inherited outer-prop fallback (design.md D5's contingency) — do this only if 5.1 fails; do not add speculative code if the fallback already works (not needed — 5.1 confirms the fallback already resolves correctly)
- [x] 5.3 Run `npm exec nx test chat` — must pass

## 6. Full verification and OpenSpec docs

- [x] 6.1 Run `npm exec nx affected --target=test --base=origin/development-1.0` — all must pass (98 test files, 877 passed, 2 pre-existing skips, 0 failed)
- [x] 6.2 Run `npm exec nx affected --target=lint --base=origin/development-1.0` — all must pass (typecheck clean for all affected projects; `@epam/chat:lint`'s one `prettier/prettier` error in `Login.tsx` is pre-existing on `origin/development-1.0` — confirmed via `git diff origin/development-1.0 -- apps/chat/src/pages/auth/Login.tsx` showing no diff — and unrelated to this change)
- [x] 6.3 Run `npm exec nx affected --target=build --base=origin/development-1.0` — all must pass
- [x] 6.4 Confirm no backend/OpenAPI changes were introduced (this slice is frontend-only) — `git status` on `apps/chat-api/` and `libs/chat-api-client/` should show no changes from this slice (confirmed clean)
