## 1. i18n key

- [x] 1.1 Add `dialFileManager.duplicateAction` to `apps/chat/src/i18n/locales/en.json`
- [x] 1.2 Add `DuplicateAction = 'dialFileManager.duplicateAction'` to `DialFileManagerI18nKeys` in `apps/chat/src/constants/translation-keys.ts`

## 2. Hook action-labels wiring

- [x] 2.1 In `useDialFileManager.ts`'s `actionLabels` `useMemo`, add `DialFileManagerActions.Duplicate` for the `my_files` tab when `uploadEnabled`, alongside the existing `Rename`/`Copy`/`Move` entries
- [x] 2.2 Write a unit test in `apps/chat/src/hooks/files/tests/useDialFileManager.spec.tsx`: `my_files` + WRITE includes `Duplicate`; `my_files` without WRITE excludes it; `shared`/`organization` exclude it regardless of permission
- [x] 2.3 Run `npm exec nx test chat` — must pass

## 3. Shell label mapping

- [x] 3.1 Add `duplicateLabel: string` to `DialFileManagerShellLabels` (`apps/chat/src/components/DialFileManagerShell/types/labels.ts`)
- [x] 3.2 In `DialFileManagerShell.tsx`'s `actionLabels` `useMemo`, add `if (DialFileManagerActions.Duplicate in tabActionLabels) { result[DialFileManagerActions.Duplicate] = labels.duplicateLabel; }`, mirroring the existing Copy/Move/Rename entries, and add `labels.duplicateLabel` to the memo's dependency array
- [x] 3.3 Confirm no `isDuplicateFolderAvailable` or `customDuplicateAction` prop is passed to `<DialFileManager>` in `DialFileManagerShell.tsx` (rely on ui-kit defaults per design.md D1/D2) — this is a verification step, not a code-writing step
- [x] 3.4 Write a unit test in `apps/chat/src/components/DialFileManagerShell/tests/DialFileManagerShell.spec.tsx` asserting the rendered `DialFileManager` receives `Duplicate` in its action labels when the hook result includes it
- [x] 3.5 Run `npm exec nx test chat` and `npm exec nx lint chat` — both must pass

## 4. Page label resolution

- [x] 4.1 In `DialFileManagerPage.tsx`, add `duplicateLabel: t(DialFileManagerI18nKeys.DuplicateAction)` to the `labels` object and its `useMemo` dependency array
- [x] 4.2 Run `npm exec nx test chat` and `npm exec nx lint chat` — both must pass

## 5. Same-folder onCopyFiles regression test

- [x] 5.1 Add a test to `apps/chat/src/hooks/files/tests/useDialFileManager.spec.tsx` calling `onCopyFiles` with a `DialCopiedItem[]` whose `sourceUrl`/`destinationUrl` share the same parent folder and differ only by an incremented name segment (simulating ui-kit's `handleDuplicate` output); assert the `CopyItemDto[]` sent to `copyFiles` has the correct `sourcePath`/`destinationPath`, that the single affected folder's cache is invalidated exactly once, and that no error toast fires on success
- [x] 5.2 Add a test for the partial-failure case with a same-folder destination, confirming it reuses the existing `file-manager-copy-move` error-toast behavior unchanged
- [x] 5.3 Run `npm exec nx test chat` — must pass

## 6. Full verification and OpenSpec docs

- [x] 6.1 Run `npm exec nx affected --target=test --base=origin/development-1.0` — all must pass
- [x] 6.2 Run `npm exec nx affected --target=lint --base=origin/development-1.0` — all must pass (one pre-existing, unrelated prettier error in `Login.tsx` predates this change, introduced in `a4a359970`, not touched by this slice)
- [x] 6.3 Run `npm exec nx affected --target=build --base=origin/development-1.0` — all must pass
- [x] 6.4 Confirm no backend/OpenAPI changes were introduced (this slice is frontend-only) — `git status` on `apps/chat-api/` and `libs/chat-api-client/` should show no changes from this slice
