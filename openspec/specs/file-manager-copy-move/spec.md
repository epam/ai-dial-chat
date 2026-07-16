# Spec: file-manager-copy-move

### Requirement: POST /api/v1/files/copy endpoint

The BFF SHALL expose `POST /api/v1/files/copy` that accepts a batch of file/folder items, copies each via DIAL Core `copyResource`, and returns a per-item result array.

**State ownership**: `FilesBatchOperationsService` (`apps/chat-api/src/files/batch/files-batch-operations.service.ts`) owns all copy logic, sharing its per-child dispatch/fan-out/aggregate-partial-failure control flow with delete, rename, and move through one internal generic helper. It injects `FilesListingService` for `expandFolderContents`. `FilesController` delegates through the `FilesService` facade (`apps/chat-api/AGENTS.md`).

**Authorization**: session cookie → `req.user.at` (bearer token forwarded to DIAL Core), identical to `/rename` and `/delete`. No additional role is required beyond an authenticated session with WRITE permission on the destination (enforced by DIAL Core, surfaced as a per-item `"Forbidden"` result).

**Rate limit**: `@Throttle({ default: { limit: 10, ttl: 60000 } })` — 10 requests/minute per user, same as `/rename` and `/delete`.

**Caching**: this endpoint does not read from or write to the NestJS in-memory cache. Frontend-side folder-listing caches (per-`useDialFileManager` instance, not shared/global) are invalidated by the hook on completion — see `file-manager-copy-move` frontend requirements below.

#### Request DTO

**`CopyItemNodeType`** (string enum, `apps/chat-api/src/files/dto/copy-files.dto.ts`):
```
Item   = 'item'
Folder = 'folder'
```

**`CopyItemDto`**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `bucket` | `string` | `@IsString @IsNotEmpty @Matches(BUCKET_NAME_PATTERN) @MaxLength(256)` | DIAL Core bucket |
| `sourcePath` | `string` | `@IsString @IsNotEmpty @IsValidFilePath() @MaxLength(1024)` | Relative source path within bucket |
| `destinationPath` | `string` | `@IsString @IsNotEmpty @IsValidFilePath() @MaxLength(1024)` | Relative destination path within bucket |
| `overwrite` | `boolean?` | `@IsOptional @IsBoolean` | When `true`, replace an existing destination resource. Omitted or `false` preserves the conflict behavior and DIAL Core can return 409. |
| `nodeType` | `CopyItemNodeType` | `@IsEnum(CopyItemNodeType)` | `'item'` or `'folder'` |
| `name` | `string` | `@IsString @IsNotEmpty @MaxLength(255)` | Display name (last segment) for error messages |

**`CopyFilesDto`**:

| Field | Type | Constraints |
|-------|------|-------------|
| `items` | `CopyItemDto[]` | `@IsArray @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => CopyItemDto)` |

#### Response DTO

**`CopyItemResultDto`**:

| Field | Type | Description |
|-------|------|-------------|
| `sourcePath` | `string` | Source path from request |
| `destinationPath` | `string` | Destination path from request |
| `success` | `boolean` | `true` when all Core `copyResource` calls succeeded |
| `error` | `string?` | Human-readable error reason when `success` is `false` |

**`CopyFilesResponseDto`**: `{ results: CopyItemResultDto[] }`

#### Controller signature

```typescript
@Post('copy')
@HttpCode(200)
@Throttle({ default: { limit: 10, ttl: 60000 } })
@ApiOperation({ summary: 'Copy files and folders' })
@ApiResponse({ status: 200, type: CopyFilesResponseDto })
@ApiResponse({ status: 400, description: 'Invalid request body' })
@ApiResponse({ status: 401, description: 'Not authenticated' })
@ApiResponse({ status: 429, description: 'Rate limit exceeded' })
@ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
@ApiResponse({ status: 503, description: 'DIAL Core unreachable or timed out' })
async copyFiles(
  @Body() body: CopyFilesDto,
  @Req() req: Request,
): Promise<CopyFilesResponseDto>
```

#### Generated-client impact

- **operationId**: `filesControllerCopyFiles` → generated SDK method `filesApi.copyFiles({ copyFilesDto })`.
- **Request DTO**: `CopyFilesDto` with `CopyItemDto.overwrite?: boolean`. **Response DTO**: `CopyFilesResponseDto`.
- **Frontend caller**: `apps/chat/src/server-api/files.api.ts` exposes `copyFiles(items: CopyItemDto[]): Promise<CopyFilesResponseDto>` using the normal (non-`Raw`) generated method.

**Example request**:
```json
POST /api/v1/files/copy
{
  "items": [
    {
      "bucket": "user-bucket",
      "sourcePath": "reports/q1.pdf",
      "destinationPath": "archive/q1.pdf",
      "overwrite": true,
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
    { "sourcePath": "reports/q1.pdf", "destinationPath": "archive/q1.pdf", "success": true }
  ]
}
```

#### Scenario: Single file copy succeeds

- **WHEN** `POST /api/v1/files/copy` is called with a single `nodeType: "item"` item and DIAL Core returns 200 for `copyResource`
- **THEN** the response contains `results[0].success = true`

#### Scenario: Single file copy returns conflict

- **WHEN** DIAL Core returns 409 for `copyResource` because the destination already exists
- **THEN** `results[0].success = false` and `results[0].error = "Conflict"`

#### Scenario: Single file copy can overwrite an existing destination

- **WHEN** `POST /api/v1/files/copy` is called with `overwrite: true`
- **THEN** the BFF forwards `overwrite: true` to DIAL Core `copyResource`

#### Scenario: Single file copy returns forbidden

- **WHEN** DIAL Core returns 403 for `copyResource`
- **THEN** `results[0].success = false` and `results[0].error = "Forbidden"`

#### Scenario: Single file copy — source not found

- **WHEN** DIAL Core returns 404 for `copyResource` on the source
- **THEN** `results[0].success = false` and `results[0].error = "Not found"`

#### Scenario: Validation rejects empty items array

- **WHEN** `POST /api/v1/files/copy` is called with `items: []`
- **THEN** the endpoint returns `400 Bad Request`

#### Scenario: Validation rejects more than 100 items

- **WHEN** `POST /api/v1/files/copy` is called with 101 items
- **THEN** the endpoint returns `400 Bad Request`

---

### Requirement: Folder copy via paginated expansion

When `nodeType === "folder"`, the BFF SHALL recursively list all files under the source prefix using `FilesListingService.expandFolderContents` (paginated, `recursive: true`, `limit: 1000`, following `nextToken` until exhausted — the same method used by delete, rename, and archive download), then call `copyResource` once per expanded file with the destination path substituting the source prefix for the destination prefix.

**Folder path normalisation**: `sourcePath` and `destinationPath` MUST end with `/`; the service appends `/` if missing.

**Marker handling**: `.dial_folder` appears as a regular file in the recursive listing and MUST be included in the copy set.

**Partial failure**: if any individual `copyResource` call fails, the overall folder result is `success: false` with `error: "Partial copy"`. Already-copied files remain at their new paths (no rollback).

**Concurrency**: individual file copies within a folder are issued sequentially (matches `renameFolderItem`/`deleteFolderItem` — no concurrency constant is introduced). Multiple top-level batch items run in parallel via `Promise.all`.

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

---

### Requirement: POST /api/v1/files/move endpoint (cross-folder)

The BFF SHALL expose `POST /api/v1/files/move`, distinct from `POST /api/v1/files/rename`, that accepts a batch of file/folder items and relocates each across folders via DIAL Core `moveResource`, returning a per-item result array. `/move` and `/rename` share the same underlying DIAL Core operation (`moveResource`) but are separate endpoints so the existing `/rename` contract (same-folder inline rename) is not altered by this change. `FilesBatchOperationsService` owns this logic (same ownership and shared dispatch helper as copy/delete/rename above).

**Authorization**, **rate limit** (`@Throttle({ default: { limit: 10, ttl: 60000 } })`), and **caching** posture are identical to `/copy` above.

#### Request/Response DTOs

**`MoveItemNodeType`**, **`MoveItemDto`**, **`MoveFilesDto`**, **`MoveItemResultDto`**, **`MoveFilesResponseDto`** (`apps/chat-api/src/files/dto/move-files.dto.ts`) are structurally identical to `CopyItemNodeType`/`CopyItemDto`/`CopyFilesDto`/`CopyItemResultDto`/`CopyFilesResponseDto` above, substituting "move" for "copy" throughout. `MoveItemDto.overwrite?: boolean` has the same validation and default behavior as `CopyItemDto.overwrite`.

#### Controller signature

```typescript
@Post('move')
@HttpCode(200)
@Throttle({ default: { limit: 10, ttl: 60000 } })
@ApiOperation({ summary: 'Move files and folders across folders' })
@ApiResponse({ status: 200, type: MoveFilesResponseDto })
@ApiResponse({ status: 400, description: 'Invalid request body' })
@ApiResponse({ status: 401, description: 'Not authenticated' })
@ApiResponse({ status: 429, description: 'Rate limit exceeded' })
@ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
@ApiResponse({ status: 503, description: 'DIAL Core unreachable or timed out' })
async moveFiles(
  @Body() body: MoveFilesDto,
  @Req() req: Request,
): Promise<MoveFilesResponseDto>
```

#### Generated-client impact

- **operationId**: `filesControllerMoveFiles` → `filesApi.moveFiles({ moveFilesDto })`.
- **Request DTO**: `MoveFilesDto` with `MoveItemDto.overwrite?: boolean`. **Response DTO**: `MoveFilesResponseDto`.
- **Frontend caller**: `apps/chat/src/server-api/files.api.ts` exposes `moveFiles(items: MoveItemDto[]): Promise<MoveFilesResponseDto>` using the normal (non-`Raw`) generated method.

**Example request**:
```json
POST /api/v1/files/move
{
  "items": [
    {
      "bucket": "user-bucket",
      "sourcePath": "inbox/draft.pdf",
      "destinationPath": "reports/draft.pdf",
      "overwrite": true,
      "nodeType": "item",
      "name": "draft.pdf"
    }
  ]
}
```

**Example response**:
```json
{
  "results": [
    { "sourcePath": "inbox/draft.pdf", "destinationPath": "reports/draft.pdf", "success": true }
  ]
}
```

#### Scenario: Single file move succeeds

- **WHEN** `POST /api/v1/files/move` is called with a single `nodeType: "item"` item, `sourcePath` and `destinationPath` in different parent folders, and DIAL Core returns 200 for `moveResource`
- **THEN** the response contains `results[0].success = true`

#### Scenario: Single file move returns conflict

- **WHEN** DIAL Core returns 409 for `moveResource`
- **THEN** `results[0].success = false` and `results[0].error = "Conflict"`

#### Scenario: Single file move can overwrite an existing destination

- **WHEN** `POST /api/v1/files/move` is called with `overwrite: true`
- **THEN** the BFF forwards `overwrite: true` to DIAL Core `moveResource`

#### Scenario: Single file move returns forbidden

- **WHEN** DIAL Core returns 403 for `moveResource`
- **THEN** `results[0].success = false` and `results[0].error = "Forbidden"`

#### Scenario: Single file move — source not found

- **WHEN** DIAL Core returns 404 for `moveResource` on the source
- **THEN** `results[0].success = false` and `results[0].error = "Not found"`

#### Scenario: Validation rejects empty items array

- **WHEN** `POST /api/v1/files/move` is called with `items: []`
- **THEN** the endpoint returns `400 Bad Request`

#### Scenario: Validation rejects more than 100 items

- **WHEN** `POST /api/v1/files/move` is called with 101 items
- **THEN** the endpoint returns `400 Bad Request`

---

### Requirement: Folder move via paginated expansion

The BFF SHALL apply the identical folder-expansion algorithm used for folder copy (above) when moving a folder: recursively list all files under the source prefix via `FilesListingService.expandFolderContents`, then call `moveResource` once per expanded file, substituting `"Partial move"` for the folder-level failure error string.

#### Scenario: Folder move relocates all nested files

- **WHEN** `POST /api/v1/files/move` is called with `nodeType: "folder"`, `sourcePath: "drafts/"`, `destinationPath: "final/drafts/"`
- **THEN** each file under `drafts/` (including `drafts/.dial_folder`) is moved to `final/drafts/` preserving relative paths, and `results[0].success = true`

#### Scenario: Partial folder move failure

- **WHEN** one file move within a folder returns 403 from DIAL Core
- **THEN** remaining files are still attempted, and the folder result is `success: false` with `error: "Partial move"`

---

### Requirement: Copy/move observability

`FilesBatchOperationsService` SHALL emit structured log lines at the start and end of each `copyFiles`/`moveFiles` batch call, including `batchSize`, `successCount`, and `failedCount`, matching the existing pattern in `renameFiles`.

#### Scenario: Copy batch logged on start and completion

- **WHEN** `copyFiles` is called with N items
- **THEN** a `log` line records `batchSize=N` at start, and another records `success`/`failed` counts at completion

#### Scenario: Move batch logged on start and completion

- **WHEN** `moveFiles` is called with N items
- **THEN** a `log` line records `batchSize=N` at start, and another records `success`/`failed` counts at completion

---

### Requirement: onCopyFiles wired on useDialFileManager

`useDialFileManager` (`apps/chat/src/hooks/files/useDialFileManager.ts`) SHALL expose `onCopyFiles(items: DialCopiedItem[], destinationFolder: string)`, wired to ui-kit's `DialFileManager.onCopyFiles` prop, that maps `DialCopiedItem[]` to `CopyItemDto[]` (via `virtualPathToApiPath`, same resolution as `onMoveToFiles`) and calls the `copyFiles` server-api wrapper.

**State ownership**: `useDialFileManager` owns `isCopying` state; no new context is introduced.

**Cache invalidation**: on completion (success or partial failure), the hook SHALL invalidate its per-folder listing cache entries for both the source and destination parent folders of every copied item, and increment `retryCounter` to force a re-fetch of the currently visible folder — identical invalidation shape to `onDeleteFiles`/`onMoveToFiles`.

**Notifications**: full failure and partial failure surface via `onNotification` (`NotificationVariant.Error`), matching the `RenameError`/`RenamePartialError` pattern. Any successful copied items surface a success notification via `onNotification` (`NotificationVariant.Success`) using the same title/message shape as delete: single item reports the copied destination name and destination folder; multiple items report the successful item count and destination folder.

**Memoisation**: `onCopyFiles` SHALL be a `useCallback` with dependencies `[bucket, rootLabel, onNotification, t]`, matching `onMoveToFiles`'s dependency shape.

**Path normalisation**: `sourcePath`/`destinationPath` derived from `item.sourceUrl`/`item.destinationUrl` via `virtualPathToApiPath` SHALL have consecutive slashes collapsed to one before being sent to the BFF — ui-kit paste/cut-paste interactions can construct a destination virtual path by concatenating a folder path (already ending in `/`) with a leading `/` + item name, producing `folder//name`, which DIAL Core rejects as a malformed resource path.

**Overwrite propagation**: when ui-kit's conflict resolver sets `DialCopiedItem.overwrite === true`, `onCopyFiles` SHALL pass `overwrite: true` on the corresponding `CopyItemDto`; otherwise it SHALL pass `overwrite: false`.

#### Scenario: Copy succeeds, cache is invalidated, and success toast is shown

- **WHEN** `onCopyFiles` is called with items that all succeed
- **THEN** the source and destination folder cache entries are cleared, `retryCounter` increments, and `onNotification` is called with `NotificationVariant.Success`

#### Scenario: Single copy success toast names the copied destination

- **WHEN** `onCopyFiles` is called with one item and `copyFiles` returns one successful result
- **THEN** the success notification title is `dialFileManager.itemCopiedSuccessfully`, and the message is produced from `dialFileManager.itemCopiedToFolder` with the destination item name and destination folder

#### Scenario: Multiple copy success toast reports count

- **WHEN** `onCopyFiles` is called with multiple items and more than one item succeeds
- **THEN** the success notification title is `dialFileManager.itemsCopiedSuccessfully`, and the message is produced from `dialFileManager.itemsCopiedToFolder` with the successful item count and destination folder

#### Scenario: Partial copy failure shows toast

- **WHEN** `onCopyFiles` is called and `copyFiles` returns a mix of successful and failed results
- **THEN** `onNotification` is called once with `NotificationVariant.Error` and a message reporting the failed count

#### Scenario: Double-slash destination path is collapsed before the request is sent

- **WHEN** `onCopyFiles` is called with an item whose `destinationUrl` contains a doubled slash (e.g. `/My files/folder//name.png`)
- **THEN** the `CopyItemDto.destinationPath` sent to `copyFiles` has the doubled slash collapsed to a single slash

#### Scenario: Conflict resolver overwrite is forwarded for copy

- **WHEN** `onCopyFiles` is called with a copied item containing `overwrite: true`
- **THEN** the corresponding `CopyItemDto` sent to `copyFiles` contains `overwrite: true`

---

### Requirement: onMoveToFiles dispatches rename vs cross-folder move by folder equality

`useDialFileManager.onMoveToFiles` SHALL partition the `DialCopiedItem[]` it receives into two groups based on whether each item's source parent folder equals its destination parent folder (both derived from `item.sourceUrl`/`item.destinationUrl`):

- Same parent folder → build `RenameItemDto[]` and call the existing `renameFiles` server-api wrapper — **behavior unchanged** from before this change.
- Different parent folder → build `MoveItemDto[]` and call the new `moveFiles` server-api wrapper.

Both groups run when both are non-empty; a single call to `onMoveToFiles` MAY produce both a `renameFiles` and a `moveFiles` request. Failure notifications from both groups SHALL be merged into a single toast reporting the total failed count across both operations, mirroring the existing partial-failure toast copy.

Successful cross-folder moves SHALL surface a success notification via `onNotification` (`NotificationVariant.Success`). Single-item success reports the moved destination name and destination folder; multi-item success reports the successful moved item count and destination folder. Same-folder rename remains silent on success and keeps the existing rename behavior.

**State ownership**: `useDialFileManager` owns a new `isMoving` state distinct from the existing `isRenaming`; the modal/shell shows the copy/move operation loader (see below) whenever `isCopying || isMoving` is true, and continues to show the existing inline-rename spinner overlay whenever `isRenaming` is true and `isMoving` is false (same-folder rename does not open the new operation-loader modal — it keeps today's lightweight overlay).

**Cache invalidation**: for the cross-folder-move group, invalidate cache entries for both source and destination parent folders of every moved item (same shape as `onDeleteFiles`). For the rename group, invalidation is unchanged from current behavior.

**Memoisation**: `onMoveToFiles` remains a single `useCallback`.

**Path normalisation**: the same slash-collapsing normalisation described for `onCopyFiles` applies to `sourcePath`/`destinationPath` for both the rename and move DTO groups built here.

**Overwrite propagation**: for cross-folder moves, when ui-kit's conflict resolver sets `DialCopiedItem.overwrite === true`, `onMoveToFiles` SHALL pass `overwrite: true` on the corresponding `MoveItemDto`; otherwise it SHALL pass `overwrite: false`. Same-folder rename DTOs keep the existing rename contract and do not add an overwrite field.

#### Scenario: Same-folder rename is unaffected

- **WHEN** `onMoveToFiles` is called with items whose source and destination share the same parent folder
- **THEN** `renameFiles` is called and `moveFiles` is not called; behavior matches this capability before the change

#### Scenario: Cross-folder move calls the new endpoint

- **WHEN** `onMoveToFiles` is called with items whose source and destination parent folders differ
- **THEN** `moveFiles` is called and `renameFiles` is not called for those items

#### Scenario: Single cross-folder move success toast names the moved destination

- **WHEN** `onMoveToFiles` is called with one cross-folder item and `moveFiles` returns one successful result
- **THEN** the success notification title is `dialFileManager.itemMovedSuccessfully`, and the message is produced from `dialFileManager.itemMovedToFolder` with the destination item name and destination folder

#### Scenario: Multiple cross-folder move success toast reports count

- **WHEN** `onMoveToFiles` is called with multiple cross-folder items and more than one move succeeds
- **THEN** the success notification title is `dialFileManager.itemsMovedSuccessfully`, and the message is produced from `dialFileManager.itemsMovedToFolder` with the successful moved item count and destination folder

#### Scenario: Mixed batch calls both endpoints

- **WHEN** `onMoveToFiles` is called with some items sharing their parent folder and others not
- **THEN** `renameFiles` is called for the same-folder subset and `moveFiles` is called for the cross-folder subset, and a single merged notification reports the combined failure count if any group has failures

#### Scenario: Conflict resolver overwrite is forwarded for cross-folder move

- **WHEN** `onMoveToFiles` is called with a cross-folder moved item containing `overwrite: true`
- **THEN** the corresponding `MoveItemDto` sent to `moveFiles` contains `overwrite: true`

---

### Requirement: Operation loader modal for copy/move with cancel

`DialFileManagerShell` SHALL render an `OperationLoaderModal` (new component at `apps/chat/src/components/DialFileManagerModal/OperationLoaderModal.tsx`) whenever `isCopying` or `isMoving` (cross-folder move only) is `true`. The modal SHALL display a title, a descriptive text, and a cancel action.

**Cancel semantics**: clicking cancel aborts the in-flight request from the browser via `AbortController` and immediately clears `isCopying`/`isMoving` and hides the modal. This SHALL NOT guarantee that DIAL Core stops processing already-dispatched `copyResource`/`moveResource` calls server-side (see design.md D7) — no error toast is shown for a user-initiated cancel.

**Accessibility**: the modal container SHALL use `aria-live="polite"` for the status text, matching the existing download/delete/rename overlay pattern in `DialFileManagerShell`. The cancel control SHALL be reachable via keyboard (native button, no custom tabindex handling needed).

**RTL**: the modal reuses ui-kit's `DialPopup`/`DialSpinner` layout and the existing i18n-driven text; no physical-direction Tailwind classes are introduced, so no RTL-specific handling is required beyond inheriting `dir` from `<html>`.

#### Scenario: Operation loader shown during copy

- **WHEN** `onCopyFiles` is in flight (`isCopying === true`)
- **THEN** `OperationLoaderModal` is rendered with copy-specific title/text and a cancel button

#### Scenario: Operation loader shown during cross-folder move

- **WHEN** the cross-folder-move branch of `onMoveToFiles` is in flight (`isMoving === true`)
- **THEN** `OperationLoaderModal` is rendered with move-specific title/text and a cancel button

#### Scenario: Cancel aborts the in-flight request

- **WHEN** the user clicks cancel while `OperationLoaderModal` is open
- **THEN** the underlying fetch is aborted, the modal closes, and `isCopying`/`isMoving` become `false` with no error notification shown

#### Scenario: Same-folder rename does not open the operation loader

- **WHEN** `onMoveToFiles` resolves entirely to the same-folder rename branch
- **THEN** `OperationLoaderModal` is not shown; the existing `isRenaming` spinner overlay is used instead

---

### Requirement: i18n keys for copy/move

The following keys SHALL be added to `apps/chat/src/i18n/locales/en.json` with matching members added to `DialFileManagerI18nKeys` in `apps/chat/src/constants/translation-keys.ts`:

| Key | English value (example) |
|-----|--------------------------|
| `dialFileManager.copyAction` | `Copy` |
| `dialFileManager.moveAction` | `Move` |
| `dialFileManager.copyingLabel` | `Copying...` |
| `dialFileManager.movingLabel` | `Moving...` |
| `dialFileManager.itemCopiedSuccessfully` | `Item copied successfully` |
| `dialFileManager.itemsCopiedSuccessfully` | `Items copied successfully` |
| `dialFileManager.itemMovedSuccessfully` | `Item moved successfully` |
| `dialFileManager.itemsMovedSuccessfully` | `Items moved successfully` |
| `dialFileManager.itemCopiedToFolder` | `“{{fileName}}” copied to {{folder}}` |
| `dialFileManager.itemsCopiedToFolder` | `{{count}} items copied to {{folder}}` |
| `dialFileManager.itemMovedToFolder` | `“{{fileName}}” moved to {{folder}}` |
| `dialFileManager.itemsMovedToFolder` | `{{count}} items moved to {{folder}}` |
| `dialFileManager.copyError` | `Failed to copy the selected items` |
| `dialFileManager.copyPartialError` | `{{count}} item(s) could not be copied` |
| `dialFileManager.moveError` | `Failed to move the selected items` |
| `dialFileManager.movePartialError` | `{{count}} item(s) could not be moved` |
| `dialFileManager.operationLoaderCopyTitle` | `Copying files` |
| `dialFileManager.operationLoaderMoveTitle` | `Moving files` |
| `dialFileManager.operationLoaderCancelLabel` | `Cancel` |

No raw string literal keys are passed to `t()` anywhere in this change — every key above is referenced through its `DialFileManagerI18nKeys` enum member.

#### Scenario: Copy error message uses i18n key

- **WHEN** a copy fully fails
- **THEN** the notification message is produced via `t(DialFileManagerI18nKeys.CopyError)`, not a hardcoded string

---

### Requirement: No feature-flag gating

Copy and cross-folder move SHALL NOT be gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` — consistent with the existing rename and delete capabilities, which ship unconditionally to all authenticated users with the relevant DIAL Core permissions.

#### Scenario: Copy is available without a feature flag

- **WHEN** a user with WRITE permission uses the file manager
- **THEN** `onCopyFiles` and the cross-folder-move branch of `onMoveToFiles` are available without checking any `ENABLED_FEATURES` entry
