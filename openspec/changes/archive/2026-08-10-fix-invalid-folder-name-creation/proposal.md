## Why

`onCreateFolder` in `useDialFileMutations` (`apps/chat/src/hooks/files/useDialFileMutations.ts:148-196`) trusts the vendor `DialFileManager` (`@epam/ai-dial-react-file-manager`) to call `onCreateFolderValidate` first and block confirmation on an invalid name. Per [#7968](https://github.com/epam/ai-dial-chat/issues/7968), that assumption does not hold: confirming folder creation (Enter, or clicking the folder row) while a validation error is shown still creates the folder, because `onCreateFolder` never re-checks the name itself before calling the create-folder API.

## What Changes

- `onCreateFolder` (`useDialFileMutations.ts:148-196`) must resolve the same `parentFolder: DialFile` that `onCreateFolderValidate` would receive for the new folder's parent path, call `onCreateFolderValidate(name, parentFolder)` itself, and return without calling `createFolder(...)` when it returns a non-null error — independent of whatever the vendor `DialFileManager` component did or didn't check.
- No change to `onCreateFolderValidate`'s validation rules (empty name, forbidden symbols, leading dot, reserved marker name, length, sibling conflict) — the existing rules are reused as-is.
- No change to the `POST /api/v1/files/folders` backend contract — the BFF's own `CreateFolderDto` validation and the `409` marker-conflict check already exist as separate, independent guards and are unaffected.
- Add unit test coverage in `useDialFileMutations`'s test suite asserting that `onCreateFolder` does not call `createFolder(...)` for a name that fails `onCreateFolderValidate`, and does call it for a valid name.

## Non-goals

- Not changing or patching the vendor `@epam/ai-dial-react-file-manager` component's own Enter-key/confirm handling (out of repo scope; its internal validation-gating behavior is what this change works around).
- Not changing the backend `CreateFolderDto` validation or the marker-conflict (`409`) logic in `FilesFolderService`.
- Not touching the rename flow (`onRenameValidate`/`onMoveToFiles`), which is a separate code path from folder creation and is not what issue #7968 reports.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `file-manager-folder-creation`: `onCreateFolder` must independently re-validate the folder name/parent against `onCreateFolderValidate` before calling the create-folder API, instead of relying solely on the host `DialFileManager` component to have gated confirmation on the validation result.

## Impact

- Affected hook: `apps/chat/src/hooks/files/useDialFileMutations.ts` (`onCreateFolder`, reusing the existing `onCreateFolderValidate`).
- Affected consumers (unchanged behavior for valid input, newly guarded for invalid input): `useDialFileManager` → `DialFileManagerModal`, `DialFileManagerPage`, `NewConversationComposer`'s attach flow.
- No new API routes; no change to `POST /api/v1/files/folders` session validation.
- No new dependencies.
