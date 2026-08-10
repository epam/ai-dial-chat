## Why

In the Publish dialog's "select destination folder" popup, typing an invalid folder name/path (e.g. `/invaid/folder`) shows a validation error, but pressing Enter or clicking the folder row still creates the folder. Validation and creation are two independent, uncoordinated callbacks passed into the external `DialDestinationFolderPopup` (`@epam/ai-dial-ui-kit`) component, and the create-folder handlers in this repo never check the validation result before dispatching. This lets users create folders with names/paths that the app itself considers invalid ([#7968](https://github.com/epam/ai-dial-chat/issues/7968)).

## What Changes

- `handleCreateOrganizationFolder` in `apps/chat/src/components/Chat/ChangePathDialog.tsx` (lines 596-611) must call the existing validation (`handleCreateFolderValidate` / `handleRenameValidation`) and return early without dispatching `FilesActions.addFolders` when the name/path is invalid — mirroring the early-return pattern already used in `apps/chat/src/components/Folder/Folder.tsx`'s `handleRename` (lines 456-540).
- `handleCreateFolder` in `apps/chat/src/components/FileManager/hooks/useFileManager.tsx` (lines 1557-1576) must likewise call `handleRenameValidation` and return early without dispatching `FilesActions.createNewFolder` when invalid, since it has the identical gap and backs the same "create folder" affordance for the generic file manager.
- No change to the external `@epam/ai-dial-ui-kit` package: it isn't part of this repo, so the fix must not rely on the ui-kit gating `onCreateFolder` on `onCreateFolderValidate` — validation must be enforced independently at the two call sites above.
- Add unit test coverage for both handlers confirming an invalid name/path does not dispatch a create-folder action and a valid one does.

## Non-goals

- Not changing the `@epam/ai-dial-ui-kit` `DialDestinationFolderPopup` component itself (out of repo scope).
- Not changing the validation rules/regex used to determine an invalid folder name — only enforcing the existing validation before creation.
- Not addressing folder rename or other file-manager create/rename flows beyond the two call sites identified (they already validate correctly, e.g. `Folder.tsx`).

## Capabilities

### New Capabilities

- `file-manager-folder-creation`: validating a folder name/path before it is created, in both the Publish dialog's destination-folder picker and the generic file manager, rejecting creation when the name/path is invalid.

### Modified Capabilities

None (no existing spec currently covers file-manager folder creation).

## Impact

- Affected store domain: `apps/chat/src/store/files` (`FilesActions.addFolders`, `FilesActions.createNewFolder`).
- Affected components: `apps/chat/src/components/Chat/ChangePathDialog.tsx`, `apps/chat/src/components/FileManager/hooks/useFileManager.tsx`.
- No new API routes; this is a pure client-side validation-gating fix, no server session validation implications.
- No new dependencies.
