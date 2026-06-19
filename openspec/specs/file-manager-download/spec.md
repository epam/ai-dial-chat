# Spec: File Manager Download

## State ownership

`useDialFileManager` (`apps/chat/src/hooks/files/useDialFileManager.ts`) owns download state.

New state field:
```ts
const [isDownloading, setIsDownloading] = useState(false);
```

Exposed in `UseDialFileManagerResult`:
- `onDownloadFiles(items: DialFile[])` — dispatched by `DialFileManager` when user clicks Download
- `isDownloading` — disables conflicting actions while download is preparing

---

## Single-file download

### Endpoint (reused): `GET /api/v1/files/download`

See `openspec/specs/file-download/spec.md` for full contract. No changes to the BFF.

**Frontend flow for a single `nodeType === 'item'` selection:**

1. `onDownloadFiles([file])` is called.
2. `setIsDownloading(true)`.
3. Call `downloadFile(file.bucket, file.id)` from `apps/chat/src/server-api/files.api.ts`.
   - This calls `filesApi.downloadFileRaw({ bucket, path })` (generator gap — binary response).
4. `response.blob()` to buffer the file in memory.
5. Create a transient `URL.createObjectURL(blob)` and trigger an `<a>` click with `download` attribute.
6. Use filename from `Content-Disposition` header when present; fall back to `file.name`.
7. Sanitize filename: strip path separators and control characters.
8. Revoke the object URL after click.
9. `setIsDownloading(false)`.
10. On error: show error toast (i18n key `dialFileManager.downloadError`); `setIsDownloading(false)`.

**Generated client gap note**: `filesApi.downloadFileRaw` is used (not `filesApi.downloadFile`) because the generator emits `Blob | void` for binary responses, losing the `Response` object needed to read `Content-Disposition`.

---

## Folder and bulk archive download

### New: `POST /api/v1/files/download-archive`

- **Controller**: `FilesController`
- **Handler name**: `downloadArchive` → operationId `downloadArchive`
- **Rate limit**: `@Throttle({ default: { limit: 5, ttl: 60000 } })`
- **Authentication**: session guard (existing)
- **Request content-type**: `application/json`
- **Response content-type**: `application/zip` (streamed)

**Request DTO** (`apps/chat-api/src/files/dto/download-archive.dto.ts`):

```ts
class ArchiveItemDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[\w.-]+$/)
  @MaxLength(256)
  @ApiProperty({ example: 'user-bucket' })
  bucket!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  @IsValidFilePath()
  @ApiProperty({ example: 'reports/' })
  path!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @ApiProperty({ example: 'reports' })
  name!: string;

  @IsEnum(['item', 'folder'])
  @ApiProperty({ enum: ['item', 'folder'], example: 'folder' })
  nodeType!: 'item' | 'folder';
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
- `Content-Disposition: attachment; filename="files.zip"` (one folder: `<folder-name>.zip`; mixed/multiple: `files.zip`)
- `Cache-Control: no-store`
- Streamed binary ZIP body

**Error codes (before headers are committed):**

| Code | Condition |
|------|-----------|
| `400` | Invalid `items` array, invalid `bucket`/`path`/`nodeType` format |
| `401` | Unauthenticated |
| `403` | User lacks permission for a requested item |
| `404` | A requested item not found in DIAL Core |
| `413` | `ARCHIVE_MAX_FILES` or `ARCHIVE_MAX_UNCOMPRESSED_BYTES` exceeded |
| `429` | Rate limit exceeded |
| `500` | Unexpected archive stream failure before headers sent |
| `502` | DIAL Core returned an error |
| `503` | DIAL Core unreachable or timed out |

Errors **after** headers are committed (stream already started): logged; response stream destroyed; client receives incomplete/corrupt ZIP.

**Generated client impact:**
- `operationId`: `downloadArchive`
- Generated method: `filesApi.downloadArchiveRaw(body)` → `Promise<ApiResponse<Blob>>` (Raw used — generator gap for binary response)
- `filesApi.downloadArchive(body)` also generated but emits `Blob | void` — not used by frontend
- Frontend callers use `downloadArchiveRaw` to access the native `Response` and then `response.blob()`

**Frontend wrapper** in `apps/chat/src/server-api/files.api.ts`:
```ts
export const downloadArchive = async (
  items: DownloadArchiveItemDto[],
): Promise<Response> => {
  const raw = await filesApi.downloadArchiveRaw({ items });
  return raw.raw;
};
```

---

## Archive generation logic

**ZIP library:** `archiver` npm package. Added to `apps/chat-api/package.json` dependencies. `@types/archiver` added to devDependencies.

**`FilesService.downloadArchive(items, at, res)`:**

1. **Pre-validate** `items` array (checked by DTO, but service applies limits).
2. **Expand folders**:
   - For each `nodeType === 'folder'` item, call `getFileMetadata(bucket, path, { recursive: true })` and paginate via `nextToken` until exhausted.
   - Include all file items (including `.dial_folder` markers); skip folder nodes only.
   - Build flat list of `{ bucket, path, archivePath }`.
3. **Expand files**: add `nodeType === 'item'` items directly to the flat list.
4. **Deduplicate** by `{bucket}:{path}`: when a folder and one of its children are both selected, keep one entry.
5. **Handle duplicate top-level names**: if two selected items produce the same root archive path, suffix with `_1`, `_2`, etc.
6. **Validate limits**:
   - `expandedFiles.length > ARCHIVE_MAX_FILES` → throw `413 PayloadTooLargeException` (before headers).
   - Total `contentLength` sum > `ARCHIVE_MAX_UNCOMPRESSED_BYTES` (where available in metadata) → throw `413`.
7. **Commit response headers** (no further HTTP-level error reporting possible after this point).
8. **Create `archiver` instance** (`format: 'zip'`); pipe to `res`.
9. **Register client disconnect handler**: `req.on('close', () => { archive.abort(); })`.
10. For each file in expanded list:
    - Call `client.downloadFile(bucket, path, { parseAs: 'stream' })` to get a `ReadableStream`.
    - Sanitize archive entry path (no `..`, no leading `/`, no backslash traversal).
    - Append to archiver: `archive.append(Readable.fromWeb(stream), { name: archivePath })`.
11. Call `archive.finalize()`.
12. Handle `archiver` errors → `logger.error`; destroy response.

(No special empty-directory entries — folders with only a `.dial_folder` marker produce a zero-byte marker file in the ZIP.)

---

## Recursive folder expansion and pagination

`FilesService.expandFolderContents(bucket, path, at, options)`:

1. Calls `client.getFileMetadata(bucket, path, { recursive: true, token: options.token })`.
2. If `nextToken` present in response, recursively fetches next pages.
3. Includes all file items (including `.dial_folder` markers); skips folder nodes only.
4. Returns flat `ExpandedFile[]`.

---

## ZIP-slip prevention

Applied in `FilesService.buildArchivePath(baseName, relativePath)`:

- Reject any path segment equal to `..`.
- Reject absolute paths (starting with `/`).
- Reject backslash-containing paths.
- Assert the fully resolved archive path starts with the expected base path.
- If any check fails: `logger.error` + `InternalServerErrorException` (before headers) or skip entry (after headers, log only).

---

## Archive filename determination

| Selection | Archive filename |
|-----------|----------------|
| One folder | `<folder-name>.zip` |
| One file | — (not archive; uses direct download) |
| Multiple items (any mix) | `files.zip` |

Filename sanitized: non-ASCII stripped, control characters stripped, `"` replaced with `'`, result truncated to 200 chars, `.zip` appended.

---

## Frontend download trigger

`onDownloadFiles(items: DialFile[])` in `useDialFileManager`:

```ts
const onDownloadFiles = useCallback(async (items: DialFile[]) => {
  setIsDownloading(true);
  try {
    if (items.length === 1 && items[0].nodeType === DialFileNodeType.ITEM) {
      // Single file: direct download
      const response = await downloadFile(items[0].bucket!, items[0].id);
      triggerBrowserDownload(response, items[0].name);
    } else {
      // Folder or bulk: archive download
      const archiveItems = items.map(toArchiveItem);
      const response = await downloadArchive(archiveItems);
      const blob = await response.blob();
      const filename = deriveArchiveFilename(items);
      triggerBlobDownload(blob, filename);
    }
  } catch {
    // show error toast via callback or error state
    setDownloadError('dialFileManager.downloadError');
  } finally {
    setIsDownloading(false);
  }
}, [...]);
```

`triggerBrowserDownload` and `triggerBlobDownload` are pure helper functions in `apps/chat/src/utils/` that:
1. Create a transient `<a>` element.
2. Set `href` (object URL) and `download` attribute.
3. Programmatically click.
4. Revoke the object URL via `URL.revokeObjectURL`.

---

## i18n keys

| Key | English |
|-----|---------|
| `dialFileManager.download` | `"Download"` |
| `dialFileManager.downloadError` | `"Download failed"` |

---

## RTL / direction impact

- No directional icons introduced specifically for download.
- Download toolbar button uses standard `DialFileManagerActions.Download` label — rendered by the ui-kit.
- Bulk-actions toolbar uses logical layout (provided by ui-kit internally).

---

## Accessibility

- `isDownloading` disables `onDownloadFiles` UI while in progress (the ui-kit handles disabling bulk-action buttons when the callback is absent or disabled).
- Error feedback: toast with `role="alert"`.
- No new modal — download is a fire-and-forget browser download.

---

## Memoisation

- `onDownloadFiles` wrapped in `useCallback` in `useDialFileManager`.

---

## Feature flag

Not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`.

---

## Rate limiting

| Endpoint | Limit |
|----------|-------|
| `GET /api/v1/files/download` | `60 req/min` (existing) |
| `POST /api/v1/files/download-archive` | `5 req/min` (new) |

---

## Scenarios

### Scenario: Download one file directly

- **GIVEN** the user selects a single file `report.pdf`
- **WHEN** the user clicks "Download" (row action or bulk toolbar)
- **THEN** `onDownloadFiles([{ nodeType: 'item', bucket: 'user-bucket', id: 'folder/report.pdf', name: 'report.pdf' }])` is called
- **AND** `downloadFile('user-bucket', 'folder/report.pdf')` is called via `filesApi.downloadFileRaw`
- **AND** `GET /api/v1/files/download?bucket=user-bucket&path=folder%2Freport.pdf` is sent
- **AND** the browser saves `report.pdf` using the filename from `Content-Disposition`
- **AND** no archive endpoint is called

---

### Scenario: Download one folder as ZIP

- **GIVEN** the user selects a folder named `reports`
- **WHEN** the user clicks "Download"
- **THEN** `onDownloadFiles([{ nodeType: 'folder', ... }])` is called
- **AND** `downloadArchive([{ bucket, path: 'reports/', name: 'reports', nodeType: 'folder' }])` is called
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
- **AND** the frontend shows `dialFileManager.downloadError`

---

### Scenario: Forbidden or missing item

- **GIVEN** a selected file is `403 Forbidden` in DIAL Core during expansion
- **WHEN** the BFF tries to list/access it
- **THEN** the BFF returns `403 Forbidden` before committing response headers
- **AND** the frontend shows the download error

- **GIVEN** a selected item is `404 Not Found` in DIAL Core
- **THEN** the BFF returns `404 Not Found` before committing headers

---

### Scenario: Client disconnect during streaming

- **GIVEN** the archive stream has started (headers committed) and the client disconnects mid-download
- **WHEN** `req.on('close')` fires on the NestJS controller
- **THEN** the abort handler calls `archive.abort()` and destroys the response stream
- **AND** all pending SDK `downloadFile` calls are aborted via `AbortController`
- **AND** no error is thrown to the client (connection already closed)

---

### Scenario: Existing Attach behavior unchanged

- **GIVEN** the user downloads a file from the file manager
- **WHEN** the download completes
- **THEN** the selected paths set is unchanged; the "Attach" button remains in its prior state
- **AND** no attachment is added to the message input

---

### Scenario: Unsupported mutation actions remain absent

- **GIVEN** the file manager is open
- **THEN** delete, rename, move, copy, share, permissions actions are not visible or accessible
- **AND** only Download is enabled in bulk actions; other action labels are not provided
