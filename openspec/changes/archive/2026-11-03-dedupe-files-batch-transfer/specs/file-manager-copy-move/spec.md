## MODIFIED Requirements

### Requirement: Folder copy via paginated expansion

When `nodeType === "folder"`, the BFF SHALL recursively list all files under the source prefix using `FilesListingService.expandFolderContents` (paginated, `recursive: true`, `limit: 1000`, following `nextToken` until exhausted — the same method used by delete, rename, and archive download), then call `copyResource` once per expanded file with the destination path substituting the source prefix for the destination prefix.

**Folder path normalisation**: `sourcePath` and `destinationPath` MUST end with `/`; the service appends `/` if missing.

**Marker handling**: `.dial_folder` appears as a regular file in the recursive listing and MUST be included in the copy set.

**Partial failure**: if any individual `copyResource` call fails, the overall folder result is `success: false` with `error: "Partial copy"`. Already-copied files remain at their new paths (no rollback).

**Concurrency**: individual file copies within a folder are issued sequentially (the shared `runFolderFanOut` step used by the rename/copy/move transfer pipeline and by `deleteFolderItem` — no concurrency constant is introduced). Multiple top-level batch items run in parallel via `Promise.all`.

**Mapping rule**: for a file at `child.path` under `srcPrefix`, the destination path is `destPrefix + child.path.slice(srcPrefix.length)`.

#### Scenario: Folder copy copies all nested files

- **WHEN** `POST /api/v1/files/copy` is called with `nodeType: "folder"`, `sourcePath: "reports/"`, `destinationPath: "archive/reports/"`
- **THEN** each file under `reports/` (including `reports/.dial_folder`) is copied to `archive/reports/` preserving relative paths, and `results[0].success = true`

#### Scenario: Folder copy with 2000+ files paginates fully

- **WHEN** a folder contains more than 1000 files
- **THEN** `expandFolderContents` fetches all pages via `nextToken` before any `copyResource` calls are made

#### Scenario: Partial folder copy failure

- **WHEN** one file copy within a folder returns 403 from DIAL Core
- **THEN** remaining files are still attempted, and the folder result is `success: false` with `error: "Partial copy"`
