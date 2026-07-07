# Tasks: add-file-manager-delete

## ~~Slice 1 — Backend: delete endpoint + tests~~ ✓ Done

**Goal**: `POST /api/v1/files/delete` is live and tested.

### ~~Task 1.1 — DTO~~ ✓

Create `apps/chat-api/src/files/dto/delete-files.dto.ts`:
- `DeleteItemNodeType` string enum (`Item = 'item'`, `Folder = 'folder'`)
- `DeleteItemDto` with `bucket`, `path`, `name`, `nodeType` fields — same validators as `ArchiveItemDto`
- `DeleteFilesDto` with `items: DeleteItemDto[]`, `@ArrayMinSize(1)`, `@ArrayMaxSize(100)`, `@ValidateNested({ each: true })`, `@Type(() => DeleteItemDto)`
- `DeleteItemResultDto` with `path`, `success`, optional `error`
- `DeleteFilesResponseDto` with `results: DeleteItemResultDto[]`
- All fields annotated with `@ApiProperty`

### ~~Task 1.2 — Service method~~ ✓

Add `deleteFiles(items: DeleteItemDto[], at: string): Promise<DeleteFilesResponseDto>` to `FilesService` (`apps/chat-api/src/files/files.service.ts`):
- For each item: call `this.client.deleteFile(bucket, relPath, { headers: getBearerAuthHeaders(at), signal: AbortSignal.timeout(this.getTimeoutMs()) })`
  - 404 response → `{ path, success: true }`
  - Other errors → `{ path, success: false, error: '...' }`
- For `folder` items: call `expandFolderContents` (already in service) then delete each file, then delete marker; aggregate into single result
- Collect all results; return `{ results }`
- Add structured `this.logger.log` calls at start and end (batch size, counts)

### ~~Task 1.3 — Controller~~ ✓

Add `deleteFiles` method to `FilesController` (`apps/chat-api/src/files/files.controller.ts`):
```typescript
@Post('delete')
@HttpCode(200)
@Throttle({ default: { limit: 10, ttl: 60000 } })
@ApiOperation({ summary: 'Delete files and folders' })
@ApiBody({ type: DeleteFilesDto })
@ApiResponse({ status: 200, type: DeleteFilesResponseDto })
@ApiResponse({ status: 400, description: 'Invalid request body' })
@ApiResponse({ status: 401, description: 'Not authenticated' })
@ApiResponse({ status: 429, description: 'Rate limit exceeded' })
@ApiResponse({ status: 502, description: 'DIAL Core returned an error' })
@ApiResponse({ status: 503, description: 'DIAL Core unreachable or timed out' })
async deleteFiles(@Body() body: DeleteFilesDto, @Req() req: Request): Promise<DeleteFilesResponseDto>
```

### ~~Task 1.4 — Controller tests~~ ✓

Add to `apps/chat-api/src/files/tests/files.controller.spec.ts`:
- `POST /api/v1/files/delete` → 200 with mocked `FilesService.deleteFiles` returning a results array
- `POST /api/v1/files/delete` with missing `items` → 400
- `POST /api/v1/files/delete` without session → 401

### ~~Task 1.5 — Service unit tests~~ ✓

Add to `apps/chat-api/src/files/tests/files.service.spec.ts`:
- `deleteFiles` — single file success (2xx from SDK)
- `deleteFiles` — file already gone (SDK 404) → `success: true`
- `deleteFiles` — SDK 403 → `success: false, error: 'Forbidden'`
- `deleteFiles` — folder node: `expandFolderContents` called, children deleted, marker deleted
- `deleteFiles` — folder with missing marker (404) → still `success: true`
- `deleteFiles` — partial batch: independent results per item

**Verify slice 1**:
```bash
npm exec nx test chat-api
npm exec nx lint chat-api
npm exec nx build chat-api
```

---

## ~~Slice 2 — OpenAPI client regeneration + server-api wrapper~~ ✓ Done

**Goal**: `filesApi.deleteFiles(...)` is available to the frontend.

### ~~Task 2.1 — Swagger → openapi.json~~ ✓

Verify `apps/chat-api/src/files/dto/delete-files.dto.ts` is fully annotated with `@ApiProperty`. Run:
```bash
npm run openapi
npm run openapi:check
```

Confirm `libs/chat-api-client/openapi.json` includes the new `POST /api/v1/files/delete` path with `DeleteFilesDto` and `DeleteFilesResponseDto`.

### ~~Task 2.2 — Build and lint the generated client~~ ✓

```bash
npm exec nx build chat-api-client
npm exec nx lint chat-api-client
```

### ~~Task 2.3 — server-api wrapper~~ ✓

Add to `apps/chat/src/server-api/files.api.ts`:
```typescript
export const deleteFiles = (
  items: DeleteItemDto[],
): Promise<DeleteFilesResponseDto> =>
  filesApi.deleteFiles({ deleteFilesDto: { items } });
```

Import `DeleteItemDto` and `DeleteFilesResponseDto` from `@epam/chat-api-client`.

**Verify slice 2**:
```bash
npm exec nx lint chat
npm exec nx typecheck chat
```

---

## Slice 3 — useDialFileManager: onDeleteFiles + state

**Goal**: Hook exposes working `onDeleteFiles` with cache invalidation and navigation.

### Task 3.1 — Interface additions

Extend `UseDialFileManagerResult` in `apps/chat/src/hooks/files/useDialFileManager.ts`:
```typescript
onDeleteFiles: (items: DialDeletedItem[], sourceFolder: string) => void;
isDeleting: boolean;
deleteError: string | null;
clearDeleteError: () => void;
```

### Task 3.2 — State and implementation

In `useDialFileManager`:
- Add `const [isDeleting, setIsDeleting] = useState(false)`
- Add `const [deleteError, setDeleteError] = useState<string | null>(null)`
- Implement `onDeleteFiles` as a `useCallback` with deps `[bucket, rootLabel, t, listingPermissionsCache]`:
  1. Map `DialDeletedItem[]` → `DeleteItemDto[]`:
     - `path = virtualPathToApiPath(item.sourceUrl, rootLabel)` — sourceUrl is the virtual path (e.g. `/All files/file.pdf`), NOT a DIAL URL; reuse the existing helper
     - `name = item.sourceUrl.split('/').filter(Boolean).pop() ?? ''`
     - `nodeType`: `DialFileNodeType.ITEM → 'item'`, `FOLDER → 'folder'`
  2. Call `deleteFiles(dtos)` from `server-api/files.api`
  3. Count `results.filter(r => !r.success).length`
  4. Set `deleteError` based on count (0 = no error, some = partial, all = total)
  5. Compute `affectedFolderKeys` (parent paths of all items)
  6. `setCache(prev => { const next = new Map(prev); affectedFolderKeys.forEach(k => next.delete(k)); return next; })`
  7. Same for `setListingPermissionsCache`
  8. Detect if `folderPath` equals or starts with a deleted folder path → `setFolderPath(parentApiPath)`
  9. `setRetryCounter(c => c + 1)`
- Implement `clearDeleteError = useCallback(() => setDeleteError(null), [])`
- Return new fields from the hook

### Task 3.3 — Hook tests

Add to `apps/chat/src/hooks/files/tests/useDialFileManager.spec.tsx`:
- `onDeleteFiles` success: `isDeleting` transitions false→true→false; cache key removed; `retryCounter` bumped
- `onDeleteFiles` partial failure: `deleteError` = partial message, `success: true` items still processed
- `onDeleteFiles` total failure: `deleteError` = total-failure message
- `onDeleteFiles` deletes current folder: `folderPath` navigates to parent
- `clearDeleteError`: sets `deleteError` to null

**Verify slice 3**:
```bash
npm exec nx test chat
npm exec nx lint chat
npm exec nx typecheck chat
```

---

## Slice 4 — DialFileManagerModal wiring

**Goal**: Delete action visible in grid/tree/bulk toolbar; confirmation popup works; loading and error UX match download pattern.

### Task 4.1 — New props

Add to `Props` interface in `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`:
```typescript
deleteLabel: string;
deletingLabel: string;
deleteConfirmTitle: (names: string[]) => ReactNode;
deleteConfirmBody: (names: string[]) => ReactNode;
deleteConfirmLabel: string;
deleteCancelLabel: string;
```

### Task 4.2 — Hook destructuring

Destructure from `useDialFileManager`:
```typescript
const { ..., onDeleteFiles, isDeleting, deleteError, clearDeleteError } = useDialFileManager({ bucket });
```

### Task 4.3 — isOperationInProgress

```typescript
const isOperationInProgress =
  isDownloading || isDeleting || isCreatingFolder || uploadBatchState != null;
```

### Task 4.4 — deleteConfirmationOptions memo

```typescript
const deleteConfirmationOptions = useMemo(
  () => ({
    cancelLabel: deleteCancelLabel,
    confirmLabel: deleteConfirmLabel,
    titleRenderer: deleteConfirmTitle,
    contentRenderer: deleteConfirmBody,
  }),
  [deleteCancelLabel, deleteConfirmLabel, deleteConfirmTitle, deleteConfirmBody],
);
```

### Task 4.5 — Action labels in gridOptions, treeOptions, bulkActionsToolbarOptions

Add `[DialFileManagerActions.Delete]: deleteLabel` to each `actionLabels` object and its `useMemo` dependency array.

### Task 4.6 — DialFileManager props

Pass `onDeleteFiles={onDeleteFiles}` and `deleteConfirmationOptions={deleteConfirmationOptions}` to `<DialFileManager>`.

### Task 4.7 — Loading overlay and error banner

Inside the `<div className="relative ...">` wrapper, after the existing download overlay and banner, add the delete overlay and banner (mirror exact class structure from download).

### Task 4.8 — Call-site updates (ConversationView and ConversationRoute)

In `apps/chat/src/components/ConversationView/ConversationView.tsx` and `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`, add the six new props to `<DialFileManagerModal>` using `t()` from `useTranslation`. Follow the pattern of `downloadLabel`, `downloadingLabel`.

### Task 4.9 — Modal tests

Add to `apps/chat/src/components/DialFileManagerModal/tests/DialFileManagerModal.spec.tsx`:
- "Delete" appears in grid options when `deleteLabel` is provided (query rendered action label)
- Loading overlay renders when `isDeleting` is true (mock `useDialFileManager`)
- Error banner renders when `deleteError` is non-null; click dismisses it
- Attach button is disabled when `isDeleting` is true

**Verify slice 4**:
```bash
npm exec nx test chat
npm exec nx lint chat
npm exec nx typecheck chat
```

---

## Slice 5 — i18n + RTL

**Goal**: All delete strings are in `en.json`; no physical-direction classes introduced.

### Task 5.1 — en.json keys

Add to `apps/chat/src/i18n/locales/en.json` under `dialFileManager`:
```json
{
  "dialFileManager": {
    "deleteAction": "Delete",
    "deletingLabel": "Deleting…",
    "deleteConfirmTitleSingle": "Confirm deleting",
    "deleteConfirmTitleMultiple": "Confirm deleting items",
    "deleteConfirmBodySingle": "Are you sure you want to delete",
    "deleteConfirmBodyMultiple": "Do you want to delete following",
    "deleteConfirmBodyItems": "items?",
    "deleteConfirmButton": "Delete",
    "deleteError": "Delete failed. Please try again.",
    "deletePartialError": "{{count}} item(s) could not be deleted."
  }
}
```

### Task 5.2 — RTL audit

Review all new Tailwind classes in `DialFileManagerModal.tsx` and `useDialFileManager.ts`:
- Confirm no new `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`, `text-left`, `text-right`, `border-l-*`, `border-r-*` classes
- The delete overlay and error banner reuse the exact class strings from the download counterparts (verified symmetric or logical)
- No new directional icons

**Verify slice 5**:
```bash
npm exec nx test chat
npm exec nx lint chat
npm exec nx typecheck chat
```

---

## Slice 6 — dial-file-system-picker spec sync

**Goal**: Existing spec reflects that delete is now wired.

### Task 6.1 — Sync note

Prepend to `openspec/specs/dial-file-system-picker/spec.md`:
```markdown
> **Sync note (add-file-manager-delete):** `DialFileManagerModal` now accepts
> `onDeleteFiles` and `deleteConfirmationOptions` wired from `useDialFileManager`.
> The spec previously noted delete was absent; that gap is closed when this change ships.
```

---

## Final verification

```bash
npm exec nx affected --target=lint --base=origin/development-1.0
npm exec nx affected --target=typecheck --base=origin/development-1.0
npm exec nx affected --target=test --base=origin/development-1.0
npm exec nx affected --target=build --base=origin/development-1.0
```

---

## Architecture guard (libs)

No `libs/*` are modified by this change. The delete capability lives entirely within:
- `apps/chat-api/src/files/` (BFF endpoint)
- `apps/chat/src/server-api/files.api.ts` (thin wrapper)
- `apps/chat/src/hooks/files/useDialFileManager.ts` (state management)
- `apps/chat/src/components/DialFileManagerModal/` (UI wiring)

Verify that none of the modified files import from `apps/chat-api/**`, `@epam/chat-api-client` (except `files.api.ts`), or introduce routing/navigation/env knowledge into any `libs/*` file.
