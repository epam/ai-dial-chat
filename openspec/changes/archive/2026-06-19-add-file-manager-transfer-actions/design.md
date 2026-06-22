# Design: Add File Manager Transfer Actions

## 1. Current Implementation Assessment

### Backend (`apps/chat-api/src/files/`)

`FilesController` exposes three endpoints (all versioned at `/api/v1/files`):

| Method | Path | Handler | Status |
|--------|------|---------|--------|
| `POST` | `/api/v1/files` | `uploadFile` | Exists — reused |
| `GET` | `/api/v1/files/list` | `listFiles` | Exists — extended (listing permissions from marker) |
| `GET` | `/api/v1/files/download` | `downloadFile` | Exists — reused |

`FilesService` uses `@epam/ai-dial-typescript-sdk` (`0.1.0-dev.24`) for `uploadFile`, `downloadFile`, and `getFileMetadata`. The SDK exposes **no dedicated folder creation method** — only `uploadFile(bucket, path, init)` mapped to `PUT /v1/files/{bucket}/{path}`. Folder creation must be implemented as a zero-byte marker upload (see §4).

Error mapping uses `handleDialError` in `apps/chat-api/src/common/utils/dial-error.ts`.

### Frontend (`apps/chat`)

`useDialFileManager` (`apps/chat/src/hooks/files/useDialFileManager.ts`) owns per-modal folder-navigation state and a folder cache. It exposes `{ items, isLoading, error, path, onPathChange, retry }`.

`DialFileManagerModal` (`apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`) configures `DialFileManager` in read-only mode. The callbacks `onUploadFiles`, `onCreateFolder`, and `onDownloadFiles` are intentionally omitted in the current implementation (per `openspec/specs/dial-file-system-picker/spec.md` line 93–103).

`files.api.ts` has `listFiles`, `uploadFile`, and `downloadFile` thin wrappers.

The generated `@epam/chat-api-client` `FilesApi` has methods: `downloadFile`, `downloadFileRaw`, `listFiles`, `uploadFile`.

### UI Kit (`@epam/ai-dial-ui-kit`)

`DialFileManager` props relevant to this change (confirmed from `components-manifest.json`):

| Prop | Type | Purpose |
|------|------|---------|
| `onUploadFiles` | `(files: DialUploadFileItem[], destinationFolder: string) => void` | Fires when user selects files to upload |
| `onValidateUpload` | `(files, existingFiles, destinationFolder) => FileUploadValidationResult \| Promise<FileUploadValidationResult>` | Validates before upload starts |
| `onCreateFolder` | `(file: DialUploadFileItem, folderPath: string, fileId: string) => void \| Promise<void>` | Fires when user confirms a new folder name. `folderPath` is the **full virtual path of the new folder** (e.g. `/All files/reports/Q1`); `file.name` is the marker placeholder (`.dial_folder`). The hook parses the folder name from `folderPath`. |
| `onCreateFolderValidate` | `(name: string, parentFolder: DialFile) => string \| null` | Validates folder name inline |
| `onDownloadFiles` | `(items: DialFile[]) => void` | Fires when user triggers download |
| `toolbarOptions.newActions.uploadFiles` | `NewAction` | Toolbar "Upload files" button |
| `toolbarOptions.newActions.newFolder` | `NewAction` | Toolbar "New folder" button |
| `bulkActionsToolbarOptions.actionLabels[DialFileManagerActions.Download]` | `string` | Download label in bulk toolbar |
| `uploadEnabled` | `boolean` | Must be `true` to show upload-related UI |

`DialUploadFileItem` shape: `{ fileContent: File; name: string }`.

---

## 2. Architecture: Hybrid Approach

| Operation | Strategy | Rationale |
|-----------|----------|-----------|
| Upload single/multiple files | Reuse `POST /api/v1/files` per file, bounded-concurrent frontend orchestration | Existing contract already correct; no new endpoint needed; per-file state required regardless |
| Create folder | New `POST /api/v1/files/folders` wrapping a zero-byte marker upload | SDK lacks a folder primitive; marker strategy must be server-owned; strict existence check via `markerMetadataMatches` |
| Download single file | Existing `GET /api/v1/files/download` via `downloadFileRaw` | Already implemented and tested |
| Download folder or bulk selection | New `POST /api/v1/files/download-archive` streaming ZIP via `archiver` | Browser-side ZIP assembly is memory-prohibitive for large folders |

---

## 3. Upload Architecture

### 3.1 Frontend orchestration

`useDialFileManager.onUploadFiles(files, destinationFolder)`:

1. Receives `DialUploadFileItem[]` and `destinationFolder` (virtual `DialFileManager` path, e.g. `/All files/reports/`).
2. Strips the virtual root prefix and converts `destinationFolder` to an API `path` (e.g. `reports/`) — this conversion happens in the hook, never in a library.
3. Converts `destinationFolder` + each `item.name` into `{ bucket, path: `${folderApiPath}${item.name}` }`.
4. Sets `uploadBatchState` with all files in `FileUploadStatus.Queued`.
5. Processes files in batches of `UPLOAD_CONCURRENCY = 3`.
6. Per file: transitions to `FileUploadStatus.Uploading`, calls `uploadFile(bucket, path, file.fileContent)`, transitions to `FileUploadStatus.Completed` or `FileUploadStatus.Failed`.
7. On partial failure: keeps completed entries; marks failed entries.
8. After all files settle: invalidates the destination folder cache entry; calls `onPathChange(currentPath)` to re-fetch.

### 3.2 Upload conflict strategy

`onValidateUpload(files, existingFiles, destinationFolder)`:
- Checks whether any `files[i].name` already exists in `existingFiles` (compared case-insensitively).
- Returns `FileUploadValidationResult` indicating conflicts.
- The ui-kit then surfaces the conflict to the user before calling `onUploadFiles`.
- The BFF endpoint does **not** use `If-None-Match` or `If-Match` at this stage (DIAL SDK `0.1.0-dev.24` does not expose conditional headers on `uploadFile`). Conflict prevention is pre-validated on the frontend against the cached item list.

### 3.3 Upload cancellation

`useDialFileManager` maintains an `AbortController` per upload batch. The controller is stored in state and exposed as `cancelUpload()`. Each call to `uploadFile` passes the controller's `AbortSignal` via the `filesApi.uploadFile` init override (generator supports `initOverrides?: RequestInit`). On cancellation, in-flight requests abort; files not yet started transition to `FileUploadStatus.Cancelled`.

### 3.4 Upload progress

The generated OpenAPI fetch client does not expose `XMLHttpRequest.upload.onprogress`. When byte-level progress is required, `apps/chat/src/server-api/files.api.ts` routes uploads with an `onProgress` callback through `uploadFileWithProgress()` (`XMLHttpRequest` to `POST /api/v1/files`). Uploads without `onProgress` continue to use the generated client.

Progress reflects bytes sent from the browser to the chat-api BFF (not BFF → DIAL Core). Each `FileUploadEntry` stores optional `percent` (0–100) while uploading.

### 3.5 Upload progress modal

`UploadProgressModal` in `apps/chat/src/components/DialFileManagerModal/UploadProgressModal.tsx` matches the legacy [`FilesUploadingModal`](https://github.com/epam/ai-dial-chat/blob/development/apps/chat/src/components/FileManager/FilesUploadingModal.tsx) layout:

- `DialPopup` with fixed width (`400px`), `dividers={false}`, `closeOnOutsideClick={false}`, `hideClose`.
- Header: title + summary (`{{done}} of {{total}} complete`, where `done` counts files whose status is not `Uploading`).
- Body: file rows with `DialFileName` and an optional progress bar when `percent` is defined (no per-file status text, no numeric `%` label).
- Footer: single **Cancel** button (`buttons.cancel`); aborts in-flight uploads and closes the modal.
- When the batch settles, `useDialFileManager` clears `uploadBatchState` automatically (legacy auto-dismiss).
- QA hooks: `data-qa="uploading-indicator"`, `data-qa="uploading-items-count"`.

---

## 4. Folder Persistence Strategy

### 4.1 Options evaluated

| Strategy | Assessment |
|----------|-----------|
| Dedicated DIAL folder API | SDK `0.1.0-dev.24` exposes no `createFolder` or `mkdir` method. DIAL Core has no dedicated folder metadata endpoint in the confirmed API surface. **Not available.** |
| Zero-byte marker object | Upload an empty file at `{parentPath}{name}/.dial_folder`; the metadata listing returns this path as an item. The folder prefix is then visible. **Selected.** |
| Client-side virtual folders | Folder disappears on refresh. **Rejected** — per brief. |

### 4.2 Marker design

- Marker name: `.dial_folder` — `HIDDEN_FILE` from `@epam/ai-dial-chat-shared`, re-exported as `MARKER_NAME` in `apps/chat-api/src/files/files.constants.ts`.
- Marker is uploaded as a zero-byte `application/octet-stream` file via the SDK `uploadFile` method.
- Marker path: `{parentPath}{folderName}/.dial_folder` (e.g. `reports/2026/.dial_folder`).
- Empty folder listing: when listing `reports/2026/`, the marker may be the only item returned by DIAL Core. The ui-kit "Hidden files" toggle controls whether `.dial_folder` rows are visible in the grid.

### 4.3 Marker visibility rules

`FilesService.listFiles` and `FilesService.expandFolderContents` **do not filter** marker items — they are returned like any other file.

1. Marker items appear in `ListFilesResponseDto.items` with `name === '.dial_folder'`.
2. `DialFileManager` toolbar `showHiddenFilesToggle: true` lets users show/hide marker rows in the grid.
3. Folder rows remain non-selectable for Attach (`isRowSelectable` checks `nodeType === ITEM`).
4. `onCreateFolderValidate` rejects any folder name equal to `.dial_folder`.
5. Archive downloads include marker files as zero-byte ZIP entries (preserves folder structure).

### 4.4 New `POST /api/v1/files/folders` endpoint

**Request:**
```json
{
  "bucket": "user-bucket",
  "parentPath": "reports/",
  "name": "2026"
}
```

**Response (201):**
```json
{
  "name": "2026",
  "path": "files/user-bucket/reports/2026/",
  "parentPath": "reports",
  "bucket": "user-bucket",
  "nodeType": "folder",
  "folderId": "user-bucket:files/user-bucket/reports/2026/"
}
```

**Error codes:** 400 (invalid name/path), 401, 403, 409 (folder name already exists as a sibling), 429, 502, 503.

**Service logic:**
1. Validate `name` (allowlist regex, no `..`, no `/`, not `.dial_folder`, not empty, max 255 chars).
2. Probe `{parentPath}{name}/.dial_folder` via `getFileMetadata`.
   - If `200` **and** `markerMetadataMatches(data, bucket, markerPath)` → throw `409 ConflictException`.
   - If `200` but probe does **not** match the requested marker path (e.g. parent-folder marker returned) → proceed to upload.
   - If `404` → proceed to upload.
3. Upload zero-byte file to `{parentPath}{name}/.dial_folder` via SDK `uploadFile`.
4. Return the constructed `CreateFolderResponseDto` with full DIAL resource paths (`files/{bucket}/...`).

**Rate limit:** `@Throttle({ default: { limit: 10, ttl: 60000 } })` (folder creation is heavier than listing).

---

## 5. Direct File Download Design

Unchanged from `openspec/specs/file-download/spec.md`. The frontend calls `downloadFile(bucket, path)` from `files.api.ts` which uses `filesApi.downloadFileRaw`. The raw `Response` headers supply `Content-Disposition` for the filename; the frontend calls `response.blob()` and creates a transient object URL, triggering the browser save dialog. Object URL is revoked after the anchor click.

---

## 6. Folder and Bulk ZIP Streaming Design

### 6.1 New `POST /api/v1/files/download-archive` endpoint

**Request body (`DownloadArchiveDto`):**
```json
{
  "items": [
    { "bucket": "user-bucket", "path": "reports/", "name": "reports", "nodeType": "folder" },
    { "bucket": "user-bucket", "path": "notes.txt", "name": "notes.txt", "nodeType": "item" }
  ]
}
```

**Response:**
- `200 OK`
- `Content-Type: application/zip`
- `Content-Disposition: attachment; filename="files.zip"` (sanitized)
- `Cache-Control: no-store`
- Streamed binary ZIP body

**Rate limit:** `@Throttle({ default: { limit: 5, ttl: 60000 } })` — archive generation is CPU/network expensive.

**Configurable limits (new `EnvironmentVariables` fields):**

| Variable | Default | Purpose |
|----------|---------|---------|
| `ARCHIVE_MAX_ITEMS` | `100` | Maximum top-level selected items |
| `ARCHIVE_MAX_FILES` | `1000` | Maximum expanded file count across all folders |
| `ARCHIVE_MAX_UNCOMPRESSED_BYTES` | `5368709120` (5 GB) | Maximum total uncompressed size (from metadata) |
| `ARCHIVE_TIMEOUT_MS` | `300000` (5 min) | Overall archive generation timeout |
| `ARCHIVE_DOWNLOAD_CONCURRENCY` | `32` | Concurrent DIAL Core file downloads while preserving ordered ZIP streaming (maximum 32) |

### 6.2 ZIP library

`archiver` npm package — mature, stream-based, supports backpressure. **Not currently in the project** (confirmed via `package.json` inspection). Added as a dependency to `apps/chat-api/package.json`. `@types/archiver` added as a devDependency.

### 6.3 Streaming pipeline

```
Request → validation → recursive expansion (DIAL metadata) → archiver stream → NestJS Response (piped)
```

1. **Validate** `items` array (length, `nodeType`, `bucket` format, `path` format).
2. **Expand** folders recursively: call `getFileMetadata(bucket, path, { recursive: true })` and continue fetching pages via `nextToken` until complete.
3. **Deduplicate** expanded file list by `{bucket}:{path}`. When a folder and one of its descendants are both selected, the descendant is kept once.
4. **Check limits** (`ARCHIVE_MAX_FILES`, `ARCHIVE_MAX_UNCOMPRESSED_BYTES`) against expanded list.
5. **Commit response headers** (stream starts — errors after this point cannot be reported via HTTP status).
6. **Pipe**: for each file in expanded list, download via `client.downloadFile` (raw stream) and append to `archiver`. Abort on client disconnect (`req.on('close')`).

### 6.4 Archive entry path construction

- Top-level items are placed at their `name` in the archive root.
- For folder contents, the relative path below the selected folder root is preserved (e.g. folder `reports/` selected → entry `reports/2026/q1.pdf`).
- ZIP-slip prevention:
  - Reject/sanitize any entry path containing `..`.
  - Reject absolute paths (starting with `/` or drive letter).
  - Reject backslash traversal.
  - Assert every final path is prefixed with the expected archive root.
- Duplicate top-level names (two folders named `reports` selected): append `_1`, `_2` suffix rather than silently replacing.

### 6.5 Marker files in archive

When a folder contains `.dial_folder` marker files, they are included in the ZIP as zero-byte entries at their relative paths (e.g. `reports/2026/.dial_folder`). No special empty-directory synthesis is required.

### 6.6 Error behavior for archive

| Scenario | Behavior |
|----------|---------|
| Missing item (404 from DIAL) | Fail the request before committing headers; return `404` |
| Forbidden item (403 from DIAL) | Fail before headers; return `403` |
| Empty folder | Include empty directory entry in ZIP |
| Expansion fails entirely | Fail before headers; return appropriate 4xx/5xx |
| DIAL timeout during streaming (after headers sent) | Log error; destroy the response stream; client receives partial/corrupt ZIP |
| Client disconnect | `req.on('close')`: abort all pending SDK downloads; destroy archiver pipeline |
| Archive stream failure | Log error; destroy response |
| `ARCHIVE_MAX_FILES` exceeded | Return `413` before headers |
| `ARCHIVE_MAX_UNCOMPRESSED_BYTES` exceeded | Return `413` before headers |

### 6.7 Archive download: generated client gap

The generated method emits `Blob | void` for binary responses. `files.api.ts` wraps `filesApi.downloadArchiveRaw(...)` (raw method) to get the native `Response`, then calls `response.blob()` to create a transient object URL. This mirrors the existing `downloadFile` wrapper pattern (`files.api.ts:27`).

---

## 7. Recursive Listing and Pagination

`FilesService.expandFolderContents(bucket, path, at, options)`:
- Calls `client.getFileMetadata(bucket, path, { recursive: true })`.
- If `nextToken` is present, continues with `token: nextToken` until exhausted.
- Includes all file items (including `.dial_folder` markers); skips folder nodes only.
- Normalizes all paths (trailing `/` for sub-folders, no leading `/`).
- Returns flat `Array<{ bucket, path, name, size }>` for archive assembly.

---

## 8. `useDialFileManager` State and API Changes

```ts
export interface UseDialFileManagerResult {
  // Existing (unchanged)
  items: DialFile[];
  isLoading: boolean;
  error: string | null;
  path: string;
  onPathChange: (nextPath?: string) => void;
  retry: () => void;

  // New: upload
  onUploadFiles: (files: DialUploadFileItem[], destinationFolder: string) => void;
  onValidateUpload: (
    files: DialUploadFileItem[],
    existingFiles: DialFile[],
    destinationFolder: string,
  ) => Promise<FileUploadValidationResult>;
  uploadBatchState: FileUploadBatchState | null;
  cancelUpload: () => void;

  // New: folder creation
  onCreateFolder: (
    file: DialUploadFileItem,
    folderPath: string,
    fileId: string,
  ) => Promise<void>;
  onCreateFolderValidate: (name: string, parentFolder: DialFile) => string | null;
  isCreatingFolder: boolean;

  // New: download
  onDownloadFiles: (items: DialFile[]) => void;
  isDownloading: boolean;
}

export interface FileUploadBatchState {
  files: FileUploadEntry[];
  isOpen: boolean;
}

export interface FileUploadEntry {
  id: string;
  name: string;
  status: FileUploadStatus;
}

enum FileUploadStatus {
  Queued = 'queued',
  Uploading = 'uploading',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}
```

**Cache update after folder creation:** `mergeCreatedFolderIntoCache` optimistically adds the new folder to the parent cache entry, then `setRetryCounter(c => c + 1)` re-fetches the current listing. `mergeListingItems` unions existing cached items with incoming DIAL results so optimistically created folders are not lost when Core lags.

---

## 9. `DialFileManagerModal` Changes

```tsx
// New props added to Props interface
interface Props {
  // ... existing props unchanged ...

  // Upload labels
  uploadFilesLabel: string;
  newFolderLabel: string;
  downloadLabel: string;
  uploadProgressTitle: string;
  cancelLabel: string;
  folderConflictMessage: string;
}
```

`DialFileManager` gains:
```tsx
uploadEnabled={true}
gridOptions={{
  ...existing,
  actionLabels: {
    [DialFileManagerActions.Download]: downloadLabel,   // row context-menu action
  },
}}
treeOptions={{
  actionLabels: {
    [DialFileManagerActions.Download]: downloadLabel,   // file-tree context-menu action
  },
}}
toolbarOptions={{
  ...existing,
  isNewButtonDisabled: false,   // must be explicit; omitting leaves the button disabled in some ui-kit versions
  newActions: {
    uploadFiles: { label: uploadFilesLabel },
    newFolder: { label: newFolderLabel },
  },
}}
bulkActionsToolbarOptions={{
  getSelectionLabel,
  actionLabels: {
    [DialFileManagerActions.Download]: downloadLabel,   // bulk-selection toolbar action
  },
}}
onUploadFiles={onUploadFiles}
onValidateUpload={onValidateUpload}
onCreateFolder={onCreateFolder}
onCreateFolderValidate={onCreateFolderValidate}
onDownloadFiles={onDownloadFiles}
```

> **Note:** `DialFileManagerActions.Download` must appear in all three `actionLabels` surfaces — `gridOptions`, `treeOptions`, and `bulkActionsToolbarOptions` — so the Download action is accessible from the row context menu, the file tree context menu, and the bulk-selection toolbar respectively. Providing it in only one surface is insufficient.

`UploadProgressModal` is rendered outside `DialFileManager` as a sibling `DialPopup`.

---

## 10. Generated Client Impact

Two new methods after regeneration:

| operationId | Method | Type | Notes |
|-------------|--------|------|-------|
| `createFolder` | `filesApi.createFolder(body)` | JSON | Returns `CreateFolderResponseDto` |
| `downloadArchive` | `filesApi.downloadArchiveRaw(body)` | Binary (Raw) | Generator gap: `Blob \| void` → use Raw |

Run after backend changes:
```sh
npm run openapi
npm run openapi:check
npm exec nx build chat-api-client -- --skip-nx-cache
npm exec nx lint chat-api-client
```

---

## 11. Security

- All new endpoints require the existing session guard (authenticated BFF session cookie).
- Session `at` token is forwarded to DIAL Core in `Authorization: Bearer` header; never echoed to the browser.
- `DownloadArchiveRequestDto.items[].bucket` and `items[].path` validated with same allowlist regexes as `FileParamsDto`.
- `DownloadArchiveRequestDto.items[].nodeType` validated as `enum('item', 'folder')`.
- `CreateFolderDto.name` validated with `@Matches(/^[^\\/\0.][^\\/\0]{0,254}$/)` plus custom `.dial_folder` rejection.
- ZIP entry paths are sanitized server-side; `archiver` entries never start with `/` or contain `..`.
- `Content-Disposition` filename is sanitized (non-ASCII stripped, quotes escaped).
- DIAL Core errors are mapped through `handleDialError`; no upstream body or stack is forwarded to the browser.

---

## 12. Rate Limiting Summary

| Endpoint | Limit | Rationale |
|----------|-------|-----------|
| `POST /api/v1/files` (upload) | `20 req/min` | Existing |
| `GET /api/v1/files/list` | `60 req/min` | Existing |
| `GET /api/v1/files/download` | `60 req/min` | Existing |
| `POST /api/v1/files/folders` | `10 req/min` | Folder creation is a write that proxies to DIAL Core |
| `POST /api/v1/files/download-archive` | `5 req/min` | Expensive: recursive listing + multi-file download + ZIP streaming |

---

## 13. Observability

- All new service methods use `Logger` (`logger.debug` for happy paths, `logger.warn` for DIAL errors, `logger.error` for 5xx/unexpected).
- The existing `MetricsInterceptor` tracks request duration and error rate for all new controller handlers automatically.
- No new custom analytics events scoped to this change.

---

## 14. Accessibility, RTL, Responsive, i18n

### Accessibility
- `UploadProgressModal`: progress bars use `role="progressbar"`; Cancel button has a visible text label.
- All icon buttons in new toolbar actions have `aria-label` via i18n `t()`.
- `DialFileManager` provides built-in keyboard navigation for tree, grid, and context menus.

### RTL
- All directional Tailwind classes in new components use logical properties (`ms-*`, `ps-*`, `start-*`).
- Directional icons (chevrons, navigation arrows) use `rtl:scale-x-[-1]`.
- `UploadProgressModal` uses `text-start`, `me-*`, `ps-*` throughout.
- No physical `left-*` / `right-*` introduced.

### Responsive
- `UploadProgressModal` renders full-width on mobile (`DialPopup` with `size={PopupSize.Md}`).
- Only named project breakpoints (`mobile`, `desktop`) used in custom overrides.
- No `sm:` / `md:` / `lg:` / `xl:` Tailwind prefixes introduced.

### i18n
- All new user-visible strings go through `useTranslation` in `DialFileManagerModal`; string keys passed as props to `UploadProgressModal` (lib boundary pattern).
- i18n keys listed in `proposal.md §i18n Impact`.

---

## 15. Risks and Rollback

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| DIAL SDK `uploadFile` does not accept `AbortSignal` in init override | Low — SDK uses `openapi-fetch` which passes `init` to native `fetch` | Verified via SDK source inspection; abort is standard `RequestInit` |
| `archiver` streaming not compatible with NestJS Response pipe | Low — `archiver` is a Node.js `Readable`; NestJS `pipeline` accepts it | Follow same `Readable.fromWeb` / `pipeline` pattern as `downloadFile` handler |
| Marker `.dial_folder` visible in grid when "Hidden files" is on | Expected | ui-kit toggle; marker rows are non-attachable |
| Large folder archive times out at `ARCHIVE_TIMEOUT_MS` default | Possible for deep trees | Default 5 min; configurable; client receives incomplete ZIP and error is logged |
| Concurrent folder creation races produce duplicate sibling names | Very low — DIAL Core `uploadFile` is idempotent for same path | Strict `markerMetadataMatches` probe → `409`; if two concurrent creates slip through, both upload the same marker path — folder exists once |

**Rollback:** See `proposal.md §Rollback Plan`. No database migration required.
