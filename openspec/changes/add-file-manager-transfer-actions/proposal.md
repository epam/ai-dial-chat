# Proposal: Add File Manager Transfer Actions

## Problem

The `DialFileManagerModal` in `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx` (lines 129–148) currently configures `DialFileManager` in read-only browse-and-attach mode. Users cannot upload new files, create folders, or download files or folders they see in the manager. This limits the file manager to passive selection only, forcing users to rely on other tooling to populate their DIAL file storage.

## Solution

Extend the existing `DialFileManagerModal` and its supporting hook `useDialFileManager` (`apps/chat/src/hooks/files/useDialFileManager.ts`) to enable three transfer directions:

1. **Upload** — select one or more local files and upload them into the currently browsed folder via the existing `POST /api/v1/files` endpoint, with a focused per-file status modal.
2. **Create folder** — create a persistent folder via a new `POST /api/v1/files/folders` BFF endpoint that uploads a zero-byte marker object to DIAL Core (confirmed strategy — SDK provides no dedicated folder primitive).
3. **Download** — stream a single file via the existing `GET /api/v1/files/download` endpoint; download a folder or a mixed/bulk selection as a ZIP archive via a new `POST /api/v1/files/download-archive` endpoint.

The three new `DialFileManager` callbacks — `onUploadFiles`, `onCreateFolder`, and `onDownloadFiles` — are wired at the app edge (`DialFileManagerModal`) and orchestrated through `useDialFileManager`. DIAL paths are constructed only in `apps/chat-api` or in `apps/chat/src/server-api/`; hand-authored libraries (`libs/*`) remain ignorant of endpoints, SDK, and storage details.

## Non-Goals

- Delete, rename, move, copy files or folders
- Sharing and permissions management
- Uploading ZIP archives and auto-extracting them (`onUploadArchive`)
- Resumable or chunked upload (no byte-level progress if the generated client cannot report it)
- Background download jobs that survive page navigation
- Persisting upload/download operation state after page reload
- New global state-management solution
- Changing the existing "Attach" footer behavior or multi-select model

## Acceptance Criteria

### Upload
- [ ] Users can select one or more local files from the toolbar "Upload files" action; they are uploaded into the current folder.
- [ ] An upload status modal shows per-file name and status (queued → uploading → completed | failed | cancelled).
- [ ] Only per-file indeterminate status is shown (no byte-level progress bar) unless the transport can report it.
- [ ] Duplicate filenames: `onValidateUpload` checks existing items and returns an error result; the upload does not silently overwrite.
- [ ] A partially failed batch keeps successfully uploaded files.
- [ ] Cancellation is offered; confirmed cancellable files are skipped.
- [ ] The folder cache is invalidated and refreshed after the batch completes.

### Folder creation
- [ ] Users can click "New folder" in the toolbar to create a named folder.
- [ ] The folder persists after a page refresh (backed by a marker object in DIAL Core).
- [ ] Duplicate sibling name and invalid name (traversal, leading slash, reserved marker name) return validation errors via `onCreateFolderValidate` before the BFF is called.
- [ ] Conflict (`409`) from the BFF surfaces a user-visible error (handled by `DialFileManager` ui-kit).
- [ ] The marker object `.dial_folder` is included in file listings and archive downloads; the ui-kit "Hidden files" toggle controls its visibility in the grid.
- [ ] The parent folder cache is refreshed after successful creation.

### Download
- [ ] A single selected file is streamed directly via the existing download endpoint; the browser saves it with the original filename.
- [ ] A single selected folder or a mixed/multi-item selection triggers the archive endpoint; the browser saves `<folder-name>.zip` or `files.zip`.
- [ ] Download is accessible from the "Download" bulk-actions toolbar and from applicable row/tree context actions.
- [ ] The UI shows a disabled/loading state while an archive is being prepared.
- [ ] An error toast is shown if the download fails.
- [ ] Archive entries have correct relative paths; no ZIP-slip paths; no duplicate entry conflicts.

### General
- [ ] The existing "Attach" footer action, multi-selection, and read-only browse behavior are unchanged.
- [ ] Delete, rename, move, copy, share, permissions actions remain absent from the UI.
- [ ] All new user-visible strings use i18n keys from `en.json`.
- [ ] The modal and upload status modal work on mobile and desktop.
- [ ] Logical Tailwind classes and RTL-mirrored directional icons are used throughout.
- [ ] All new NestJS endpoints are authenticated via the existing session guard.
- [ ] `libs/*` (other than `libs/chat-api-client`) contain no app-owned integration details.
- [ ] `libs/chat-api-client` is regenerated via `npm run openapi`; no generated files are hand-edited.

## Alternatives Considered

### Option A — All orchestration on the frontend (reuse existing endpoints only)

For bulk download, the frontend would fetch each file individually and assemble a ZIP using a browser-side library. Rejected: streaming multi-file ZIPs from the browser is memory-intensive, does not support real backpressure, and requires loading full file contents into the browser's heap. For large folders this is impractical.

### Option B — Dedicated BFF endpoints for all operations

Upload: new `POST /api/v1/files/bulk-upload` receives all files in one multipart request. Rejected: the existing single-file endpoint already works, the ui-kit's `onUploadFiles` fires per-selection (not per-file), and adding per-file state requires frontend orchestration regardless. Reusing the existing endpoint is simpler and avoids a contract change.

Folder creation: reuse upload endpoint with a zero-byte file at a sentinel path. Rejected: the folder path becomes dependent on client-chosen sentinel names, and the marker must be hidden from listings. A dedicated `POST /api/v1/files/folders` endpoint encapsulates the marker strategy on the server, keeps the contract stable if the marker strategy changes, and allows proper `409` conflict reporting.

### Option C (Recommended) — Hybrid approach

- **Upload**: reuse `POST /api/v1/files` per file, orchestrated concurrently from the frontend (bounded concurrency, `AbortSignal` per file).
- **Folder creation**: new `POST /api/v1/files/folders` endpoint wrapping a zero-byte marker upload to DIAL Core.
- **Single-file download**: existing `GET /api/v1/files/download` endpoint, raw generated method.
- **Folder/bulk download**: new `POST /api/v1/files/download-archive` endpoint; server streams a ZIP via `archiver`.

This avoids buffering full archives in the browser, avoids a new multipart bulk-upload contract, and keeps folder marker logic server-side.

## Recommended Architecture

**Hybrid** (Option C above). See `design.md` for full details.

## Backward Compatibility

- The existing `POST /api/v1/files`, `GET /api/v1/files/list`, and `GET /api/v1/files/download` contracts are unchanged.
- `DialFileManagerModal.Props` gains optional new props (`onUploadFiles`, `onCreateFolder`, `onDownloadFiles`, upload-state labels); the existing props (`bucket`, `title`, `attachLabel`, etc.) are unchanged and all new props have sensible defaults so existing callers continue to work.
- `UseDialFileManagerResult` gains new optional fields; existing destructuring patterns continue to compile.
- The folder marker `.dial_folder` (`HIDDEN_FILE` from `@epam/ai-dial-chat-shared`) is a server-owned implementation detail. `FilesService.listFiles` returns marker items as-is; the file manager ui-kit hides them via the "Hidden files" toggle. Existing callers that do not create folders are unaffected.

## Rollback Plan

1. Remove `onUploadFiles`, `onCreateFolder`, `onDownloadFiles` props from `DialFileManagerModal` (revert to read-only config).
2. Delete `POST /api/v1/files/folders` and `POST /api/v1/files/download-archive` controller handlers and service methods.
3. Revert `useDialFileManager` cache-merge logic for folder creation.
4. Regenerate `libs/chat-api-client` to remove the two new generated methods.

None of these steps requires a database migration or infrastructure change.

## Closest Existing Files

| File | Relevance |
|------|-----------|
| `apps/chat-api/src/files/files.controller.ts:38` | Upload handler pattern to follow for folder-create and archive endpoints |
| `apps/chat-api/src/files/files.service.ts:41` | Service pattern with SDK client, error mapping, timeout |
| `apps/chat-api/src/common/utils/dial-error.ts` | `handleDialError` used by all new service methods |
| `apps/chat/src/hooks/files/useDialFileManager.ts:100` | Hook to extend with upload/folder/download state |
| `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx:129` | Component to extend with new callbacks and upload status modal |
| `apps/chat/src/server-api/files.api.ts:7` | Thin wrapper pattern for new generated methods |
| `libs/chat-api-client/src/generated/src/apis/FilesApi.ts` | Generated client to regenerate after new endpoints |

## i18n Impact

New user-visible strings required (keys in `apps/chat/src/i18n/locales/en.json`):

| Key | English |
|-----|---------|
| `dialFileManager.upload` | `"Upload files"` |
| `dialFileManager.newFolder` | `"New folder"` |
| `dialFileManager.download` | `"Download"` |
| `dialFileManager.uploading` | `"Uploading"` |
| `dialFileManager.uploadComplete` | `"Complete"` |
| `dialFileManager.uploadFailed` | `"Failed"` |
| `dialFileManager.uploadCancelled` | `"Cancelled"` |
| `dialFileManager.uploadQueued` | `"Queued"` |
| `dialFileManager.uploadCancelAll` | `"Cancel all"` |
| `dialFileManager.uploadDone` | `"Done"` |
| `dialFileManager.uploadProgressTitle` | `"Uploading files"` |
| `dialFileManager.uploadConflict` | `"A file with this name already exists"` |
| `dialFileManager.downloadError` | `"Download failed"` |
| `dialFileManager.folderCreateError` | `"Failed to create folder"` |
| `dialFileManager.folderConflict` | `"A folder with this name already exists"` |

## Scope Impact

| Layer | Impact |
|-------|--------|
| `apps/chat-api` | New `POST /api/v1/files/folders` and `POST /api/v1/files/download-archive` handlers and service methods in the existing `files` domain; new DTOs; `archiver` npm dependency added to `apps/chat-api` |
| `apps/chat/src/server-api/` | New `createFolder` and `downloadArchive` wrapper functions in `files.api.ts` |
| `apps/chat/src/hooks/files/useDialFileManager.ts` | Extended with upload batch state, folder-creation state, download state |
| `apps/chat/src/components/DialFileManagerModal/` | New callback props wired; new `UploadProgressModal` component |
| `libs/chat-api-client` | Regenerated — new `createFolder` and `downloadArchive`/`downloadArchiveRaw` generated methods |
| `libs/*` (hand-authored) | No changes — library isolation maintained |
