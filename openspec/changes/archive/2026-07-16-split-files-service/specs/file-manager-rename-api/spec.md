## MODIFIED Requirements

### Requirement: POST /api/v1/files/rename endpoint

The BFF SHALL expose `POST /api/v1/files/rename` that accepts a batch of file/folder items, renames (moves) each via DIAL Core `moveResource`, and returns a per-item result array.

**State ownership**: `FilesBatchOperationsService` (`apps/chat-api/src/files/batch/files-batch-operations.service.ts`) owns all rename logic, sharing its per-child dispatch/fan-out/aggregate-partial-failure control flow with delete, copy, and move through one internal generic helper. `FilesController` delegates through the `FilesService` facade, following the thin-controller pattern. All backend implementation follows `apps/chat-api/AGENTS.md` (URI versioning, `Logger` + `ConfigService`, validated DTOs, typed HTTP exceptions).

**Authorization**: session cookie → `req.user.at` (bearer token forwarded to DIAL Core). Same as all other files endpoints.

**Rate limit**: `@Throttle({ default: { limit: 10, ttl: 60000 } })` — 10 requests/minute per user (same as delete; folder rename fans out many Core calls).

#### Scenario: Single file rename succeeds

- **WHEN** `POST /api/v1/files/rename` is called with a single `nodeType: "item"` item and DIAL Core returns 200 for `moveResource`
- **THEN** the response contains `results[0].success = true`

#### Scenario: Single file rename returns conflict

- **WHEN** `POST /api/v1/files/rename` is called and DIAL Core returns 409 for `moveResource`
- **THEN** `results[0].success = false` and `results[0].error = "Conflict"`

### Requirement: Folder rename via paginated expansion

When `nodeType === "folder"`, the BFF SHALL recursively list all files under the source prefix using `FilesListingService.expandFolderContents` (paginated with `recursive: true`, `limit: 1000`, following `nextToken` until exhausted), then call `moveResource` once per expanded file with the destination path substituting the source prefix for the destination prefix.

**Partial failure**: if any individual `moveResource` call fails, the overall folder result is `success: false` with `error: "Partial rename"`. Already-moved files remain at their new paths (no rollback).

#### Scenario: Folder rename moves all nested files

- **WHEN** `POST /api/v1/files/rename` is called with `nodeType: "folder"`, `sourcePath: "reports/"`, `destinationPath: "reports-2026/"`
- **THEN** each file under `reports/` (including `reports/.dial_folder`) is moved to `reports-2026/` preserving relative paths, and `results[0].success = true`

#### Scenario: Partial folder rename failure

- **WHEN** one file move within a folder returns 403 from DIAL Core
- **THEN** remaining files are still attempted, and the folder result is `success: false` with `error: "Partial rename"`

### Requirement: Rename observability

`FilesBatchOperationsService` SHALL emit structured log lines at the start and end of each `renameFiles` batch call, including `batchSize`, `successCount`, and `failedCount`. Per-item failures SHALL log `warn` with `bucket`, `sourcePath`, `destinationPath`, and DIAL Core `status`.

#### Scenario: Rename batch logged on start and completion

- **WHEN** `renameFiles` is called with N items
- **THEN** a `log` line records `batchSize=N` at start, and another records `success` and `failed` counts at completion
