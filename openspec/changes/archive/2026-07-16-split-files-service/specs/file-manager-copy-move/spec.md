## MODIFIED Requirements

### Requirement: POST /api/v1/files/copy endpoint

The BFF SHALL expose `POST /api/v1/files/copy` that accepts a batch of file/folder items, copies each via DIAL Core `copyResource`, and returns a per-item result array.

**State ownership**: `FilesBatchOperationsService` (`apps/chat-api/src/files/batch/files-batch-operations.service.ts`) owns all copy logic, sharing its per-child dispatch/fan-out/aggregate-partial-failure control flow with delete, rename, and move through one internal generic helper. It injects `FilesListingService` for `expandFolderContents`. `FilesController` delegates through the `FilesService` facade (`apps/chat-api/AGENTS.md`).

**Authorization**: session cookie → `req.user.at` (bearer token forwarded to DIAL Core), identical to `/rename` and `/delete`.

**Rate limit**: `@Throttle({ default: { limit: 10, ttl: 60000 } })` — 10 requests/minute per user, same as `/rename` and `/delete`.

#### Scenario: Single file copy succeeds

- **WHEN** `POST /api/v1/files/copy` is called with a single `nodeType: "item"` item and DIAL Core returns 200 for `copyResource`
- **THEN** the response contains `results[0].success = true`

#### Scenario: Single file copy can overwrite an existing destination

- **WHEN** `POST /api/v1/files/copy` is called with `overwrite: true`
- **THEN** the BFF forwards `overwrite: true` to DIAL Core `copyResource`

### Requirement: Folder copy via paginated expansion

When `nodeType === "folder"`, the BFF SHALL recursively list all files under the source prefix using `FilesListingService.expandFolderContents` (paginated, `recursive: true`, `limit: 1000`, following `nextToken` until exhausted — the same method used by delete, rename, and archive download), then call `copyResource` once per expanded file with the destination path substituting the source prefix for the destination prefix.

#### Scenario: Folder copy copies all nested files

- **WHEN** `POST /api/v1/files/copy` is called with `nodeType: "folder"`, `sourcePath: "reports/"`, `destinationPath: "archive/reports/"`
- **THEN** each file under `reports/` (including `reports/.dial_folder`) is copied to `archive/reports/` preserving relative paths, and `results[0].success = true`

#### Scenario: Partial folder copy failure

- **WHEN** one file copy within a folder returns 403 from DIAL Core
- **THEN** remaining files are still attempted, and the folder result is `success: false` with `error: "Partial copy"`

### Requirement: POST /api/v1/files/move endpoint (cross-folder)

The BFF SHALL expose `POST /api/v1/files/move`, distinct from `POST /api/v1/files/rename`, that accepts a batch of file/folder items and relocates each across folders via DIAL Core `moveResource`, returning a per-item result array. `FilesBatchOperationsService` owns this logic (same ownership and shared dispatch helper as copy/delete/rename above).

**Authorization**, **rate limit** (`@Throttle({ default: { limit: 10, ttl: 60000 } })`), and **caching** posture are identical to `/copy` above.

#### Scenario: Single file move succeeds

- **WHEN** `POST /api/v1/files/move` is called with a single `nodeType: "item"` item, `sourcePath` and `destinationPath` in different parent folders, and DIAL Core returns 200 for `moveResource`
- **THEN** the response contains `results[0].success = true`

### Requirement: Folder move via paginated expansion

The BFF SHALL apply the identical folder-expansion algorithm used for folder copy (above) when moving a folder: recursively list all files under the source prefix via `FilesListingService.expandFolderContents`, then call `moveResource` once per expanded file, substituting `"Partial move"` for the folder-level failure error string.

#### Scenario: Folder move relocates all nested files

- **WHEN** `POST /api/v1/files/move` is called with `nodeType: "folder"`, `sourcePath: "drafts/"`, `destinationPath: "final/drafts/"`
- **THEN** each file under `drafts/` (including `drafts/.dial_folder`) is moved to `final/drafts/` preserving relative paths, and `results[0].success = true`

### Requirement: Copy/move observability

`FilesBatchOperationsService` SHALL emit structured log lines at the start and end of each `copyFiles`/`moveFiles` batch call, including `batchSize`, `successCount`, and `failedCount`, matching the existing pattern in `renameFiles`.

#### Scenario: Copy batch logged on start and completion

- **WHEN** `copyFiles` is called with N items
- **THEN** a `log` line records `batchSize=N` at start, and another records `success`/`failed` counts at completion

#### Scenario: Move batch logged on start and completion

- **WHEN** `moveFiles` is called with N items
- **THEN** a `log` line records `batchSize=N` at start, and another records `success`/`failed` counts at completion
