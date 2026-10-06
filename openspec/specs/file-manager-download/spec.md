# Spec: File Manager Download

## Purpose

Single-file download and the archive endpoint behind folder and bulk download, including recursive expansion and ZIP-slip prevention.

## State ownership

Download state is owned by `useDialFileMutations` (`libs/chat-hooks/src/files/useDialFileMutations/useDialFileMutations.ts`, `@epam/ai-dial-chat-hooks`), which `useDialFileManager` (`libs/chat-hooks/src/files/useDialFileManager/useDialFileManager.ts`) composes and re-exports.

State field:
```ts
const [isDownloading, setIsDownloading] = useState(false);
```

Exposed in `UseDialFileManagerResult`:
- `onDownloadFiles(dialFiles: DialFile[])` — dispatched by `DialFileManager` when user clicks Download
- `isDownloading` — also folded into the hook's `isAnyOperationInProgress` so conflicting actions are disabled while a download is preparing

The hook never touches browser download APIs directly. The host injects `downloadDestination: DownloadDestinationHandlers` (`libs/chat-hooks/src/files/download-destination.ts`) with `resolveDestination(filename, mimeType)` and `triggerDownload(response, fallbackName, destination)`; `apps/chat` wires them in `useDialFileManagerHostOptions` to `prepareDownloadDestination` (`libs/chat-hooks/src/files/prepare-download-destination.ts`) and `triggerBrowserDownload` (`apps/chat/src/utils/file-download.ts`). The HTTP calls go through the injected `filesApi: DialFilesApi` (`downloadFile`, `downloadArchive`), built by `createFilesApiClient` (`libs/chat-hooks/src/files/create-files-api.ts`).

---

## Single-file download

### Endpoint (reused): `GET /api/v1/files/download`

See `openspec/specs/file-download/spec.md` for full contract. No changes to the BFF.

**Frontend flow for a single `nodeType === 'item'` selection:**

1. `onDownloadFiles([file])` is called; `setIsDownloading(true)`.
2. `downloadDestination.resolveDestination(file.name, file.contentType ?? 'application/octet-stream')` picks the destination: the browser's native "Save As" picker (`window.showSaveFilePicker`) when available → `DownloadDestinationType.Stream`, otherwise `DownloadDestinationType.Blob`; a dismissed picker → `DownloadDestinationType.Cancelled`, which ends the flow with no request and no notification.
3. Call `filesApi.downloadFile(file.bucket, resolveDialFileApiPath(file, file.bucket, rootLabel))`; a file without `bucket` or a non-`ok` response is treated as a failure.
   - The app's `createFilesApiClient` implementation calls `filesApi.downloadFileRaw({ bucket, path })` (generator gap — binary response) and returns `raw.raw`.
4. `downloadDestination.triggerDownload(response, file.name, destination)` writes the bytes and returns the saved name:
   - `Stream`: pipes `response.body` into the picker's writable and returns `file.name`.
   - `Blob`: buffers `response.blob()`, uses the `Content-Disposition` filename when present (path separators stripped) or falls back to `file.name`, and calls `triggerBlobDownload` (`@epam/ai-dial-chat-shared`), which clicks a transient `<a download>` and revokes the object URL.
5. Report success through `onOperationSuccess` (see "A completed download confirms itself").
6. On error: `onNotification({ variant: NotificationVariant.Error, reason: FileManagerNotificationReason.DownloadFileFailed })`, which the app maps to `dialFileManager.downloadFileError`.
7. `setIsDownloading(false)` in `finally`.

**Generated client gap note**: `filesApi.downloadFileRaw` is used (not `filesApi.downloadFile`) because the generator emits `Blob | void` for binary responses, losing the `Response` object needed to read `Content-Disposition`.

---

## Folder and bulk archive download

### New: `POST /api/v1/files/download-archive`

- **Controller**: `FilesController`
- **Handler name**: `downloadArchive` → operationId `downloadArchive`
- **Authentication**: session guard (existing)
- **Request content-type**: `application/json`
- **Response content-type**: `application/zip` (streamed, `@ApiProduces('application/zip')`)

**Request DTO** (`apps/chat-api/src/files/dto/download-archive.dto.ts`):

```ts
class ArchiveItemDto {
  @IsString()
  @IsNotEmpty()
  @Matches(BUCKET_NAME_PATTERN, { message: BUCKET_NAME_VALIDATION_MESSAGE }) // /^[\w.-]+$/
  @MaxLength(256)
  @ApiProperty({ description: 'DIAL Core bucket name', example: 'my-bucket' })
  bucket!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  @IsValidFilePath()
  @ApiProperty({ description: 'File or folder path within the bucket', example: 'reports/' })
  path!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @ApiProperty({ description: 'Display name for archive entry', example: 'reports' })
  name!: string;

  @IsEnum(ArchiveItemNodeType) // = DialFileNodeType { Item = 'item', Folder = 'folder' }
  @ApiProperty({ enum: ArchiveItemNodeType })
  nodeType!: ArchiveItemNodeType;
}

class DownloadArchiveDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ArchiveItemDto)
  @ApiProperty({ type: [ArchiveItemDto] })
  items!: ArchiveItemDto[];
}
```

**Example request:**
```json
{
  "items": [
    {
      "bucket": "user-bucket",
      "path": "reports/",
      "name": "reports",
      "nodeType": "folder"
    },
    {
      "bucket": "user-bucket",
      "path": "notes.txt",
      "name": "notes.txt",
      "nodeType": "item"
    }
  ]
}
```

**Success response (200):**
- `Content-Type: application/zip`
- `Content-Disposition: attachment; filename="files.zip"` (exactly one requested item: `<name>.zip`; multiple: `files.zip`)
- `Cache-Control: no-store`
- `X-Accel-Buffering: no`
- Streamed binary ZIP body

**Error codes (before headers are committed):**

| Code | Condition |
|------|-----------|
| `400` | Invalid `items` array, invalid `bucket`/`path`/`nodeType` format |
| `401` | Unauthenticated |
| `403` | User lacks permission to list a requested folder |
| `404` | A requested folder not found in DIAL Core (folder listing) |
| `413` | `ARCHIVE_MAX_ITEMS`, `ARCHIVE_MAX_FILES`, or `ARCHIVE_MAX_UNCOMPRESSED_BYTES` exceeded |
| `429` | DIAL Core rate limit exceeded |
| `500` | Unexpected archive stream failure before headers sent |
| `502` | DIAL Core returned an error |
| `503` | DIAL Core unreachable or timed out |

Errors **after** headers are committed (stream already started): logged; response stream destroyed; client receives incomplete/corrupt ZIP. A single file that fails to download from DIAL Core (any status, network error, or missing body) is logged as a warning and skipped; the archive is still finalized with the remaining entries, and when no entry could be appended an error is logged and an empty ZIP is sent.

**Generated client impact:**
- `operationId`: `downloadArchive`
- Generated method: `filesApi.downloadArchiveRaw({ downloadArchiveDto: { items } })` → `Promise<ApiResponse<Blob>>` (Raw used — generator gap for binary response)
- `filesApi.downloadArchive(body)` also generated but emits `Blob | void` — not used by frontend
- Frontend callers use `downloadArchiveRaw` to access the native `Response`, which the injected `downloadDestination.triggerDownload` then streams or buffers

**Frontend wrapper**: `createFilesApiClient` (`libs/chat-hooks/src/files/create-files-api.ts`) implements it, and `apps/chat/src/server-api/files.api.ts` re-exports `filesApiClient.downloadArchive`:
```ts
downloadArchive: async (items) => {
  const raw = await filesApi.downloadArchiveRaw({
    downloadArchiveDto: { items },
  });
  return raw.raw;
},
```

---

## Archive generation logic

**ZIP library:** `archiver` npm package. Added to `apps/chat-api/package.json` dependencies. `@types/archiver` added to devDependencies.

**State ownership**: archive generation is owned by `FilesArchiveDownloadService` (`apps/chat-api/src/files/archive/files-archive-download.service.ts`), which injects `FilesListingService` for folder expansion instead of implementing its own traversal. Unlike the original monolithic `FilesService.downloadArchive(items, at, res)`, the service method does **not** accept an Express `Response`; it returns a stream and header metadata (the same `{ stream, headers }`-shaped contract already used by `FilesDownloadService.downloadFile`). `FilesController` is the only place that constructs the Express `Response` for this route — it calls the `FilesService` facade, receives an `ArchiveDownloadResult` (`{ stream, headers, abortOnDisconnect }`), sets response headers, calls `res.flushHeaders()`, and pipes the stream with `pipeline(stream, res)`, destroying the response on a stream error.

1. **Pre-validate** `items` array (checked by DTO); the service additionally rejects `items.length > ARCHIVE_MAX_ITEMS` (default 100) with `413`.
2. **Handle duplicate top-level names**: the archive root of each item is its `name`; when two selected items share a `name`, later ones are suffixed `_1`, `_2`, etc.
3. **Expand folders**:
   - For each `nodeType === 'folder'` item (path normalised to end in `/`), call `FilesListingService.expandFolderContents(bucket, folderPath, archiveRoot, at)`, which paginates via `nextToken` until exhausted.
   - Include all file items (including `.dial_folder` markers); skip folder nodes only.
4. **Expand files**: add `nodeType === 'item'` items directly (path made relative with `toRelativePath`, `archivePath` = the item's archive root, `size` = 0).
5. **Deduplicate** by `{bucket}:{path}`: when a folder and one of its children are both selected, keep one entry.
6. **Validate limits**:
   - `expanded.length > ARCHIVE_MAX_FILES` (default 1000) → throw `413 PayloadTooLargeException` (before headers).
   - Sum of listed `contentLength` values > `ARCHIVE_MAX_UNCOMPRESSED_BYTES` (default 5,368,709,120) → throw `413`. Directly selected files count as 0 bytes.
7. **Build the archive**: create `archiver('zip', { store: true })` (no compression), compute the headers (`Content-Type`, `Content-Disposition`, `Cache-Control`, `X-Accel-Buffering`), start populating the archive asynchronously, and return `{ stream, headers, abortOnDisconnect }` — `FilesController` performs the actual `res.setHeader`/pipe/abort-on-disconnect wiring.
8. For each file in the expanded list:
    - Call `client.downloadFile(bucket, encodeDialFilePath(path), { parseAs: 'stream', signal })`, where `signal` combines the archive's `AbortController` with `AbortSignal.timeout(ARCHIVE_TIMEOUT_MS)`. With more than one file, files after the first are prefetched into a temp directory with at most `ARCHIVE_DOWNLOAD_CONCURRENCY` (default 32) downloads in flight, and appended in order.
    - Append to archiver: `archive.append(nodeStream, { name: file.archivePath })`.
9. Call `archive.finalize()`; the temp directory is removed afterwards.
10. Handle `archiver` errors → `logger.error`; the controller destroys the response. A whole-archive timeout (`ARCHIVE_TIMEOUT_MS`, default 300,000) aborts all downloads and the archive.

(No special empty-directory entries — folders with only a `.dial_folder` marker produce a zero-byte marker file in the ZIP.)

---

## Recursive folder expansion and pagination

`FilesListingService.expandFolderContents(bucket, folderPath, archiveRoot, at)` (relocated from the original monolithic `FilesService`, and reused by `FilesBatchOperationsService` for delete/rename/copy/move as well as by `FilesArchiveDownloadService`):

1. Calls `client.getFileMetadata(bucket, encodeDialFilePath(relFolderPath), { params: { query: { recursive: true, limit: 1000, token } } })`.
2. While the response carries `nextToken`, fetches the next page with `token = nextToken`.
3. Includes all file items (including `.dial_folder` markers); skips folder nodes only. A listing error is mapped through `handleDialSdkError` (e.g. `403`, `404`) before headers are committed.
4. Returns a flat `ExpandedFile[]` (`{ bucket, path, name, size, archivePath }`), with `archivePath` built by `buildArchivePath(archiveRoot, relative)`.

---

## ZIP-slip prevention

Applied in `FilesListingService.buildArchivePath(root, relative)` (relocated from the original monolithic `FilesService`) to every folder child's relative path:

- Reject an empty relative path.
- Reject any relative path containing `..`.
- Reject absolute paths (starting with `/`).
- Reject backslash-containing paths.
- On rejection it returns `null`; `expandFolderContents` logs a warning (`reason=invalid-archive-path`) and skips the entry. Otherwise it returns `${root}/${relative}`.

The archive root itself comes from the request's `ArchiveItemDto.name`, which is also the entry name of a directly selected file. `name` SHALL be a single path segment: `@Matches(ARCHIVE_ENTRY_NAME_PATTERN)` rejects `/`, a backslash, control characters, `.` and `..` with `400` before any archive entry is written.

---

## Archive filename determination

| Selection | Archive filename |
|-----------|----------------|
| One folder | `<folder-name>.zip` |
| One file | — (not archive; uses direct download) |
| Multiple items (any mix) | `files.zip` |

Filename sanitized server-side: every character outside `[\w.-]` is replaced with `_` (`archiveName.replace(/[^\w.-]/g, '_')`). The frontend suggests `<folder-name>.zip` / `files.zip` to the destination picker independently.

---

## Frontend download trigger

`onDownloadFiles(dialFiles: DialFile[])` in `useDialFileMutations` (simplified):

```ts
const onDownloadFiles = useCallback((dialFiles: DialFile[]) => {
  const run = async () => {
    setIsDownloading(true);
    try {
      const destination = await downloadDestination.resolveDestination(filename, mimeType);
      if (destination.type === DownloadDestinationType.Cancelled) return;
      if (dialFiles.length === 1 && dialFiles[0].nodeType === DialFileNodeType.ITEM) {
        // Single file: direct download
        const response = await filesApi.downloadFile(file.bucket, filePath);
        if (!response.ok) throw new Error(`Download failed with status ${response.status}`);
        const savedName = await downloadDestination.triggerDownload(response, file.name, destination);
        onOperationSuccess?.({ kind: FileOperationKind.FileDownloaded, name: savedName, count: 1 });
      } else {
        // Folder or bulk: archive download
        const response = await filesApi.downloadArchive(archiveItems);
        if (!response.ok) throw new Error(`Download failed with status ${response.status}`);
        const savedName = await downloadDestination.triggerDownload(response, filename, destination);
        if (dialFiles.length === 1) {
          onOperationSuccess?.({ kind: FileOperationKind.FileDownloaded, name: savedName });
        } else {
          onOperationSuccess?.({ kind: FileOperationKind.FilesDownloaded, count: dialFiles.length });
        }
      }
    } catch {
      onNotification?.({
        variant: NotificationVariant.Error,
        reason: dialFiles.length === 1
          ? FileManagerNotificationReason.DownloadFileFailed
          : FileManagerNotificationReason.DownloadFilesFailed,
      });
    } finally {
      setIsDownloading(false);
    }
  };
  void run();
}, [bucket, rootLabel, onOperationSuccess, onNotification, filesApi, downloadDestination]);
```

Each archive item is built as `{ bucket: f.bucket ?? bucket, path: resolveDialFileApiPath(f, …), name: f.name, nodeType: ArchiveItemDtoNodeTypeEnum.Folder | Item }`. The lib performs no translation: `apps/chat` maps `FileManagerNotificationReason` and `FileOperationKind` to toasts in `apps/chat/src/components/DialFileManagerShell/file-manager-notification-adapter.ts`.

---

## i18n keys

| Key | English |
|-----|---------|
| `buttons.download` (`ButtonsI18nKeys.Download`, the `DialFileManagerActions.Download` label) | `"Download"` |
| `dialFileManager.downloadFileError` (`DialFileManagerI18nKeys.DownloadFileError`) | `"Failed to download file. Please try again later."` |
| `dialFileManager.downloadFilesError` (`DialFileManagerI18nKeys.DownloadFilesError`) | `"Failed to download files. Please try again later."` |

---

## RTL / direction impact

- No directional icons introduced specifically for download.
- Download toolbar button uses standard `DialFileManagerActions.Download` label — rendered by the ui-kit.
- Bulk-actions toolbar uses logical layout (provided by ui-kit internally).

---

## Accessibility

- `isDownloading` contributes to `isAnyOperationInProgress`, which disables conflicting file-manager actions while a download is in progress.
- Error feedback: toast with `role="alert"`.
- No new modal — download is a fire-and-forget browser download.

---

## Memoisation

- `onDownloadFiles` wrapped in `useCallback` in `useDialFileMutations`.

---

## Feature flag

Not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`.

---

## Scenarios

### Scenario: Download one file directly

- **GIVEN** the user selects a single file `report.pdf`
- **WHEN** the user clicks "Download" (row action or bulk toolbar)
- **THEN** `onDownloadFiles([{ nodeType: 'item', bucket: 'user-bucket', id: 'folder/report.pdf', name: 'report.pdf' }])` is called
- **AND** `filesApi.downloadFile('user-bucket', 'folder/report.pdf')` is called, which uses the generated `downloadFileRaw`
- **AND** `GET /api/v1/files/download?bucket=user-bucket&path=folder%2Freport.pdf` is sent
- **AND** the browser saves `report.pdf` (with a blob destination, using the filename from `Content-Disposition`)
- **AND** no archive endpoint is called

---

### Scenario: Download one folder as ZIP

- **GIVEN** the user selects a folder named `reports`
- **WHEN** the user clicks "Download"
- **THEN** `onDownloadFiles([{ nodeType: 'folder', ... }])` is called
- **AND** `filesApi.downloadArchive([{ bucket, path: 'reports/', name: 'reports', nodeType: 'folder' }])` is called
- **AND** `POST /api/v1/files/download-archive` is sent with the single folder item
- **AND** the BFF expands `reports/` recursively, streams a ZIP
- **AND** the browser saves `reports.zip`

---

### Scenario: Bulk download mixed files and folders

- **GIVEN** the user selects `reports/` (folder) and `notes.txt` (file)
- **WHEN** the user clicks "Download" in the bulk toolbar
- **THEN** `POST /api/v1/files/download-archive` is sent with 2 items
- **AND** the BFF expands the folder, combines with the single file, streams `files.zip`
- **AND** the browser saves `files.zip`

---

### Scenario: Archive download route pipes a returned stream, not a passed-in Response

- **WHEN** `POST /api/v1/files/download-archive` is handled
- **THEN** `FilesController` calls the `FilesService` facade, receives `{ stream, headers, abortOnDisconnect }` from `FilesArchiveDownloadService`, and performs `res.setHeader`/piping itself
- **AND** no `FilesArchiveDownloadService` method receives `@Res()` as a parameter

---

### Scenario: Overlapping folder/file selection deduplication

- **GIVEN** the user selects `reports/` (folder) AND `reports/2026/q1.pdf` (a child of that folder)
- **WHEN** `POST /api/v1/files/download-archive` is processed
- **THEN** the expanded flat list contains `reports/2026/q1.pdf` exactly once
- **AND** the ZIP contains the file at `reports/2026/q1.pdf` without duplication

---

### Scenario: Nested archive path preservation

- **GIVEN** the user downloads folder `reports/` which contains `2026/q1.pdf` and `2025/q4.pdf`
- **WHEN** the ZIP is downloaded
- **THEN** it contains entries: `reports/2026/q1.pdf` and `reports/2025/q4.pdf` (relative paths preserved)

---

### Scenario: Folder with only a marker in ZIP

- **GIVEN** the user selects a folder `archive/` that contains only the `.dial_folder` marker
- **WHEN** the ZIP is downloaded
- **THEN** the ZIP contains a zero-byte entry at `archive/.dial_folder`
- **AND** the ZIP is not empty

---

### Scenario: Paginated recursive listing

- **GIVEN** folder `large-folder/` contains 1500 files (exceeds default single-page limit)
- **WHEN** the archive endpoint expands `large-folder/`
- **THEN** `getFileMetadata` is called with `recursive: true`; the response includes a `nextToken`
- **AND** `getFileMetadata` is called again with `token = nextToken` until `nextToken` is absent
- **AND** all 1500 files are included in the expansion (subject to `ARCHIVE_MAX_FILES` limit)

---

### Scenario: Archive max files limit exceeded

- **GIVEN** `ARCHIVE_MAX_FILES = 1000` and the selection expands to 1500 files
- **WHEN** `POST /api/v1/files/download-archive` processes the expansion
- **THEN** the BFF returns `413 Payload Too Large` before committing response headers
- **AND** no partial ZIP is streamed
- **AND** the frontend shows `dialFileManager.downloadFilesError`

---

### Scenario: Forbidden or missing item

- **GIVEN** listing a selected folder returns `403 Forbidden` from DIAL Core during expansion
- **WHEN** the BFF expands it
- **THEN** the BFF returns `403 Forbidden` before committing response headers
- **AND** the frontend shows the download error

- **GIVEN** listing a selected folder returns `404 Not Found` from DIAL Core
- **THEN** the BFF returns `404 Not Found` before committing headers

- **GIVEN** a single file in the expanded list fails to download (e.g. `403` or `404`) after headers are committed
- **THEN** the failure is logged as a warning, the entry is skipped, and the remaining files are still archived

---

### Scenario: Client disconnect during streaming

- **GIVEN** the archive stream returned by `FilesArchiveDownloadService` has started (headers committed by `FilesController`) and the client disconnects mid-download
- **WHEN** `res.on('close')` fires in `FilesController` before the response has ended
- **THEN** the controller calls `abortOnDisconnect()`, which clears the archive timeout, aborts the archive's `AbortController`, and calls `archive.abort()`
- **AND** all pending SDK `downloadFile` calls are aborted via `AbortController`
- **AND** no error is thrown to the client (connection already closed)

---

### Scenario: Existing Attach behavior unchanged

- **GIVEN** the user downloads a file from the file manager
- **WHEN** the download completes
- **THEN** the selected paths set is unchanged; the "Attach" button remains in its prior state
- **AND** no attachment is added to the message input

---

### Scenario: Download is available on every tab

- **GIVEN** the file manager is open on any tab
- **THEN** the Download action is labelled (`DialFileManagerActions.Download`)
- **AND** delete, rename, copy, move, duplicate, remove-access, unshare, and info actions are labelled only when the active tab, `uploadEnabled`, and the resolved action profile allow them (see `file-manager-shell`)

## Requirements
### Requirement: A completed download confirms itself

The frontend download flow SHALL raise a success notification once the blob has been handed to the browser — i.e. after the transient object URL has been clicked and revoked — through `useOperationNotification` (see `entity-operation-notifications`). The lib emits an `onOperationSuccess` event (`FileOperationKind.FileDownloaded` / `FilesDownloaded`), and `handleFileOperationSuccess` in `apps/chat/src/components/DialFileManagerShell/file-manager-notification-adapter.ts` maps it to the entity/operation pairs below.

This extends the final steps of the single-item flow and the archive flow, which today notify only on failure: `setIsDownloading(false)` on the happy path leaves the user with no confirmation, indistinguishable from a click that did nothing when the browser saves silently to a default folder.

- Single file → `NotifiableEntity.File` + `EntityOperation.Downloaded` with `count: 1`, `name` = the filename actually used for the saved file (the `Content-Disposition` name when present, otherwise `file.name`), so the notification names what is on disk rather than what was requested.
- A single folder → `NotifiableEntity.Folder` + `EntityOperation.Downloaded`, `name` = the archive filename.
- A multi-item selection → `NotifiableEntity.File` + `EntityOperation.Downloaded` with `count` = the number of selected items, resolving the plural body (`{{count}} files are saved on your device.`). The archive file itself is not named: the user picked items, not an archive.
- The error branch is unchanged: `FileManagerNotificationReason.DownloadFileFailed` / `DownloadFilesFailed` through `onNotification` (shown as `dialFileManager.downloadFileError` / `downloadFilesError`), with `setIsDownloading(false)`.
- A dismissed "Save As" picker (`DownloadDestinationType.Cancelled`) raises neither notification.

#### Scenario: Single file download confirms with the saved filename

- **WHEN** a user downloads one file and the response carries `Content-Disposition: attachment; filename="report final.pdf"`
- **THEN** after the object URL is revoked a success notification titled `"File downloaded successfully"` is shown, naming `report final.pdf`

#### Scenario: Folder download confirms with the archive name

- **WHEN** a user downloads a single folder
- **THEN** exactly one success notification titled `"Folder downloaded successfully"` is shown, naming the archive file

#### Scenario: Multi-item download confirms with the item count

- **WHEN** a user downloads a selection of three items as an archive
- **THEN** exactly one success notification titled `"Files downloaded successfully"` is shown, with the body `3 files are saved on your device.`

#### Scenario: Failed download raises no success notification

- **WHEN** the download request rejects
- **THEN** only the existing error toast is shown and `isDownloading` returns to `false`
