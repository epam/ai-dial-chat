## MODIFIED Requirements

### Requirement: POST /api/v1/files/delete endpoint

The BFF SHALL expose `POST /api/v1/files/delete` that accepts a batch of file/folder items, deletes each from DIAL Core, and returns a per-item result array.

**State ownership**: `FilesBatchOperationsService` (`apps/chat-api/src/files/batch/files-batch-operations.service.ts`) owns all delete logic, sharing its per-child dispatch/fan-out/aggregate-partial-failure control flow with rename, copy, and move through one internal generic helper. It injects `FilesListingService` for `expandFolderContents`. `FilesController` delegates through the `FilesService` facade, following the existing thin-controller pattern.

**Folder path normalisation**: if `path` does not end with `/`, append `/` before passing to `expandFolderContents` (same as archive download).

**`expandFolderContents` reuse**: the method lives on `FilesListingService` (relocated from the original monolithic `FilesService`); `FilesBatchOperationsService` calls it with `at` from the session token.

#### Scenario: Delete a single file

- **GIVEN** a valid session and `items = [{ bucket, path: "report.pdf", nodeType: "item" }]`
- **WHEN** `POST /api/v1/files/delete` is called
- **THEN** `200 { results: [{ path: "report.pdf", success: true }] }`

#### Scenario: Delete folder recursively

- **GIVEN** `items = [{ bucket, path: "old-data/", nodeType: "folder" }]`
- **WHEN** `POST /api/v1/files/delete` is called
- **THEN** all child files and the `.dial_folder` marker are deleted; `results[0].success === true`

#### Scenario: Partial batch failure (2 of 5 items forbidden)

- **GIVEN** 5 items where items 2 and 4 return 403 from DIAL Core
- **WHEN** delete is called
- **THEN** `200` with `results[1].success === false` and `results[3].success === false`; remaining items are `success: true`
