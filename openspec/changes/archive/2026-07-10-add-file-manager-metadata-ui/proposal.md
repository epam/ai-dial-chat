## Why

The standalone DIAL File Manager has no way to view a file's details (size, type, author, permissions, dates). `GET /api/v1/files/metadata` and the frontend `getFileMetadata()` wrapper already exist (shipped as part of earlier #7503 work) and the installed `@epam/ai-dial-ui-kit` already defines `DialFileManagerActions.Info`, the `onGetInfo(file: DialFile)` callback, and the `fileMetadataPopupOptions` prop on `DialFileManager` (confirmed via `getEntityDetails("component", "DialFileManager")` and the installed package's `.d.ts`) — but nothing in `apps/chat` wires them together. This is step 14 of the #7504 migration roadmap (GitHub #7504 row 42), a pure frontend-wiring slice: no BFF contract changes are needed because the existing metadata endpoint and DTO already cover this capability's data needs.

This change also confirms and corrects a scoping assumption carried over from the original #7504 request: the installed ui-kit's `FileMetadataPopupOptions` type is `{ fileMetadata?: DialFile; loading?: boolean; clearMetadata?: () => void }` — it does **not** accept label strings (title/name/path/size/author labels). Those are rendered entirely by ui-kit itself. This is a deliberate simplification from the legacy Redux `useFileManager`'s metadata popup, which did pass label strings to an older ui-kit version. This change's i18n scope is therefore limited to the `Info` action's own menu label — there is no popup-field-label translation work to do, because the host has no prop surface to do it through.

## What Changes

- **`useDialFileManager` hook**: adds `fileMetadata: DialFile | undefined`, `isFileMetadataLoading: boolean`, `onGetInfo(file: DialFile)`, and `clearMetadata()`. `onGetInfo` resolves the clicked item's `bucket`/relative path using the same per-tab resolution already used by `onDownloadFiles` (current user's bucket on `my_files`; owner bucket via the existing `sharedRootMetaRef`/`resolveOwnerCoords` helper for nested `shared` folders, or the item's own already-resolved bucket for root-level shared items; the public bucket on `organization`), then calls the existing `getFileMetadata` server-api wrapper.
- **Folder metadata is out of scope for this slice**: `GetFileMetadataQueryDto.path` rejects any path ending in `/` (confirmed in `apps/chat-api/src/files/dto/get-file-metadata.dto.ts`), so the current BFF endpoint cannot return folder metadata. `Info` is therefore only exposed for items with `nodeType !== folder`. Extending the BFF to support folder metadata is an explicit non-goal, tracked as an open question.
- **`DialFileManagerShell`** wires `fileMetadataPopupOptions={{ fileMetadata, loading: isFileMetadataLoading, clearMetadata }}` and includes `DialFileManagerActions.Info` in `gridOptions.actionLabels` (grid only — the installed ui-kit does not expose `Info` in `treeOptions.actionLabels` or `bulkActionsToolbarOptions.actionLabels`, confirmed from the type definitions) when the row is a file and `actionProfile === Full`.
- **`file-manager-tabs`** capability: the per-tab action-label table gains an `Info` row, available on `my_files`, `shared`, and `organization` (read-only, so not tab-restricted the way write actions are), file-only, gated on `actionProfile === Full`.

**Non-breaking**: additive hook state and shell wiring only; no endpoint, DTO, or generated-client changes. `Browse`/`Attach` action matrices are untouched (Info is `Full`-only, same gating introduced by `add-file-manager-sharing`).

## Capabilities

### New Capabilities

- `file-manager-metadata`: `onGetInfo`/`fileMetadataPopupOptions` wiring against the existing `GET /api/v1/files/metadata` endpoint, per-tab bucket/path resolution, and the file-only/`Full`-only gating rule.

### Modified Capabilities

- `file-manager-tabs`: per-tab action-label table gains an `Info` row (grid only, file-only, `Full`-profile-only, available on all three tabs).

## Impact

- **Backend**: none. `GET /api/v1/files/metadata`, `FileMetadataResponseDto`, and `GetFileMetadataQueryDto` are unchanged.
- **Generated client**: none. `getFileMetadata` already exists in `libs/chat-api-client/src/generated/src/apis/FilesApi.ts` and `apps/chat/src/server-api/files.api.ts`.
- **Frontend**: `useDialFileManager` hook (new metadata state + `onGetInfo`/`clearMetadata`), `DialFileManagerShell` (new `fileMetadataPopupOptions` wiring, `Info` action-label gating), i18n key for the `Info` action label only.
- **Docs**: OpenSpec capability spec documents the wiring and the corrected (label-free) scope of `fileMetadataPopupOptions`; `file-manager-tabs` spec gains the `Info` row.
- **Dependencies**: none new.
- **Depends on**: `add-file-manager-sharing` (introduces the `isShareActionsAllowed`/`Full`-profile gating pattern this change reuses for `Info`; should be archived first so the gating helper already exists, though this change can proceed independently if that helper is generalized here instead).
- **Out of scope**: folder metadata (BFF change required, not attempted here), ZIP archive upload (`add-file-manager-upload-archive`), switching `DialFileManagerPage` to `actionProfile=Full` (deferred until upload-archive also ships).
