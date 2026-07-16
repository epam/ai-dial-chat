## MODIFIED Requirements

### Requirement: Folder persistence strategy backend implementation

The DIAL TypeScript SDK provides no dedicated `createFolder` method and DIAL Core has no folder metadata endpoint; a folder path becomes visible in `getFileMetadata` only when at least one object exists under that prefix. Folder creation SHALL be implemented via a zero-byte marker file named `.dial_folder`, owned by `FilesFolderService` (`apps/chat-api/src/files/folder/files-folder.service.ts`), which injects `FilesUploadService` to perform the marker-file write. `FilesController` continues to delegate through the `FilesService` facade.

1. Build marker path: `${parentPath ?? ''}${name}/.dial_folder`.
2. Check for existence: call `client.getFileMetadata(bucket, markerPath, ...)`.
   - If `200` **and** `markerMetadataMatches(data, bucket, markerPath)` → throw `ConflictException` (`409`).
   - If `200` but the probe does **not** match the requested marker path (false positive from a parent marker) → proceed to upload.
   - If `404` → proceed.
   - If `403` → throw `ForbiddenException`.
   - Any other error → `handleDialError`.
3. Upload the zero-byte marker via `FilesUploadService.uploadFile(bucket, markerPath, { body: emptyBlob })`.
4. Return `CreateFolderResponseDto` with full DIAL resource paths (`files/{bucket}/...`).

#### Scenario: Create a root folder

- **WHEN** the user creates a folder named `2026` at the root
- **THEN** `FilesFolderService.createFolder` builds the marker path `2026/.dial_folder`, probes for an existing marker via DIAL Core, and — finding none — calls `FilesUploadService.uploadFile` to write the zero-byte marker
- **AND** `createFolder` returns `{ name: '2026', path: 'files/{bucket}/2026/', ... }`

#### Scenario: Duplicate folder conflict surfaces from the marker probe

- **WHEN** a folder named `reports` already exists (marker verified at `reports/.dial_folder`) and a second creation request for `reports` is made
- **THEN** `FilesFolderService.createFolder`'s marker probe finds a matching marker via `markerMetadataMatches` and throws `ConflictException` (`409`)

#### Scenario: False-positive metadata probe does not block creation

- **GIVEN** `getFileMetadata` for `parent/child/.dial_folder` returns `200` with the **parent** folder's marker metadata (DIAL Core quirk)
- **WHEN** `FilesFolderService.createFolder` is called for `child`
- **THEN** `markerMetadataMatches` returns false and the service proceeds to upload the marker at `parent/child/.dial_folder`

### Requirement: Marker visibility in listings

`FilesListingService.listFiles` and `FilesListingService.expandFolderContents` (the shared folder-traversal primitive relocated from the original monolithic `FilesService`, and reused by `FilesBatchOperationsService` and `FilesArchiveDownloadService`) SHALL NOT filter marker items.

1. Marker items with `name === '.dial_folder'` are included in `ListFilesResponseDto.items`.
2. `resolveListingPermissions` promotes marker `permissions` to `response.permissions` when listing inside an empty folder.
3. Archive downloads (via `FilesArchiveDownloadService`, which calls `FilesListingService.expandFolderContents`) include `.dial_folder` entries as zero-byte ZIP files.

#### Scenario: Marker included in file listings

- **GIVEN** a folder exists that was created using the marker strategy
- **WHEN** `GET /api/v1/files/list?bucket=...&path=that-folder/` is called
- **THEN** `FilesListingService.listFiles` includes the `.dial_folder` item in `items`
- **AND** the ui-kit hides it by default via the "Hidden files" toggle
