# Spec: file-manager-rename-api

### Requirement: POST /api/v1/files/rename endpoint

The BFF SHALL expose `POST /api/v1/files/rename` that accepts a batch of file/folder items, renames (moves) each via DIAL Core `moveResource`, and returns a per-item result array.

**State ownership**: `FilesBatchOperationsService` (`apps/chat-api/src/files/batch/files-batch-operations.service.ts`) owns all rename logic, sharing its per-child dispatch/fan-out/aggregate-partial-failure control flow with delete, copy, and move through one internal generic helper. `FilesController` delegates through the `FilesService` facade, following the thin-controller pattern. All backend implementation follows `apps/chat-api/AGENTS.md` (URI versioning, `Logger` + `ConfigService`, validated DTOs, typed HTTP exceptions).

**Authorization**: session cookie → `req.user.at` (bearer token forwarded to DIAL Core). Same as all other files endpoints.

**Rate limit**: `@Throttle({ default: { limit: 10, ttl: 60000 } })` — 10 requests/minute per user (same as delete; folder rename fans out many Core calls).

#### Request DTO

**`RenameItemNodeType`** (string enum, `apps/chat-api/src/files/dto/rename-files.dto.ts`):
```
Item   = 'item'
Folder = 'folder'
```

**`RenameItemDto`**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `bucket` | `string` | `@IsString @IsNotEmpty @Matches(/^[\w.-]+$/) @MaxLength(256)` | DIAL Core bucket |
| `sourcePath` | `string` | `@IsString @IsNotEmpty @IsValidFilePath() @MaxLength(1024)` | Relative source path within bucket |
| `destinationPath` | `string` | `@IsString @IsNotEmpty @IsValidFilePath() @MaxLength(1024)` | Relative destination path within bucket |
| `nodeType` | `RenameItemNodeType` | `@IsEnum(RenameItemNodeType)` | `'item'` or `'folder'` |
| `name` | `string` | `@IsString @IsNotEmpty @MaxLength(255)` | Display name (last segment) for error messages |

**`RenameFilesDto`**:

| Field | Type | Constraints |
|-------|------|-------------|
| `items` | `RenameItemDto[]` | `@IsArray @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => RenameItemDto)` |

#### Response DTO

**`RenameItemResultDto`**:

| Field | Type | Description |
|-------|------|-------------|
| `sourcePath` | `string` | Source path from request |
| `destinationPath` | `string` | Destination path from request |
| `success` | `boolean` | `true` when all Core `moveResource` calls succeeded |
| `error` | `string?` | Human-readable error reason when `success` is `false` |

**`RenameFilesResponseDto`**:

| Field | Type |
|-------|------|
| `results` | `RenameItemResultDto[]` |

#### Controller signature

```typescript
@Post('rename')
@HttpCode(200)
@Throttle({ default: { limit: 10, ttl: 60000 } })
@ApiOperation({ summary: 'Rename files and folders' })
@ApiResponse({ status: 200, type: RenameFilesResponseDto })
@ApiResponse({ status: 400, description: 'Invalid request body' })
@ApiResponse({ status: 401, description: 'Not authenticated' })
@ApiResponse({ status: 429, description: 'Rate limit exceeded' })
@ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
@ApiResponse({ status: 503, description: 'DIAL Core unreachable or timed out' })
async renameFiles(
  @Body() body: RenameFilesDto,
  @Req() req: Request,
): Promise<RenameFilesResponseDto>
```

#### Generated-client impact

- **operationId**: `filesControllerRenameFiles` → generated SDK method `filesApi.renameFiles({ renameFilesDto })`.
- **Request DTO**: `RenameFilesDto` (sent as JSON body).
- **Response DTO**: `RenameFilesResponseDto` (JSON).
- **Frontend caller**: `apps/chat/src/server-api/files.api.ts` exposes `renameFiles(items: RenameItemDto[]): Promise<RenameFilesResponseDto>`. Uses the normal (non-Raw) generated method.

**Example request**:
```json
POST /api/v1/files/rename
{
  "items": [
    {
      "bucket": "user-bucket",
      "sourcePath": "reports/q1.pdf",
      "destinationPath": "reports/q1-final.pdf",
      "nodeType": "item",
      "name": "q1.pdf"
    }
  ]
}
```

**Example response**:
```json
{
  "results": [
    {
      "sourcePath": "reports/q1.pdf",
      "destinationPath": "reports/q1-final.pdf",
      "success": true
    }
  ]
}
```

#### Scenario: Single file rename succeeds

- **WHEN** `POST /api/v1/files/rename` is called with a single `nodeType: "item"` item and DIAL Core returns 200 for `moveResource`
- **THEN** the response contains `results[0].success = true`

#### Scenario: Single file rename returns conflict

- **WHEN** `POST /api/v1/files/rename` is called and DIAL Core returns 409 for `moveResource`
- **THEN** `results[0].success = false` and `results[0].error = "Conflict"`

#### Scenario: Single file rename returns forbidden

- **WHEN** DIAL Core returns 403 for `moveResource`
- **THEN** `results[0].success = false` and `results[0].error = "Forbidden"`

#### Scenario: Single file rename — source not found

- **WHEN** DIAL Core returns 404 for `moveResource` on the source
- **THEN** `results[0].success = false` and `results[0].error = "Not found"`

#### Scenario: Validation rejects empty items array

- **WHEN** `POST /api/v1/files/rename` is called with `items: []`
- **THEN** the endpoint returns `400 Bad Request`

#### Scenario: Validation rejects more than 100 items

- **WHEN** `POST /api/v1/files/rename` is called with 101 items
- **THEN** the endpoint returns `400 Bad Request`

---

### Requirement: Folder rename via paginated expansion

When `nodeType === "folder"`, the BFF SHALL recursively list all files under the source prefix using `FilesListingService.expandFolderContents` (paginated with `recursive: true`, `limit: 1000`, following `nextToken` until exhausted), then call `moveResource` once per expanded file with the destination path substituting the source prefix for the destination prefix.

**Folder path normalisation**: `sourcePath` and `destinationPath` MUST end with `/`. If not, the service SHALL append `/` before processing.

**Marker handling**: `.dial_folder` appears as a regular file in the recursive listing and MUST be included in the move set (moved from `{srcPrefix}.dial_folder` to `{destPrefix}.dial_folder`).

**Partial failure**: if any individual `moveResource` call fails, the overall folder result is `success: false` with `error: "Partial rename"`. Already-moved files remain at their new paths (no rollback).

**Concurrency**: individual file moves within a folder are issued sequentially. Multiple top-level batch items run in parallel via `Promise.all`.

**Mapping rule**: for a file at `child.path` under `srcPrefix`, the destination path is `destPrefix + child.path.slice(srcPrefix.length)`.

#### Scenario: Folder rename moves all nested files

- **WHEN** `POST /api/v1/files/rename` is called with `nodeType: "folder"`, `sourcePath: "reports/"`, `destinationPath: "reports-2026/"`
- **THEN** each file under `reports/` (including `reports/.dial_folder`) is moved to `reports-2026/` preserving relative paths, and `results[0].success = true`

#### Scenario: Folder rename with 2000+ files paginates fully

- **WHEN** a folder contains more than 1000 files
- **THEN** `expandFolderContents` fetches all pages via `nextToken` before any `moveResource` calls are made, and all files are included in the rename

#### Scenario: Partial folder rename failure

- **WHEN** one file move within a folder returns 403 from DIAL Core
- **THEN** remaining files are still attempted, and the folder result is `success: false` with `error: "Partial rename"`

#### Scenario: Folder rename preserves nested subfolder structure

- **WHEN** `reports/sub/q2.pdf` exists under `reports/`
- **THEN** it is moved to `reports-2026/sub/q2.pdf` after renaming `reports/` → `reports-2026/`

---

### Requirement: Rename observability

`FilesBatchOperationsService` SHALL emit structured log lines at the start and end of each `renameFiles` batch call, including `batchSize`, `successCount`, and `failedCount`. Per-item failures SHALL log `warn` with `bucket`, `sourcePath`, `destinationPath`, and DIAL Core `status`.

#### Scenario: Rename batch logged on start and completion

- **WHEN** `renameFiles` is called with N items
- **THEN** a `log` line records `batchSize=N` at start, and another records `success` and `failed` counts at completion
