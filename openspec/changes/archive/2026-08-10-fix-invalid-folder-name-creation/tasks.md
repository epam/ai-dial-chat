## 1. Defensive validation in `onCreateFolder`

- [x] 1.1 In `apps/chat/src/hooks/files/useDialFileMutations.ts`, after `parseNewFolderVirtualPath` resolves `{ parentVirtualPath, name }` and `parentApiPath` inside `onCreateFolder` (lines 148-196), resolve a `parentFolder: DialFile` for validation: use `currentFolder` directly when its resolved path matches `parentApiPath`; otherwise build a minimal `DialFile` shim (`{ id, path: parentApiPath, name, folderId, nodeType: DialFileNodeType.FOLDER, items: [] }`), per design.md Decision 2. Compares against the hook's own `folderPath` option (bucket-relative path of the currently browsed folder, same trailing-slash format as `parentApiPath`) rather than re-deriving `currentFolder`'s path.
- [x] 1.2 Call `onCreateFolderValidate(name, parentFolder)` before the existing `try`/`createFolder(...)` call, and return early (no `createFolder` call, no `setIsCreatingFolder(true)`/`(false)` flicker, no notification) when it returns a non-null error string.
- [x] 1.3 Confirm `onCreateFolder`'s dependency array (`useCallback`) includes `onCreateFolderValidate` and `currentFolder` after the change. Also moved `onCreateFolderValidate`'s declaration above `onCreateFolder` in the file to avoid a temporal-dead-zone reference error (a `useCallback` dependency array is evaluated eagerly, so `onCreateFolderValidate` must be declared first).

## 2. Tests

- [x] 2.1 Add/extend unit tests for `useDialFileMutations` (`apps/chat/src/hooks/files/tests/mutations/useDialFileMutations.spec.tsx`, existing file) covering: `onCreateFolder` does not call `createFolder` for a name that fails `onCreateFolderValidate` (empty name, forbidden symbol, reserved marker name, duplicate sibling); `onCreateFolder` still calls `createFolder` for a valid name, with the same arguments as before this change.
- [x] 2.2 Add a test for the parent-folder-resolution fallback: when `currentFolder`/`folderPath` do not match the new folder's resolved parent path, `onCreateFolder` still rejects an empty name via the minimal shim without erroring on a missing `items` array.

## 3. Verification

- [x] 3.1 Run `npm exec nx test chat` and confirm the new/updated tests pass and no existing tests regress. (178/178 test files, 2253 passed / 2 skipped, 0 failed.)
- [x] 3.2 Run `npm exec nx lint chat` and fix any violations introduced by the change. (0 errors; same 28 pre-existing warnings as baseline, none in the changed files; typecheck passed.)
- [x] 3.3 Run `npm exec nx affected --target=test --base=origin/development-1.0` and `npm exec nx affected --target=lint --base=origin/development-1.0` to confirm no other affected projects regress. (Test: 178/178 files passed. Lint: 0 errors, 2 pre-existing warnings in unrelated `chat-api` files, none introduced by this change.)
- [ ] 3.4 Manually reproduce the original bug steps from issue #7968 (open the folder-creation UI, type an invalid name/path such as `/invaid/folder`, confirm the inline error appears, then press Enter and separately click the folder row) and confirm no folder is created in either case, while a valid name still creates a folder normally. **Not performed**: requires a running `apps/chat` + `apps/chat-api` with a reachable DIAL Core backend, not available in this sandbox. The exact scenario is covered by the new unit tests instead.
