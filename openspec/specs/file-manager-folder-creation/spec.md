# Spec: File Manager Folder Creation

## State ownership

`useDialFileManager` (`apps/chat/src/hooks/files/useDialFileManager.ts`) owns folder-creation state.

New state field:
```ts
const [isCreatingFolder, setIsCreatingFolder] = useState(false);
```

Exposed in `UseDialFileManagerResult`:
- `onCreateFolder(file, folderPath, fileId)` — creates the folder via BFF
- `onCreateFolderValidate(name, parentFolder)` — validates inline before BFF call
- `isCreatingFolder` — disables conflicting actions while creating

---

## API endpoint

### New: `POST /api/v1/files/folders`

- **Controller**: `FilesController` (`apps/chat-api/src/files/files.controller.ts`)
- **Handler name**: `createFolder` → operationId `createFolder`
- **Rate limit**: `@Throttle({ default: { limit: 10, ttl: 60000 } })`
- **Authentication**: session guard (existing)
- **Request content-type**: `application/json`
- **Response content-type**: `application/json`

**Request DTO** (`apps/chat-api/src/files/dto/create-folder.dto.ts`):

```ts
class CreateFolderDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[\w.-]+$/)
  @MaxLength(256)
  @ApiProperty({ description: 'DIAL Core bucket', example: 'user-bucket' })
  bucket!: string;

  @IsString()
  @IsOptional()
  @Matches(/^([\w.\-]+\/)*$/)
  @MaxLength(1024)
  @IsValidFilePath()
  @ApiPropertyOptional({ description: 'Parent folder path (trailing slash required, empty for root)', example: 'reports/' })
  parentPath?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^[^/\\.\0][^/\\\0]{0,253}$/)
  @IsNotEqual(MARKER_NAME)  // custom validator: rejects '.dial_folder'
  @ApiProperty({ description: 'New folder name (no slashes, no traversal, not the reserved marker name)', example: '2026' })
  name!: string;
}
```

**Example request:**
```json
{
  "bucket": "user-bucket",
  "parentPath": "reports/",
  "name": "2026"
}
```

**Example response (201):**
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

**Response DTO** (`apps/chat-api/src/files/dto/create-folder-response.dto.ts`):
```ts
class CreateFolderResponseDto {
  @ApiProperty() name!: string;
  @ApiProperty() path!: string;
  @ApiProperty() parentPath!: string;
  @ApiProperty() bucket!: string;
  @ApiProperty() nodeType!: 'folder';
  @ApiProperty() folderId!: string;
}
```

**Error codes:**

| Code | Condition |
|------|-----------|
| `400` | Invalid `name`, `parentPath`, or `bucket` format |
| `401` | Unauthenticated |
| `403` | User lacks permission on the bucket |
| `404` | Parent folder not found (DIAL Core 404) |
| `409` | A folder (or file) with the same name already exists at the parent path |
| `429` | Rate limit exceeded |
| `502` | DIAL Core returned an error |
| `503` | DIAL Core unreachable or timed out |

**Generated client impact:**
- `operationId`: `createFolder`
- Generated method: `filesApi.createFolder({ bucket, parentPath?, name })` → `Promise<CreateFolderResponseDto>`
- Frontend callers use the normal generated method (not Raw).

**Frontend wrapper** in `apps/chat/src/server-api/files.api.ts`:
```ts
export const createFolder = (params: {
  bucket: string;
  parentPath?: string;
  name: string;
}): Promise<CreateFolderResponseDto> => filesApi.createFolder(params);
```

---

## Folder persistence strategy: zero-byte marker

The DIAL TypeScript SDK (`0.1.0-dev.24`) provides no dedicated `createFolder` method. DIAL Core has no folder metadata endpoint. A folder path becomes visible in `getFileMetadata` only when at least one object exists under that prefix.

**Selected strategy**: upload a zero-byte marker file named `.dial_folder` at the path `{parentPath}{name}/.dial_folder`.

**Backend implementation** (`FilesService.createFolder`):

1. Build marker path: `${parentPath ?? ''}${name}/.dial_folder`.
2. Check for existence: call `client.getFileMetadata(bucket, markerPath, ...)`.
   - If `200` **and** `markerMetadataMatches(data, bucket, markerPath)` → throw `ConflictException` (`409`).
   - If `200` but probe does **not** match the requested marker path (false positive from parent marker) → proceed to upload.
   - If `404` → proceed.
   - If `403` → throw `ForbiddenException`.
   - Any other error → `handleDialError`.
3. Upload zero-byte marker: call `client.uploadFile(bucket, markerPath, { body: emptyBlob })`.
4. Return `CreateFolderResponseDto` with full DIAL resource paths (`files/{bucket}/...`).

**MARKER_NAME constant**: `HIDDEN_FILE` (`.dial_folder`) from `@epam/ai-dial-chat-shared`, re-exported from `apps/chat-api/src/files/files.constants.ts`.

---

## Marker visibility rules

`FilesService.listFiles` and `FilesService.expandFolderContents` **do not filter** marker items.

1. Marker items with `name === '.dial_folder'` are included in `ListFilesResponseDto.items`.
2. `resolveListingPermissions` promotes marker `permissions` to `response.permissions` when listing inside an empty folder.
3. `DialFileManager` toolbar `showHiddenFilesToggle: true` controls marker visibility in the grid (ui-kit).
4. Archive downloads include `.dial_folder` entries as zero-byte ZIP files.
5. Folder rows remain non-selectable for Attach (`nodeType === folder`).

---

## Inline validation (`onCreateFolderValidate`)

Called by `DialFileManager` during name input (before `onCreateFolder`):

```ts
onCreateFolderValidate: (name: string, parentFolder: DialFile): string | null
```

Rules (synchronous — no BFF call):
- Empty name → error key `dialFileManager.folderNameEmpty`
- Contains `/`, `\`, or a forbidden symbol from `forbiddenSymbolsRegExp` → error key `dialFileManager.folderNameInvalidChars`
- Starts with `.` → error key `dialFileManager.folderNameHidden`
- Equals `.dial_folder` → error key `dialFileManager.folderNameReserved`
- Exceeds 255 characters → error key `dialFileManager.folderNameTooLong`
- Duplicate sibling name (case-insensitive check against `parentFolder.items`) → error key `dialFileManager.folderConflict`

Forbidden-symbol validation SHALL use the same effective symbol set as rename validation: path separators (`/` and `\`) are always rejected, and all other forbidden characters come from the `forbiddenSymbolsRegExp` option passed to `useDialFileManager`. Production File Manager hosts pass `NOT_ALLOWED_SYMBOLS_REGEXP` from `@epam/ai-dial-ui-kit`, so names such as `reports:2026` are rejected before `onCreateFolder` is called.

Conflict check in `onCreateFolderValidate` is against the **cached** `items` — it is a best-effort pre-check. The authoritative `409` check is server-side (`markerMetadataMatches` on the marker probe in `FilesService.createFolder`).

`onCreateFolder` does not catch BFF errors locally — failures (including `409`) propagate to `DialFileManager`, which surfaces them inline in the folder-creation dialog.

---

## Cache update after creation

After `onCreateFolder` resolves successfully:
```ts
setCache((prev) =>
  mergeCreatedFolderIntoCache(prev, parentApiPath, created, listingPermissions),
);
setRetryCounter((c) => c + 1);
```

`mergeListingItems` unions cached items with incoming DIAL results on refetch so optimistically created folders are not lost when Core lags.

---

## i18n keys

| Key | English |
|-----|---------|
| `dialFileManager.newFolder` | `"New folder"` |
| `dialFileManager.folderCreateError` | `"Failed to create folder"` — shown as an error toast through `useNotification` |
| `dialFileManager.folderConflict` | `"A folder with this name already exists"` |
| `dialFileManager.folderNameEmpty` | `"Folder name cannot be empty"` |
| `dialFileManager.folderNameInvalidChars` | `"Folder name should not contain special symbols {{notAllowedSymbols}}"` |
| `dialFileManager.folderNameHidden` | `"Folder name cannot start with a dot"` |
| `dialFileManager.folderNameReserved` | `"This folder name is reserved"` |
| `dialFileManager.folderNameTooLong` | `"Folder name is too long"` |

---

## RTL / direction impact

- No directional icons in the folder creation flow.
- Inline validation messages are rendered by the ui-kit `DialFileManager` internally — no new directional Tailwind needed in `DialFileManagerShell`.

---

## Accessibility

- Folder name input is managed by `DialFileManager` internally (ui-kit built-in).
- Validation error messages rendered by `DialFileManager` are inline — no additional ARIA work required in `DialFileManagerShell`.

---

## Memoisation

- `onCreateFolder` wrapped in `useCallback` in `useDialFileManager`.
- `onCreateFolderValidate` wrapped in `useCallback` (depends on `t` and `forbiddenSymbolsRegExp`; sibling conflict input is supplied by the `parentFolder` argument).

---

## Feature flag

Not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`.

---

## Observability / telemetry

No new metrics or analytics events beyond `MetricsInterceptor` (request duration, error rate on `POST /api/v1/files/folders`).

---

## Scenarios

### Scenario: Create a root folder

- **GIVEN** the user is at the root folder
- **WHEN** the user clicks "New folder", types `"2026"`, and confirms
- **THEN** `onCreateFolder` is called with `folderPath = '/All files/2026'` (full virtual path of the new folder; `file.name` is `.dial_folder`)
- **AND** the hook parses `name = '2026'` and calls `POST /api/v1/files/folders` with `{ bucket, parentPath: '', name: '2026' }`
- **AND** the BFF uploads a zero-byte file at `2026/.dial_folder`
- **AND** `createFolder` returns `{ name: '2026', path: 'files/{bucket}/2026/', ... }`
- **AND** the parent folder cache is updated optimistically; the listing is re-fetched
- **AND** the new folder `2026` appears in the grid

---

### Scenario: Create a nested folder

- **GIVEN** the user is browsed into `/All files/reports/`
- **WHEN** the user creates a folder named `Q1`
- **THEN** `onCreateFolder` is called with `folderPath = '/All files/reports/Q1'`
- **AND** `POST /api/v1/files/folders` is called with `{ bucket, parentPath: 'reports/', name: 'Q1' }`
- **AND** the marker is uploaded at `reports/Q1/.dial_folder`
- **AND** the `reports/` cache entry is updated; `Q1` appears in the grid

---

### Scenario: Empty folder remains visible after refresh

- **GIVEN** a folder `empty-folder` was created at root with only a marker file
- **WHEN** the user closes and reopens the modal (re-fetching the root listing)
- **THEN** `empty-folder` appears in the grid (from optimistic cache merge and/or DIAL Core prefix listing)
- **AND** navigating into `empty-folder` may list the `.dial_folder` marker (hidden by default via ui-kit "Hidden files" toggle)

---

### Scenario: Duplicate folder conflict

- **GIVEN** a folder named `reports` already exists at root (marker verified at `reports/.dial_folder`)
- **WHEN** the user tries to create a folder also named `reports`
- **THEN** `onCreateFolderValidate` returns the conflict error message (case-insensitive match against cached items)
- **AND** the ui-kit shows the error inline; the user cannot confirm until the name changes
- **WHEN** two users race and both slip past the client-side check
- **THEN** the BFF probes the marker path; when `markerMetadataMatches` confirms the marker exists, `createFolder` returns `409`
- **AND** `DialFileManager` surfaces the error inline to the second user

---

### Scenario: False-positive metadata probe does not block creation

- **GIVEN** `getFileMetadata` for `parent/child/.dial_folder` returns `200` with the **parent** folder's marker metadata (DIAL Core quirk)
- **WHEN** `createFolder` is called for `child`
- **THEN** `markerMetadataMatches` returns false
- **AND** the BFF proceeds to upload the marker at `parent/child/.dial_folder`

---

### Scenario: Invalid folder name — traversal

- **GIVEN** the user types `../secret`
- **WHEN** `onCreateFolderValidate` runs
- **THEN** the slash in the name triggers the `folderNameInvalidChars` error inline
- **AND** if a crafted request bypasses the frontend and hits the BFF directly
- **THEN** `CreateFolderDto` `@Matches` validation rejects the name with `400 Bad Request`

---

### Scenario: Invalid folder name — forbidden symbol

- **GIVEN** the user types `reports:2026`
- **WHEN** `onCreateFolderValidate` runs
- **THEN** the colon in the name triggers the `folderNameInvalidChars` error inline

---

### Scenario: Folder name starts with dot (reserved)

- **GIVEN** the user types `.hidden-folder`
- **WHEN** `onCreateFolderValidate` runs
- **THEN** the `folderNameHidden` error is returned inline

---

### Scenario: Folder name is `.dial_folder` (reserved marker)

- **GIVEN** the user types `.dial_folder`
- **WHEN** `onCreateFolderValidate` runs
- **THEN** the `folderNameReserved` error is returned inline
- **AND** even if the BFF is called directly, the `@IsNotEqual(MARKER_NAME)` validator returns `400`

---

### Scenario: Marker included in file listings

- **GIVEN** a folder exists that was created using the marker strategy
- **WHEN** `GET /api/v1/files/list?bucket=...&path=that-folder/` is called
- **THEN** the `.dial_folder` item is included in `items`
- **AND** the ui-kit hides it by default via the "Hidden files" toggle
- **AND** the folder node itself is visible in the parent listing when DIAL Core returns it (optimistic cache merge covers Core lag)

---

### Scenario: Existing Attach behavior unchanged

- **GIVEN** the user creates a folder
- **WHEN** the folder appears in the grid
- **THEN** the folder row is not selectable (existing `isRowSelectable` checks `nodeType === DialFileNodeType.ITEM`)
- **AND** the "Attach" button remains disabled while no files are selected
