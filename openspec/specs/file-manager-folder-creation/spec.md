# file-manager-folder-creation Specification

## Purpose

Creating folders as zero-byte markers, with inline name validation and the cache update that follows.

## State ownership

`useDialFileMutations` (`libs/chat-hooks/src/files/useDialFileMutations/useDialFileMutations.ts (@epam/ai-dial-chat-hooks)`) owns folder-creation state (`const [isCreatingFolder, setIsCreatingFolder] = useState(false)`). `useDialFileManager` composes it and exposes the result.

Exposed in `UseDialFileManagerResult`:
- `onCreateFolder(file, folderPath, fileId)` — creates the folder via BFF
- `onCreateFolderValidate(name, parentFolder)` — validates inline before BFF call; returns `string | null` by passing the lib's structured `FileNameValidationError` through the host-supplied `buildValidationErrorMessage` option
- `isCreatingFolder` — disables conflicting actions while creating

---

## API endpoint

### New: `POST /api/v1/files/folders`

- **Controller**: `FilesController` (`apps/chat-api/src/files/files.controller.ts`)
- **Handler name**: `createFolder` → operationId `createFolder`
- **Authentication**: session guard (existing)
- **Request content-type**: `application/json`
- **Response content-type**: `application/json`

**Request DTO** (`apps/chat-api/src/files/dto/create-folder.dto.ts`):

```ts
class CreateFolderDto {
  @IsString()
  @IsNotEmpty()
  @Matches(BUCKET_NAME_PATTERN, { message: BUCKET_NAME_VALIDATION_MESSAGE })
  @MaxLength(256)
  bucket!: string;

  @IsOptional()
  @IsString()
  @IsValidFilePath()
  @MaxLength(1024)
  parentPath?: string; // no leading slash, no `..`; empty for root

  @IsString()
  @IsNotEmpty()
  @Matches(/^(?!\.+$)[^/\\\0]{1,254}$/)  // leading dot allowed (hidden folder); dot-only names rejected
  @IsNotReservedMarkerName()  // rejects '.dial_folder'
  @MaxLength(254)
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

**Response DTO** (declared in the same `apps/chat-api/src/files/dto/create-folder.dto.ts`):
```ts
class CreateFolderResponseDto {
  @ApiProperty() name!: string;
  @ApiProperty() path!: string;
  @ApiProperty() parentPath!: string;
  @ApiProperty() bucket!: string;
  @ApiProperty({ example: FOLDER_NODE_TYPE }) nodeType!: string; // always 'folder'
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
| `429` | DIAL Core rate limit exceeded (mapped by the DIAL error mapper; not declared in the controller's Swagger responses) |
| `502` | DIAL Core returned an error |
| `503` | DIAL Core unreachable or timed out |

**Generated client impact:**
- `operationId`: `createFolder`
- Generated method: `filesApi.createFolder({ bucket, parentPath?, name })` → `Promise<CreateFolderResponseDto>`
- Frontend callers use the normal generated method (not Raw).

**Frontend wiring**: `apps/chat/src/server-api/files.api.ts` builds `createFilesApiClient(filesApi, uploadFileWithProgress)` (from `@epam/ai-dial-chat-hooks`) and re-exports its `createFolder`. File-manager hooks reach it through the injected `DialFilesApi` port (`filesApi.createFolder(...)`), not a hand-written wrapper.

---

## Folder persistence strategy: zero-byte marker

The DIAL TypeScript SDK (`0.1.0-dev.24`) provides no dedicated `createFolder` method. DIAL Core has no folder metadata endpoint. A folder path becomes visible in `getFileMetadata` only when at least one object exists under that prefix.

**Selected strategy**: upload a zero-byte marker file named `.dial_folder` at the path `{parentPath}{name}/.dial_folder`.

**Backend implementation**, owned by `FilesFolderService` (`apps/chat-api/src/files/folder/files-folder.service.ts`), which injects `FilesUploadService` to perform the marker-file write (`FilesFolderService.createFolder`):

1. Build marker path: `${parentPath ?? ''}${name}/.dial_folder`.
2. Check for existence: call `client.getFileMetadata(bucket, markerPath, ...)`.
   - If `200` **and** `markerMetadataMatches(data, bucket, markerPath)` → throw `ConflictException` (`409`).
   - If `200` but probe does **not** match the requested marker path (false positive from parent marker) → proceed to upload.
   - If `404` → proceed.
   - Any other error (including `403`) → `handleDialSdkError`.
3. Upload zero-byte marker via `FilesUploadService.uploadFile(bucket, markerPath, { buffer: Buffer.alloc(0), mimetype: 'application/octet-stream', originalname: MARKER_NAME }, at)`.
4. Return `CreateFolderResponseDto` with full DIAL resource paths (`files/{bucket}/...`). Non-`HttpException` failures are logged and passed to `handleDialSdkError`.

**MARKER_NAME constant**: a local literal `'.dial_folder'` in `apps/chat-api/src/files/files.constants.ts`, with a comment requiring it to stay in sync with `HIDDEN_FILE` in `libs/chat-shared/src/constants/dial.ts`.

---

## Marker visibility rules

`FilesListingService.listFiles` and `FilesListingService.expandFolderContents` (the shared folder-traversal primitive relocated from the original monolithic `FilesService`, and reused by `FilesBatchOperationsService` and `FilesArchiveDownloadService`) **do not filter** marker items.

1. Marker items with `name === '.dial_folder'` are included in `ListFilesResponseDto.items`.
2. `resolveListingPermissions` promotes marker `permissions` to `response.permissions` when listing inside an empty folder.
3. `DialFileManager` toolbar `showHiddenFilesToggle: true` controls marker visibility in the grid (ui-kit).
4. Archive downloads (via `FilesArchiveDownloadService`, which calls `FilesListingService.expandFolderContents`) include `.dial_folder` entries as zero-byte ZIP files.
5. Folder rows remain non-selectable for Attach (`nodeType === folder`).

---

## Inline validation (`onCreateFolderValidate`)

Called by `DialFileManager` during name input (before `onCreateFolder`):

```ts
// useDialFileMutations (lib, no `t`)
onCreateFolderValidate: (name: string, parentFolder: DialFile): FileNameValidationError | null
// useDialFileManager result (string for the grid)
onCreateFolderValidate: (name: string, parentFolder: DialFile): string | null
```

The lib returns a structured `FileNameValidationError` (`{ reason: FileNameValidationErrorReason, symbols?, maxLength?, existingName? }`). `useDialFileManager` turns it into text with the host's `buildValidationErrorMessage` option; in `apps/chat` that is `buildValidationErrorMessage(t, error)` in `apps/chat/src/components/DialFileManagerShell/file-manager-notification-adapter.ts`, which uses the folder wording when no rename item is passed.

Rules, evaluated **in this order** by `useDialFileMutations.onCreateFolderValidate`, which returns on the first match (synchronous — no BFF call):
1. Empty or whitespace-only name → `Empty` → `dialFileManager.folderNameEmpty`
2. Contains a path separator (`/`, `\`) or a symbol matched by `forbiddenSymbolsRegExp` → `ForbiddenSymbols` (`symbols: NOT_ALLOWED_SYMBOLS`) → `dialFileManager.folderNameInvalidChars`
3. Equals `.dial_folder` → `ReservedName` → `dialFileManager.folderNameReserved`
4. Exceeds 255 characters → `TooLong` (`maxLength: 255`) → `dialFileManager.folderNameTooLong`
5. Duplicate sibling name (case-insensitive check against `parentFolder.items`) → `DuplicateName` (`existingName`) → `dialFileManager.folderConflict`

There is no `..` rule and no leading-dot rule: a leading dot is accepted, so the folder is created as a hidden folder and appears once "Show hidden files" is on. A name that breaks several rules reports the first one it trips; `../secret` reports the forbidden-symbols message because it contains `/`.

Each call also records its result as the last live validation error; `onCreateFolder` refuses to call the BFF when either its own re-validation of the resolved name or that last live result is non-null.

Forbidden-symbol validation SHALL use the same effective symbol set as rename validation: path separators (`/` and `\`) are always rejected, and all other forbidden characters come from the `forbiddenSymbolsRegExp` option passed to `useDialFileManager`. Production File Manager hosts pass `NOT_ALLOWED_SYMBOLS_REGEXP` from `@epam/ai-dial-ui-kit`, so names such as `reports:2026` are rejected before `onCreateFolder` is called.

Conflict check in `onCreateFolderValidate` is against the **cached** `items` — it is a best-effort pre-check. The authoritative `409` check is server-side (`markerMetadataMatches` on the marker probe in `FilesFolderService.createFolder`).

`onCreateFolder` catches BFF errors (including `409`) locally and emits `onNotification({ variant: NotificationVariant.Error, reason: FileManagerNotificationReason.FolderCreateFailed })`; the app adapter shows it as the `dialFileManager.folderCreateError` error toast. The promise resolves without rethrowing.

---

## Cache update after creation

After `filesApi.createFolder` resolves successfully, `onCreateFolder` (`useDialFileMutations`) calls:
```ts
mergeCreatedFolder(
  parentApiPath,
  created,
  listingPermissionsCache.get(parentApiPath),
);
bumpRetry();
```

`mergeCreatedFolder` (`libs/chat-hooks/src/files/useDialFileListing/useDialFileListing.ts`) runs `setCache((prev) => mergeCreatedFolderIntoCache(prev, parentApiPath, created, inheritedPermissions))`. `mergeCreatedFolderIntoCache` (`libs/chat-hooks/src/files/dial-file-manager-mapping.util.ts`) returns a new `Map` whose `parentApiPath` entry has a synthesized folder `ListFilesItemDto` appended — unless a case-insensitive same-name item is already there — so the folder shows immediately, including when it was created from a destination-folder popup browsing a different parent. `bumpRetry` increments `retryCounter`, which refetches the currently browsed `folderPath`.

This optimistic entry is **not** preserved across a refetch. Every listing fetch in `useDialFileListing` (the `retryCounter`-driven current-folder effect, tree expansion, and destination-popup loads) writes its result with `next.set(apiPath, flat)` / `new Map(prev).set(apiPath, flat)`, replacing the folder's cache entry outright; there is no merge of cached and incoming items (no `mergeListingItems` helper exists). After the next refetch of the parent, the folder is shown only if DIAL Core's listing returns it. DIAL Core has no empty-folder concept — a folder exists only while some object is stored under its prefix — so a created folder that the listing does not return disappears from the grid at that refetch and reappears once an object exists under it (for example after a file is uploaded into it). This is expected behaviour: the hooks keep no client-side record of created folders beyond that cache entry. A tab or session change (`setCache(new Map())`) also discards it.

---

## i18n keys

| Key | English |
|-----|---------|
| `dialFileManager.newFolder` | `"Folder"` |
| `dialFileManager.folderCreateError` | `"Failed to create folder"` — shown as an error toast through `useNotification` |
| `dialFileManager.folderConflict` | `"A folder with this name already exists"` |
| `dialFileManager.folderNameEmpty` | `"Folder name cannot be empty"` |
| `dialFileManager.folderNameInvalidChars` | `"Folder name should not contain special symbols {{notAllowedSymbols}}"` |
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

- `onCreateFolder` wrapped in `useCallback` in `useDialFileMutations`.
- `onCreateFolderValidate` wrapped in `useCallback` in `useDialFileMutations` with deps `[forbiddenSymbolsRegExp]` (sibling conflict input is supplied by the `parentFolder` argument); `useDialFileManager` re-wraps it with deps `[mutations, buildValidationErrorMessage]`.

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

### Scenario: Created folder after a refetch depends only on DIAL Core's listing

- **GIVEN** a folder `empty-folder` was created at root and is shown through the optimistic `mergeCreatedFolderIntoCache` entry
- **WHEN** the root listing is re-fetched (for example the user closes and reopens the modal)
- **THEN** the root cache entry is replaced by the DIAL Core result; the optimistic entry is not carried over
- **AND** `empty-folder` appears only if DIAL Core's root listing returns it; otherwise it stays absent until an object (such as an uploaded file) exists under its prefix
- **AND** when it is listed, navigating into it may list the `.dial_folder` marker (hidden by default via ui-kit "Hidden files" toggle)

---

### Scenario: Duplicate folder conflict

- **GIVEN** a folder named `reports` already exists at root (marker verified at `reports/.dial_folder`)
- **WHEN** the user tries to create a folder also named `reports`
- **THEN** `onCreateFolderValidate` returns the conflict error message (case-insensitive match against cached items)
- **AND** the ui-kit shows the error inline; the user cannot confirm until the name changes
- **WHEN** two users race and both slip past the client-side check
- **THEN** the BFF probes the marker path; when `markerMetadataMatches` confirms the marker exists, `createFolder` returns `409`
- **AND** `onCreateFolder` catches it and the second user sees the `dialFileManager.folderCreateError` error toast

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
- **THEN** the name is rejected inline before `onCreateFolder` is called
- **AND** the inline message is `folderNameInvalidChars`, because the name contains the path separator `/`
- **AND** if a crafted request bypasses the frontend and hits the BFF directly
- **THEN** `CreateFolderDto` `@Matches` validation rejects the name with `400 Bad Request`

---

### Scenario: Invalid folder name — forbidden symbol

- **GIVEN** the user types `reports:2026`
- **WHEN** `onCreateFolderValidate` runs
- **THEN** the colon in the name triggers the `folderNameInvalidChars` error inline

---

### Scenario: Folder name starts with dot (hidden folder)

- **GIVEN** the user types `.hidden-folder`
- **WHEN** the name is validated
- **THEN** the package shows the hidden-item soft warning inline and `onCreateFolderValidate` returns `null`
- **AND** confirming calls `createFolder` and the BFF creates `.hidden-folder/`
- **AND** the folder is not listed until "Show hidden files" is toggled on, then it is listed
- **AND** a name consisting only of dots (`.`, `..`) is rejected by `CreateFolderDto` with `400 Bad Request`

---

### Scenario: Folder name is `.dial_folder` (reserved marker)

- **GIVEN** the user types `.dial_folder`
- **WHEN** `onCreateFolderValidate` runs
- **THEN** the `folderNameReserved` error is returned inline
- **AND** even if the BFF is called directly, the `@IsNotReservedMarkerName()` validator returns `400`

---

### Scenario: Marker included in file listings

- **GIVEN** a folder exists that was created using the marker strategy
- **WHEN** `GET /api/v1/files/list?bucket=...&path=that-folder/` is called
- **THEN** the `.dial_folder` item is included in `items`
- **AND** the ui-kit hides it by default via the "Hidden files" toggle
- **AND** the folder node itself is visible in the parent listing only when DIAL Core returns it; the optimistic cache entry covers only the window before the parent's next refetch

---

### Scenario: Existing Attach behavior unchanged

- **GIVEN** the user creates a folder
- **WHEN** the folder appears in the grid
- **THEN** the folder row is not selectable (existing `isRowSelectable` checks `nodeType === DialFileNodeType.ITEM`)
- **AND** the "Attach" button remains disabled while no files are selected

## Requirements
### Requirement: Folder creation is rejected for invalid names independent of the host UI

`onCreateFolder` (`libs/chat-hooks/src/files/useDialFileMutations/useDialFileMutations.ts (@epam/ai-dial-chat-hooks)`) SHALL independently call `onCreateFolderValidate` with the resolved folder name and parent folder before calling the `POST /api/v1/files/folders` BFF endpoint, and SHALL NOT call it when `onCreateFolderValidate` returns a non-null error — regardless of whether the host `DialFileManager` component already blocked confirmation on that same validation result.

#### Scenario: Enter confirms an invalid folder name

- **WHEN** a user is creating a new folder, types a name that fails validation (empty, contains a forbidden symbol such as `/` or `:`, equals the reserved marker name, or exceeds 255 characters) so the inline error is shown, and presses Enter to confirm
- **THEN** `onCreateFolder` does not call the `createFolder` BFF endpoint and no folder is created

#### Scenario: Clicking the folder row confirms an invalid folder name

- **WHEN** a user is creating a new folder with an invalid name (as above) and confirms by clicking the folder row instead of pressing Enter
- **THEN** `onCreateFolder` does not call the `createFolder` BFF endpoint and no folder is created

#### Scenario: Valid folder name is created normally

- **WHEN** a user confirms a folder name that passes `onCreateFolderValidate`
- **THEN** `onCreateFolder` calls the `createFolder` BFF endpoint exactly as before this change, and the folder is created

#### Scenario: Parent folder resolution when creating outside the currently browsed folder

- **WHEN** a folder is created from a destination-folder popup browsing a different folder than the outer grid, so no cached sibling list is available for the new folder's actual parent
- **THEN** `onCreateFolder` still runs the empty-name, forbidden-symbol, reserved-name, and length checks against the resolved name
- **AND** the client-side sibling-duplicate check is best-effort only for this case; a genuine conflict is still caught by the BFF's `409` response, exactly as already specified for the existing conflict-check scenario
---
### Requirement: A created folder confirms itself

`onCreateFolder` (`libs/chat-hooks/src/files/useDialFileMutations/useDialFileMutations.ts (@epam/ai-dial-chat-hooks)`) SHALL emit `onOperationSuccess({ kind: FileOperationKind.FolderCreated, name })` (`name` = the created folder's resolved name) after the `POST /api/v1/files/folders` call resolves and the created folder has been merged into the listing cache. The lib calls no app hook; the app adapter `handleFileOperationSuccess` (`apps/chat/src/components/DialFileManagerShell/file-manager-notification-adapter.ts`) maps that event to `notifyOperationSuccess(NotifiableEntity.Folder, EntityOperation.Created, { name })` from `useOperationNotification` (see `entity-operation-notifications`), so a folder created into a collapsed or non-visible parent still produces feedback.

The notification SHALL NOT be raised when validation rejects the name locally or when the BFF returns `409`; those paths keep their existing inline error and error-toast behaviour.

#### Scenario: Folder created from the grid confirms

- **WHEN** a user confirms a valid new folder name and the create request succeeds
- **THEN** a success notification titled `"Folder created successfully"` is shown, naming the folder

#### Scenario: Folder created from a destination-folder popup confirms

- **WHEN** a folder is created from a destination-folder popup browsing a different folder than the outer grid, and the create request succeeds
- **THEN** the same success notification is shown, even though the new folder is not visible in the outer grid

#### Scenario: Rejected name raises no success notification

- **WHEN** the name fails client-side validation, or the BFF responds `409`
- **THEN** no success notification is raised and the existing inline error / error toast behaviour is unchanged

---

### Requirement: An optimistically created folder lives only until the parent's next listing refetch

After a successful `createFolder`, `useDialFileMutations.onCreateFolder` SHALL insert the created folder into its parent's listing cache through `mergeCreatedFolder` → `mergeCreatedFolderIntoCache` (`libs/chat-hooks/src/files/dial-file-manager-mapping.util.ts`) so it is displayed immediately, and SHALL NOT persist that entry beyond the parent's next listing fetch: `useDialFileListing` replaces a folder's cache entry with the fetched items (`next.set(apiPath, flat)`) and does not merge previously cached items back in. Because DIAL Core has no empty folders, a created folder that DIAL Core's listing does not return disappears from the grid at that refetch and reappears once an object (for example an uploaded file) is stored under it; this is the expected behaviour, not a defect.

#### Scenario: Created folder is shown immediately

- **WHEN** `createFolder` resolves for folder `drafts` under the root
- **THEN** `mergeCreatedFolderIntoCache` appends a `drafts` folder item to the root cache entry (skipped if a case-insensitive same-name item already exists) and the folder appears in the grid before any refetch completes

#### Scenario: Optimistic folder disappears on refetch when DIAL Core does not list it

- **GIVEN** folder `drafts` is displayed only through the optimistic cache entry
- **WHEN** the root listing is re-fetched and DIAL Core's response does not include `drafts`
- **THEN** the root cache entry is replaced by the response and `drafts` is no longer shown
- **AND** no error or notification is raised

#### Scenario: Folder reappears once it holds a file

- **GIVEN** folder `drafts` disappeared after a refetch
- **WHEN** a file is uploaded into `drafts/` and the root listing is re-fetched
- **THEN** DIAL Core lists `drafts` and it is shown again
