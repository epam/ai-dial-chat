## 1. Publish dialog destination-folder fix

- [x] 1.1 In `@/src/components/Chat/ChangePathDialog.tsx`, resolve the parent `DialFile` and folder display name for a given `folderPath` (using `filesFoldersRef.current` / existing helpers) so `handleCreateFolderValidate(name, parentFolder)` can be called from `handleCreateOrganizationFolder`.
- [x] 1.2 In `handleCreateOrganizationFolder` (`ChangePathDialog.tsx:596-611`), call `handleCreateFolderValidate` with the resolved name/parent before the existing dedup/empty-name checks, and return early (no ref mutation, no `dispatch(FilesActions.addFolders(...))`) when it returns a non-null error string.
- [x] 1.3 Verify `deduplicatedFileIdsRef`, `addedTempFolderIdsRef`, and `pendingNewFolderIdRef` are left untouched on the invalid-name early-return path, so a corrected retry with a valid name still works.

## 2. Generic file manager fix

- [x] 2.1 In `@/src/components/FileManager/hooks/useFileManager.tsx`, resolve the parent `DialFile` for `folderPath`/`fileId` (using existing helpers such as `getFolderIdFromEntityId` and the folders selector already in scope) so `handleCreateFolderValidate(name, parentFolder)` can be called from `handleCreateFolder`.
- [x] 2.2 In `handleCreateFolder` (`useFileManager.tsx:1557-1576`), call `handleCreateFolderValidate` before the existing max-depth check, and return early (no `deduplicatedFileIdsRef` mutation, no `dispatch(FilesActions.createNewFolder(...))`) when it returns a non-null error string.

## 3. Tests

- [x] 3.1 Add unit tests for `handleCreateOrganizationFolder` in `apps/chat/src/components/Chat/tests/ChangePathDialog.spec.tsx` (new test file, per this repo's `.spec.tsx`/`tests/` convention) covering: invalid name/path does not dispatch `FilesActions.addFolders`; valid name dispatches it as before.
- [x] 3.2 Add unit tests for `handleCreateFolder` in `apps/chat/src/components/FileManager/hooks/tests/useFileManager.spec.tsx` (new test file) covering: invalid name/path does not dispatch `FilesActions.createNewFolder`; valid name dispatches it as before.

## 4. Verification

- [x] 4.1 Run `npm exec nx test chat` and confirm the new tests pass and no existing tests regress. (60/60 test files, 688 passed / 19 skipped, 0 failed.)
- [x] 4.2 Run `npm exec nx lint chat` and fix any violations introduced by the change. (0 errors; 28 pre-existing warnings, none in the changed files.)
- [ ] 4.3 Manually reproduce the original bug steps from issue #7968 (Publish dialog → new folder → invalid name e.g. `/invaid/folder` → Enter, and → click near folder row) and confirm no folder is created in both cases, while a valid name still creates a folder normally. **Not performed**: running the chat app requires a live DIAL Core backend (`DIAL_API_HOST`) not available in this sandbox. The exact scenario (validation error present, folder-creation triggered) is covered by the new unit tests instead.
