# Design: add-file-manager-delete

## 1. Backend API Contract

### Why POST, not DELETE

`DELETE /api/v1/files` with a JSON body is rejected by some HTTP proxies and is not supported by all NestJS body-parsing middleware configurations out of the box. The project already established `POST /api/v1/files/download-archive` as the canonical pattern for multi-item file operations — this change follows the same convention.

### Endpoint

```
POST /api/v1/files/delete
```

**Auth**: session cookie → BFF extracts `req.user.at` (bearer token forwarded to DIAL Core), same as all other files endpoints.

**Rate limit**: `@Throttle({ default: { limit: 10, ttl: 60000 } })` — 10 requests per minute per user. More permissive than archive (5/60s) since delete payloads are lightweight, but tighter than list (60/60s) because each item triggers at least one upstream DELETE call.

**Request body** (`DeleteFilesDto`):
```typescript
class DeleteItemDto {
  bucket: string;   // @Matches(/^[\w.-]+$/), @MaxLength(256)
  path: string;     // @IsValidFilePath(), @MaxLength(1024)
  name: string;     // @MaxLength(255)
  nodeType: DeleteItemNodeType; // 'item' | 'folder'
}

class DeleteFilesDto {
  items: DeleteItemDto[]; // @ArrayMinSize(1) @ArrayMaxSize(100)
}
```

`DeleteItemNodeType` is a string enum mirroring `ArchiveItemNodeType` so the frontend can reuse the same DTO shape it already builds for download-archive.

**Response** (`DeleteFilesResponseDto`):
```typescript
class DeleteItemResultDto {
  path: string;
  success: boolean;
  error?: string;  // human-readable reason on failure (e.g. "Not found", "Forbidden")
}

class DeleteFilesResponseDto {
  results: DeleteItemResultDto[];
}
```

HTTP status: always `200` when the endpoint itself runs; individual item failures are reflected in `results[].success`. A `400` (validation) or `401`/`429`/`502`/`503` may still be returned for global failures.

### Partial-failure semantics

Best-effort: the service deletes every item independently and collects results. If item 2 of 5 returns 403 from DIAL Core, items 1, 3, 4, 5 are still attempted. The frontend receives the result array, counts failures, and surfaces an error notification listing failed item names.

This matches the legacy Redux `FilesActions.deleteFiles` behavior (fire-and-forget per item, refresh after).

### Folder delete strategy

The DIAL Core SDK (`@epam/ai-dial-typescript-sdk`) exposes only `deleteFile(bucket, path, init)` — there is no bulk or recursive folder-delete operation. Folders in DIAL are virtual: they exist as long as at least one file under their prefix exists, plus an optional `.dial_folder` marker file.

**Strategy (recursive expand + per-item delete):**

1. Call `this.client.getFileMetadata(bucket, folderRelPath, { params: { query: { recursive: true, limit: 1000 } } })` to list all items under the folder prefix, paginating via `nextToken`.
2. Delete each `item` (non-folder) entry via `this.client.deleteFile(bucket, itemRelPath)`.
3. After all children are deleted, attempt to delete the `.dial_folder` marker (`${folderRelPath}.dial_folder`) via a best-effort `deleteFile` call; a 404 on the marker is silently ignored.

**Why not delete the folder prefix directly**: DIAL Core does not expose a recursive delete endpoint. Sending `DELETE files/{bucket}/folder/` returns 404 or is a no-op depending on the deployment.

**Hidden marker (`.dial_folder`)**: The marker is a regular file from DIAL Core's perspective. It IS deleted as part of step 2 (it appears in the recursive listing) or step 3 (explicit cleanup). It is never protected from deletion — it must be removed so the folder disappears from the listing.

**Concurrency**: folder expansion uses the same `expandFolderContents` method already present in `FilesService` (used by download-archive). Individual `deleteFile` calls are made sequentially within a folder to avoid overloading DIAL Core; a configurable concurrency constant (`DELETE_CONCURRENCY = 4`) can be added via `EnvironmentVariables`.

### Error mapping

All upstream errors pass through `handleDialError` (existing utility), which maps:
- 401 → `UnauthorizedException`
- 403 → `ForbiddenException`
- 404 → `NotFoundException`
- 5xx → `BadGatewayException` / `ServiceUnavailableException`

Per-item 404 during delete = treat as success (item already gone).
Per-item 403 = record as failure with `error: "Forbidden"`.

### Swagger annotations

Full `@ApiOperation`, `@ApiResponse` decorators following the pattern in `files.controller.ts`. `DeleteFilesDto` and `DeleteFilesResponseDto` added with `@ApiProperty` on every field. The operationId will be `filesControllerDeleteFiles` (NestJS auto-generated from method name `deleteFiles`).

---

## 2. OpenAPI Client

After adding the endpoint and running `npm run openapi`:
- `libs/chat-api-client/openapi.json` gains the new path.
- Generated `filesApi.deleteFiles({ deleteFilesDto })` method appears in the client.
- Frontend calls it via `apps/chat/src/server-api/files.api.ts`:

```typescript
export const deleteFiles = (
  items: DeleteItemDto[],
): Promise<DeleteFilesResponseDto> =>
  filesApi.deleteFiles({ deleteFilesDto: { items } });
```

No `Raw` variant needed — the response is JSON, not a stream.

---

## 3. Frontend Data Flow

```
DialFileManagerModal
  └─ useDialFileManager({ bucket })
       ├─ onDeleteFiles(items: DialDeletedItem[], sourceFolder: string)
       │    ├─ setIsDeleting(true)
       │    ├─ map DialDeletedItem[] → DeleteItemDto[] (sourceUrl → path+bucket, nodeType)
       │    ├─ deleteFiles(dtos)          ← files.api.ts
       │    ├─ on partial failure → setDeleteError(t('dialFileManager.deletePartialError', { count }))
       │    ├─ on total failure → setDeleteError(t('dialFileManager.deleteError'))
       │    ├─ invalidate cache for affected folder paths
       │    ├─ navigate to parent if current folder deleted
       │    └─ setIsDeleting(false)
       ├─ isDeleting: boolean
       ├─ deleteError: string | null
       └─ clearDeleteError: () => void
```

### DialDeletedItem → DeleteItemDto mapping

`DialDeletedItem.sourceUrl` is the **virtual path** stored in `DialFile.path` — e.g. `/All files/reports/q1.pdf` or `/All files/reports/`. It is NOT a DIAL resource URL. Convert it to an API-relative path using the existing `virtualPathToApiPath` helper already defined in the hook:

```typescript
const relPath = virtualPathToApiPath(item.sourceUrl, rootLabel);
// "/All files/Screenshot.png"  →  "Screenshot.png"
// "/All files/reports/"        →  "reports/"
```

`name` is the last non-empty segment of the virtual path:
```typescript
const name = item.sourceUrl.split('/').filter(Boolean).pop() ?? '';
```

`bucket` comes from the hook's own `bucket` prop.

### Cache invalidation

After delete completes (even partial), the hook invalidates all cache entries whose key is a prefix of, or equal to, any deleted item's folder path. Concretely:

- For each deleted item, compute its parent folder path (API path key).
- Remove those keys from the `cache` Map and `listingPermissionsCache` Map.
- Increment `retryCounter` to trigger a re-fetch of the current folder.

```typescript
setCache((prev) => {
  const next = new Map(prev);
  for (const affectedPath of affectedFolderPaths) {
    next.delete(affectedPath);
  }
  return next;
});
setRetryCounter((c) => c + 1);
```

### Navigation on current-folder deletion

After cache invalidation, check whether the current `folderPath` is one of the deleted paths (or a descendant). If so, call `onPathChange` with the parent virtual path:

```typescript
const currentApiPath = folderPath; // '' for root, 'reports/' for subfolder
const isCurrentFolderDeleted = deletedApiPaths.some(
  (p) => currentApiPath === p || currentApiPath.startsWith(p),
);
if (isCurrentFolderDeleted) {
  const parentApiPath = currentApiPath.replace(/[^/]+\/$/, '');
  setFolderPath(parentApiPath);
}
```

### Permission gating

Delete requires WRITE on the items' parent folder. The hook exposes `canWriteCurrentFolder` (already computed). The ui-kit `onDeleteFiles` callback is only invoked by the ui-kit when the user explicitly triggers delete — there is no additional disable prop; instead, the `DialFileManagerActions.Delete` label is simply not included in `actionLabels` when `!canWriteCurrentFolder`, which causes the action to be absent from the menu.

**Bulk mixed-selection**: If the selection includes items from folders with mixed permissions (some WRITE, some not), the delete action is shown based on `canWriteCurrentFolder` (current browsed folder). Items in sub-selections from read-only folders will produce 403 from DIAL Core, which is captured as a partial failure. This aligns with legacy behavior (attempt all, surface failures).

---

## 4. Modal Wiring

### New props added to `DialFileManagerModal`

```typescript
interface Props {
  // ... existing props ...
  deleteLabel: string;
  deleteConfirmTitle: (names: string[]) => ReactNode;
  deleteConfirmBody: (names: string[]) => ReactNode;
  deleteConfirmLabel: string;
  deleteCancelLabel: string;
}
```

All deletion-copy props are passed in from the call site (`ConversationView`, `ConversationRoute`) so the modal stays free of `useTranslation` for these strings, respecting the lib-boundary pattern established by `downloadLabel` / `downloadingLabel`.

### Updated useMemo blocks

```typescript
const gridOptions = useMemo(() => ({
  // ... existing ...
  actionLabels: {
    [DialFileManagerActions.Download]: downloadLabel,
    [DialFileManagerActions.Delete]: deleteLabel,
  },
}), [downloadLabel, deleteLabel, ...]);

const treeOptions = useMemo(() => ({
  actionLabels: {
    [DialFileManagerActions.Download]: downloadLabel,
    [DialFileManagerActions.Delete]: deleteLabel,
  },
}), [downloadLabel, deleteLabel]);

const bulkActionsToolbarOptions = useMemo(() => ({
  getSelectionLabel,
  actionLabels: {
    [DialFileManagerActions.Download]: downloadLabel,
    [DialFileManagerActions.Delete]: deleteLabel,
  },
}), [getSelectionLabel, downloadLabel, deleteLabel]);
```

### deleteConfirmationOptions

```typescript
const deleteConfirmationOptions = useMemo(() => ({
  cancelLabel: deleteCancelLabel,
  confirmLabel: deleteConfirmLabel,
  titleRenderer: deleteConfirmTitle,
  contentRenderer: deleteConfirmBody,
}), [deleteCancelLabel, deleteConfirmLabel, deleteConfirmTitle, deleteConfirmBody]);
```

### Loading overlay and error banner

Mirror the download overlay pattern exactly:

```tsx
{isDeleting && (
  <div
    aria-live="polite"
    className="absolute inset-0 z-[52] flex items-center justify-center bg-blackout md:p-4"
  >
    <DialSpinner size={32} fullWidth={false} ariaLabel={deletingLabel} />
  </div>
)}
{deleteError != null && !isDeleting && (
  <button
    type="button"
    role="alert"
    className="absolute inset-x-4 bottom-4 z-10 rounded bg-error px-4 py-3 text-start text-sm text-primary shadow"
    onClick={clearDeleteError}
  >
    {deleteError}
  </button>
)}
```

`isOperationInProgress` is extended to include `isDeleting`.

---

## 5. i18n Key Table

Confirmation body mirrors the legacy pattern: title has no filename (simpler, avoids truncation issues); body shows the filename extracted from `sourceUrl` via `.split('/').pop()`.

| Key | English default |
|-----|-----------------|
| `dialFileManager.deleteAction` | `"Delete"` |
| `dialFileManager.deletingLabel` | `"Deleting…"` |
| `dialFileManager.deleteConfirmTitleSingle` | `"Confirm deleting"` |
| `dialFileManager.deleteConfirmTitleMultiple` | `"Confirm deleting items"` |
| `dialFileManager.deleteConfirmBodySingle` | `"Are you sure you want to delete"` |
| `dialFileManager.deleteConfirmBodyMultiple` | `"Do you want to delete following"` |
| `dialFileManager.deleteConfirmBodyItems` | `"items?"` |
| `dialFileManager.deleteConfirmButton` | `"Delete"` |
| `dialFileManager.deleteError` | `"Delete failed. Please try again."` |
| `dialFileManager.deletePartialError` | `"{{count}} item(s) could not be deleted."` |

`buttons.cancel` (already exists) is reused for the confirmation cancel label.

> **`names[]` in renderers**: the ui-kit passes `DialDeletedItem.sourceUrl` values to `titleRenderer`/`contentRenderer`. The call-site extracts display names via `.split('/').pop()` in the body renderer, matching the legacy `renderDeleteConfirmationContent` pattern.

## 5a. No-tabs decision

The legacy `useFileManager` used a tab-based `useFileManagerActionLabels` hook that restricted Delete to the `my_files` tab only (not `shared` / `organization` / `review`). The new `DialFileManagerModal` has no tabs — it browses only the user's own bucket. Delete is therefore always available when the current folder grants WRITE permission. This is intentional simplification, not a regression.

---

## 6. RTL

- All new UI elements (overlay, error banner) use `inset-x-4` (already direction-agnostic, symmetric).
- Error banner uses `text-start` (already present on the download error banner; reuse the same class).
- No new directional icons introduced.
- No new physical-direction Tailwind classes.

---

## 7. Accessibility

- Loading overlay: `aria-live="polite"` (same as download).
- Error banner: `role="alert"` (same as download).
- `deleteConfirmationOptions` renders inside the ui-kit's confirmation popup which handles focus trapping and keyboard dismissal.

---

## 8. Observability

No new metrics or analytics are required beyond what DIAL Core audit logs already record for deleted files. The `FilesService` `logger.log` calls (following the pattern in `downloadArchive`) will emit structured log lines for each batch delete invocation.

---

## 9. Feature Flag

Not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`. Delete is a core file-management operation consistent with upload and download, which are also not gated.

---

## 10. NestJS Conventions Reference

All backend implementation details (URI versioning, thin controllers + Swagger, Logger + ConfigService, validated DTOs with allowlist `@Matches`, typed HTTP exceptions, env on `EnvironmentVariables`) follow `apps/chat-api/AGENTS.md` as the source of truth.
