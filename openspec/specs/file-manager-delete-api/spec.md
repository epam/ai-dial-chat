# Spec: file-manager-delete-api

## Requirement: POST /api/v1/files/delete endpoint

The BFF SHALL expose `POST /api/v1/files/delete` that accepts a batch of file/folder items, deletes each from DIAL Core, and returns a per-item result array.

### State ownership

`FilesBatchOperationsService` (`apps/chat-api/src/files/batch/files-batch-operations.service.ts`) owns all delete logic, sharing its per-child dispatch/fan-out/aggregate-partial-failure control flow with rename, copy, and move through one internal generic helper. It injects `FilesListingService` for `expandFolderContents`. `FilesController` delegates through the `FilesService` facade, following the existing thin-controller pattern.

### Request DTO

**`DeleteItemNodeType`** (string enum, `apps/chat-api/src/files/dto/delete-files.dto.ts`):
```
Item   = 'item'
Folder = 'folder'
```

**`DeleteItemDto`**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `bucket` | `string` | `@IsString @IsNotEmpty @Matches(/^[\w.-]+$/) @MaxLength(256)` | DIAL Core bucket |
| `path` | `string` | `@IsString @IsNotEmpty @IsValidFilePath() @MaxLength(1024)` | Relative file/folder path within bucket |
| `name` | `string` | `@IsString @IsNotEmpty @MaxLength(255)` | Display name (used in error messages) |
| `nodeType` | `DeleteItemNodeType` | `@IsEnum(DeleteItemNodeType)` | `'item'` or `'folder'` |

**`DeleteFilesDto`**:

| Field | Type | Constraints |
|-------|------|-------------|
| `items` | `DeleteItemDto[]` | `@IsArray @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => DeleteItemDto)` |

### Response DTO

**`DeleteItemResultDto`**:

| Field | Type | Description |
|-------|------|-------------|
| `path` | `string` | Same path from request |
| `success` | `boolean` | `true` when DIAL Core returned 2xx or 404 (already gone) |
| `error` | `string?` | Human-readable error reason when `success` is `false` |

**`DeleteFilesResponseDto`**:

| Field | Type |
|-------|------|
| `results` | `DeleteItemResultDto[]` |

### Controller signature

```typescript
@Post('delete')
@HttpCode(200)
@Throttle({ default: { limit: 10, ttl: 60000 } })
@ApiOperation({ summary: 'Delete files and folders' })
@ApiResponse({ status: 200, type: DeleteFilesResponseDto })
@ApiResponse({ status: 400, description: 'Invalid request body' })
@ApiResponse({ status: 401, description: 'Not authenticated' })
@ApiResponse({ status: 429, description: 'Rate limit exceeded' })
@ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
@ApiResponse({ status: 503, description: 'DIAL Core unreachable or timed out' })
async deleteFiles(
  @Body() body: DeleteFilesDto,
  @Req() req: Request,
): Promise<DeleteFilesResponseDto>
```

### Service behavior

1. For each `DeleteItemDto`:
   - If `nodeType === 'item'`: call `this.client.deleteFile(bucket, relativePath, { headers: getBearerAuthHeaders(at) })`.  
     - 2xx → `{ path, success: true }`.  
     - 404 → `{ path, success: true }` (already gone, treat as success).  
     - 403 → `{ path, success: false, error: 'Forbidden' }`.  
     - Other → `{ path, success: false, error: 'Delete failed' }`.
   - If `nodeType === 'folder'`: call `expandFolderContents` (reuse existing method), then delete each expanded file individually. Finally, attempt to delete `${folderRelPath}.dial_folder` marker (404 is silently ignored). Aggregate: if all children and marker succeed → `{ path, success: true }`; if any child fails → `{ path, success: false, error: 'Partial folder delete' }`.
2. Return `{ results }` after all items are processed.

**Folder path normalisation**: if `path` does not end with `/`, append `/` before passing to `expandFolderContents` (same as archive download).

**`expandFolderContents` reuse**: the method lives on `FilesListingService` (relocated from the original monolithic `FilesService`); `FilesBatchOperationsService` calls it with `at` from the session token.

### Generated client

- **operationId**: `filesControllerDeleteFiles` (NestJS auto-name)
- **SDK method**: `filesApi.deleteFiles({ deleteFilesDto: { items } })`
- **Request DTO**: `DeleteFilesDto`
- **Response DTO**: `DeleteFilesResponseDto`
- **Raw method**: Not needed (JSON response).

### Cache key and invalidation

This endpoint does not manage server-side cache. Cache TTL/invalidation is frontend-only (per the hook design).

### Rate limiting

`@Throttle({ default: { limit: 10, ttl: 60000 } })` — 10 calls per 60 s per authenticated user.

### Concrete example

**Request**:
```json
POST /api/v1/files/delete
Content-Type: application/json

{
  "items": [
    { "bucket": "user-files", "path": "reports/q1.pdf", "name": "q1.pdf", "nodeType": "item" },
    { "bucket": "user-files", "path": "old-data/", "name": "old-data", "nodeType": "folder" }
  ]
}
```

**Response (all success)**:
```json
HTTP 200
{
  "results": [
    { "path": "reports/q1.pdf", "success": true },
    { "path": "old-data/",      "success": true }
  ]
}
```

**Response (partial failure)**:
```json
HTTP 200
{
  "results": [
    { "path": "reports/q1.pdf", "success": true },
    { "path": "old-data/", "success": false, "error": "Forbidden" }
  ]
}
```

**Response (validation failure)**:
```json
HTTP 400
{
  "statusCode": 400,
  "message": ["items must contain no more than 100 elements"],
  "error": "Bad Request"
}
```

---

## Scenarios

### Scenario: Delete a single file

- **GIVEN** a valid session and `items = [{ bucket, path: "report.pdf", nodeType: "item" }]`
- **WHEN** `POST /api/v1/files/delete` is called
- **THEN** `200 { results: [{ path: "report.pdf", success: true }] }`

### Scenario: File already gone (404 from DIAL Core)

- **GIVEN** the file does not exist on DIAL Core
- **WHEN** delete is called for that file
- **THEN** `results[0].success === true` (idempotent)

### Scenario: Delete folder recursively

- **GIVEN** `items = [{ bucket, path: "old-data/", nodeType: "folder" }]`
- **WHEN** `POST /api/v1/files/delete` is called
- **THEN** all child files and the `.dial_folder` marker are deleted; `results[0].success === true`

### Scenario: Partial batch failure (2 of 5 items forbidden)

- **GIVEN** 5 items where items 2 and 4 return 403 from DIAL Core
- **WHEN** delete is called
- **THEN** `200` with `results[1].success === false` and `results[3].success === false`; remaining items are `success: true`

### Scenario: Batch exceeds 100 items

- **GIVEN** `items` array with 101 elements
- **WHEN** `POST /api/v1/files/delete` is called
- **THEN** `400 Bad Request` with validation error message

### Scenario: Unauthenticated request

- **GIVEN** no valid session cookie
- **WHEN** `POST /api/v1/files/delete` is called
- **THEN** `401 Unauthorized`

### Scenario: DIAL Core unreachable

- **GIVEN** DIAL Core times out
- **WHEN** delete is called
- **THEN** `503 Service Unavailable`

### Scenario: Rate limit exceeded

- **GIVEN** user has sent 10 delete requests in the last 60 s
- **WHEN** an 11th request arrives
- **THEN** `429 Too Many Requests`

---

## Tests

**Controller tests** (`apps/chat-api/src/files/tests/files.controller.spec.ts`):
- `POST /api/v1/files/delete` → 200 with results array (mock `FilesService.deleteFiles`)
- `POST /api/v1/files/delete` → 400 when body is invalid (missing `items`)
- `POST /api/v1/files/delete` → 401 when unauthenticated

**Service unit tests** (`apps/chat-api/src/files/tests/files.service.spec.ts`):
- `deleteFiles` single item success
- `deleteFiles` single item returns 404 → `success: true`
- `deleteFiles` single item returns 403 → `success: false, error: 'Forbidden'`
- `deleteFiles` folder expands and deletes all children + marker
- `deleteFiles` folder marker missing (404) → still `success: true`
- `deleteFiles` partial batch — independent results returned
- `deleteFiles` batch of 100 (boundary) — no validation error
