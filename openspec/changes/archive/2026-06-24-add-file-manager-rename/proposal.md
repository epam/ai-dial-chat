## Why

The File Manager lacks rename support (gap matrix row #21), breaking CRUD parity after delete was shipped. Users cannot rename files or folders from the My Files tab, forcing workarounds like download-delete-reupload.

## What Changes

- **New BFF endpoint** `POST /api/v1/files/rename` — proxies DIAL Core `moveResource` for single files and recursively for folders (paginated `expandFolderContents` reuse, same strategy as delete).
- **`FilesService`** gains `renameFileItem` and `renameFolderItem`, with partial-failure reporting mirroring `deleteFiles`.
- **OpenAPI regeneration** — new `renameFiles()` method in `@epam/chat-api-client` and a corresponding wrapper in `apps/chat/src/server-api/files.api.ts`.
- **`useDialFileManager` hook** gains `onRenameValidate`, `onMoveToFiles`, and `isRenaming` — wires ui-kit inline rename.
- **`DialFileManagerModal`** passes rename props and adds `DialFileManagerActions.Rename` to `actionLabels` on the `my_files` tab only (gated by WRITE permission and tab presence).
- Folder rename navigates to the new virtual path when the renamed folder is the current browse location and the rename succeeds.
- Partial folder rename failures surface as toast notifications matching the delete UX pattern.

## Capabilities

### New Capabilities

- `file-manager-rename-api`: BFF rename endpoint — DTO contract, `moveResource` proxy, folder expansion algorithm, partial-failure response, rate limiting, and Swagger annotations.
- `file-manager-rename-ui`: Hook `onRenameValidate` / `onMoveToFiles`, loading state, cache invalidation, path navigation, and modal wiring with tab-gated action labels.

### Modified Capabilities

- `file-manager-tabs`: Rename action is `my_files`-only — the tab action matrix gains a Rename row, confirming Rename is hidden on `shared`, `organization`, and `review` tabs.

## Impact

- **Backend**: `apps/chat-api/src/files/` — new controller route, DTO classes, service methods; `expandFolderContents` extracted or shared with rename.
- **Generated client**: `libs/chat-api-client/` regenerated after Swagger update.
- **Frontend**: `apps/chat/src/server-api/files.api.ts`, `useDialFileManager` hook, `DialFileManagerModal` component, i18n keys in `en.json`.
- **Docs**: OpenSpec capability specs document rename API/UI behavior and the tab action matrix.
- **Dependencies**: No new npm packages; uses existing `@epam/ai-dial-typescript-sdk` `moveResource` and `@epam/ai-dial-ui-kit` inline rename contract (`onMoveToFiles`, `onRenameValidate`).
