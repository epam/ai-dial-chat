# Spec: file-manager-delete-ui

## Requirement: useDialFileManager — delete capability

`useDialFileManager` in `apps/chat/src/hooks/files/useDialFileManager.ts` SHALL expose `onDeleteFiles` and `isDeleting`, and SHALL surface delete results through the `onNotification` option passed by `DialFileManagerModal`.

### State ownership

Delete loading state is owned by `useDialFileManager`. Toast rendering is owned by `DialFileManagerModal` through the app-level `useNotification` context. No new React Context is introduced.

### Interface additions

```typescript
export interface UseDialFileManagerResult {
  // ... existing fields ...

  /** Delete: called by DialFileManager when the user confirms deletion. */
  onDeleteFiles: (items: DialDeletedItem[], sourceFolder: string) => void;
  /** True while a delete request is in flight. */
  isDeleting: boolean;
}
```

`UseDialFileManagerOptions` includes:

```typescript
onNotification?: (notification: {
  variant: NotificationVariant;
  title?: string;
  message: string;
}) => void;
```

### `onDeleteFiles` implementation

`DialDeletedItem.sourceUrl` is the **virtual path** set on `DialFile.path` (e.g. `/All files/reports/q1.pdf`), NOT a DIAL resource URL. Convert it to an API-relative path using the existing `virtualPathToApiPath(sourceUrl, rootLabel)` helper already defined in the hook.

```
1. setIsDeleting(true)
2. Map each DialDeletedItem to DeleteItemDto:
   - relPath = virtualPathToApiPath(item.sourceUrl, rootLabel)
     e.g. "/All files/Screenshot.png" → "Screenshot.png"
          "/All files/reports/"       → "reports/"
   - nodeType: DialFileNodeType.ITEM → 'item', FOLDER → 'folder'
   - name: last non-empty segment of item.sourceUrl split by '/'
3. Call deleteFiles(dtos)  [from apps/chat/src/server-api/files.api.ts]
4. Count failures (results.filter(r => !r.success))
5. Show a success toast for successful deletions using legacy copy:
   - one item → `dialFileManager.itemDeletedSuccessfully` + `dialFileManager.itemDeletedFromFolder`
   - multiple items → `dialFileManager.itemsDeletedSuccessfully` + `dialFileManager.itemsDeletedFromFolder`
6. Show an error toast for failed deletions using `dialFileManager.itemsDeletingFailed` + `dialFileManager.someItemsNotDeleted`; use `dialFileManager.deleteFilesError` when the whole request throws
7. Invalidate cache: remove from cache Map all entries whose key is a parent of any deleted path
8. Navigate: if currentFolderPath is, or is a descendant of, any deleted folder → setFolderPath(parentApiPath)
9. setRetryCounter(c => c + 1)  ← triggers re-fetch of current folder
10. setIsDeleting(false)
```

### Cache invalidation detail

For each deleted item, compute its API folder key (parent path):
- `item` node: parent = everything up to the last `/` in `relPath` (e.g. `reports/` for `reports/q1.pdf`)
- `folder` node: the folder path itself (e.g. `old-data/`)

Remove those keys from both `cache` and `listingPermissionsCache`.

### Navigation on current-folder deletion

Check whether `folderPath` (current) equals or starts with any deleted folder's API path. If so, navigate to the nearest non-deleted ancestor:

```typescript
const parentApiPath = folderPath.replace(/[^/]+\/$/, '');
setFolderPath(parentApiPath);
```

If `folderPath` is root (`''`), no navigation needed — root cannot be deleted.

### Permission gating

`DialFileManagerActions.Delete` is included in `actionLabels` only when the current folder has WRITE permission (`canWriteCurrentFolder`). This hides the delete action for read-only folders without a separate disable prop.

Bulk mixed-selection: the delete action visibility is governed by the current browsed folder's WRITE permission. Items in sub-folders with stricter permissions produce per-item 403s, captured as partial failures.

### i18n keys (hook-level)

| Key | Usage |
|-----|-------|
| `dialFileManager.deleteFilesError` | Request failure toast message |
| `dialFileManager.itemDeletedSuccessfully` | Single-item success toast title |
| `dialFileManager.itemsDeletedSuccessfully` | Multi-item success toast title |
| `dialFileManager.itemsDeletingFailed` | Failure toast title |
| `dialFileManager.itemDeletedFromFolder` | Single-item success toast message |
| `dialFileManager.itemsDeletedFromFolder` | Multi-item success toast message |
| `dialFileManager.someItemsNotDeleted` | Failure toast message |
| `dialFileManager.andOtherItems` | Hidden failed-items suffix |

---

## Requirement: DialFileManagerModal — delete wiring

`DialFileManagerModal` in `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx` SHALL wire delete into the `DialFileManager` component and expose new props for i18n copy.

### New Props

```typescript
interface Props {
  // ... existing ...
  deleteLabel: string;
  deletingLabel: string;
  deleteConfirmTitle: (names: string[]) => ReactNode;
  deleteConfirmBody: (names: string[]) => ReactNode;
  deleteConfirmLabel: string;
  deleteCancelLabel: string;
}
```

All copy is passed from call sites (`ConversationView` / `ConversationRoute`) using `useTranslation` at the app layer. The modal itself does NOT call `useTranslation` for delete strings.

### Hook consumption

```typescript
const {
  // ... existing ...
  onDeleteFiles,
  isDeleting,
} = useDialFileManager({ bucket, onNotification: showNotification });
```

### isOperationInProgress update

```typescript
const isOperationInProgress =
  isDownloading || isDeleting || isCreatingFolder || uploadBatchState != null;
```

### deleteConfirmationOptions (memoized)

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

### gridOptions — delete action label

```typescript
actionLabels: {
  [DialFileManagerActions.Download]: downloadLabel,
  [DialFileManagerActions.Delete]: deleteLabel,
},
```

`deleteLabel` added to the `useMemo` dependency array.

### treeOptions — delete action label

```typescript
actionLabels: {
  [DialFileManagerActions.Download]: downloadLabel,
  [DialFileManagerActions.Delete]: deleteLabel,
},
```

### bulkActionsToolbarOptions — delete action label

```typescript
actionLabels: {
  [DialFileManagerActions.Download]: downloadLabel,
  [DialFileManagerActions.Delete]: deleteLabel,
},
```

### DialFileManager props

```tsx
<DialFileManager
  // ... existing props ...
  onDeleteFiles={onDeleteFiles}
  deleteConfirmationOptions={deleteConfirmationOptions}
/>
```

### Loading overlay (delete)

Inside the `<div className="relative ...">` that wraps `DialFileManager`:

```tsx
{isDeleting && (
  <div
    aria-live="polite"
    className="absolute inset-0 z-[52] flex items-center justify-center bg-blackout md:p-4"
  >
    <DialSpinner size={32} fullWidth={false} ariaLabel={deletingLabel} />
  </div>
)}
```

### Toast feedback (delete)

`DialFileManagerModal` calls `useNotification()` and passes `showNotification` into `useDialFileManager({ bucket, onNotification: showNotification })`. Delete success and failure feedback is rendered by the global `NotificationContainer`, not as an inline banner inside the modal.

### Call sites: new prop values

In `ConversationView` and `ConversationRoute`, add the delete props using `useTranslation`:

```tsx
<DialFileManagerModal
  // ... existing ...
  deleteLabel={t('dialFileManager.deleteAction')}
  deletingLabel={t('dialFileManager.deletingLabel')}
  deleteConfirmTitle={(names) =>
    names.length === 1
      ? t('dialFileManager.deleteConfirmTitleSingle')
      : t('dialFileManager.deleteConfirmTitleMultiple')
  }
  deleteConfirmBody={(names) => (
    <div className="px-6 py-3 text-sm">
      <p className="mb-3 text-secondary">
        {names.length === 1 ? (
          <>
            {t('dialFileManager.deleteConfirmBodySingle')}{' '}
            <span className="break-all text-primary">
              &quot;{names[0].split('/').pop()}&quot;?
            </span>
          </>
        ) : (
          <>
            {t('dialFileManager.deleteConfirmBodyMultiple')}{' '}
            <span className="text-primary">
              {names.length} {t('dialFileManager.deleteConfirmBodyItems')}
            </span>
          </>
        )}
      </p>
    </div>
  )}
  deleteConfirmLabel={t('dialFileManager.deleteConfirmButton')}
  deleteCancelLabel={t('buttons.cancel')}
/>
```

> **Note on `names[]`**: the ui-kit passes `DialDeletedItem.sourceUrl` values as the `names` array to both `titleRenderer` and `contentRenderer`. Each entry is a DIAL resource URL (`files/{bucket}/path/file.pdf`). Use `.split('/').pop()` to extract the display filename for the single-item case, matching the legacy behavior.

---

## Requirement: i18n keys

New keys added to `apps/chat/src/i18n/locales/en.json` under `dialFileManager`:

| Key (full) | English value | Notes |
|------------|---------------|-------|
| `dialFileManager.deleteAction` | `"Delete"` | Action label in menus |
| `dialFileManager.deletingLabel` | `"Deleting…"` | Loading overlay aria-label |
| `dialFileManager.deleteConfirmTitleSingle` | `"Confirm deleting"` | Popup title, single item — no filename (legacy parity) |
| `dialFileManager.deleteConfirmTitleMultiple` | `"Confirm deleting items"` | Popup title, multiple items |
| `dialFileManager.deleteConfirmBodySingle` | `"Are you sure you want to delete"` | Precedes filename `"filename"?` in body |
| `dialFileManager.deleteConfirmBodyMultiple` | `"Do you want to delete following"` | Precedes count span in body |
| `dialFileManager.deleteConfirmBodyItems` | `"items?"` | Appended after count in multi-item body |
| `dialFileManager.deleteConfirmButton` | `"Delete"` | Confirm button |
| `dialFileManager.deleteFilesError` | `"Failed to delete files. Please try again later."` | Request failure toast message |
| `dialFileManager.itemDeletedSuccessfully` | `"Item deleted successfully"` | Single-item success toast title |
| `dialFileManager.itemsDeletedSuccessfully` | `"Items deleted successfully"` | Multi-item success toast title |
| `dialFileManager.itemsDeletingFailed` | `"Items deleting failed"` | Failure toast title |
| `dialFileManager.itemDeletedFromFolder` | `"“{{fileName}}” deleted from {{folder}}"` | Single-item success toast message |
| `dialFileManager.itemsDeletedFromFolder` | `"{{count}} items deleted from {{folder}}"` | Multi-item success toast message |
| `dialFileManager.someItemsNotDeleted` | `"{{files}}{{rest}} were not deleted. Please try again."` | Failed-items toast message |
| `dialFileManager.andOtherItems` | `" and {{count}} other items"` | Failed-items overflow suffix |

`buttons.cancel` already exists and is reused.

---

## Requirement: RTL

- No new physical-direction Tailwind classes. All classes follow the logical pattern or are symmetric.
- Toast placement is handled by `NotificationContainer`, which uses logical positioning (`start-1/2`).
- `aria-live`, `role="alert"`, `z-*`, `bg-*` — direction-agnostic.
- No new directional icons.

---

## Requirement: Accessibility

- Delete loading overlay: `aria-live="polite"` — announces to screen readers that an operation is in progress.
- Delete result toasts are rendered through `NotificationContainer` / `Notification`.
- Confirmation popup: handled by `DialFileManager` / ui-kit (focus trap, keyboard Escape = cancel, Enter = confirm).
- Delete action items in grid/tree context menus: rendered by ui-kit; keyboard-accessible via existing grid/tree keyboard navigation.

---

## Requirement: Memoisation

- `deleteConfirmationOptions` wrapped in `useMemo` with all four copy props as deps.
- `gridOptions`, `treeOptions`, `bulkActionsToolbarOptions` already use `useMemo`; `deleteLabel` added to each dependency array.
- `onDeleteFiles` inside `useDialFileManager` is wrapped in `useCallback` with `[bucket, rootLabel, t]` deps (same pattern as `onDownloadFiles`).

---

## Requirement: dial-file-system-picker spec sync

`openspec/specs/dial-file-system-picker/spec.md` SHALL be updated with a sync note at the top:

```markdown
> **Sync note (add-file-manager-delete):** `DialFileManagerModal` now accepts
> `onDeleteFiles` and `deleteConfirmationOptions` wired from `useDialFileManager`.
> The spec previously noted delete was absent; that is no longer the case when
> this change ships.
```

No requirement-level behavior in `dial-file-system-picker` changes.

---

## Scenarios

### Scenario: Delete single file from grid row context menu

- **GIVEN** user is browsing a folder with WRITE permission
- **WHEN** user right-clicks a file → selects "Delete" → confirms in the popup
- **THEN** `onDeleteFiles` is called with one `DialDeletedItem`; a loading overlay appears; on completion the file is gone from the listing

### Scenario: Bulk delete 3 items

- **GIVEN** user selects 3 items in the grid (files and/or folders)
- **WHEN** user clicks "Delete" in the bulk toolbar → confirms
- **THEN** all 3 items are deleted; list refreshes; selection is cleared

### Scenario: Delete folder from folder tree context menu

- **GIVEN** user right-clicks a folder in the navigation tree
- **WHEN** user selects "Delete" → confirms
- **THEN** folder and all its contents are recursively deleted; folder disappears from the tree; if the user was browsing inside it, navigation moves to the parent

### Scenario: Delete current folder

- **GIVEN** user is browsing `/All files/old-data/`
- **WHEN** user deletes `old-data` (via tree context menu) → confirms
- **THEN** hook detects `folderPath === 'old-data/'` is deleted; navigates to root; listing shows root contents

### Scenario: Partial failure (some items forbidden)

- **GIVEN** a bulk selection of 4 items where 1 is in a read-only sub-folder
- **WHEN** delete is confirmed
- **THEN** 3 items are deleted successfully; a success toast is shown for the deleted items; an error toast lists the failed item names

### Scenario: Read-only folder — delete action hidden

- **GIVEN** user navigates to a folder they only have READ permission on
- **WHEN** the grid row context menu is opened for any item in that folder
- **THEN** "Delete" is absent from the menu (no `DialFileManagerActions.Delete` in `actionLabels`)

### Scenario: Delete 101 items (bulk)

- **GIVEN** user attempts a batch delete of 101 items
- **WHEN** `onDeleteFiles` builds the DTO and calls the BFF
- **THEN** BFF returns 400; an error toast shows `dialFileManager.deleteFilesError`

### Scenario: DIAL Core 403 on all items

- **GIVEN** all items in the batch return 403 from DIAL Core
- **WHEN** delete completes
- **THEN** an error toast lists the failed item names; cache refresh still runs for the current folder

### Scenario: Upload/Download/Attach unchanged

- **GIVEN** the modal is open with existing upload, download, and attach functionality
- **WHEN** the user uses any of those flows
- **THEN** they work identically to before this change (no regressions in `isOperationInProgress`, `selectedPaths`, footer button)

---

## Feature flag

Not gated. Delete is available to all authenticated users with WRITE permission on the relevant folder.

---

## Tests

**`useDialFileManager.spec.tsx`** (`apps/chat/src/hooks/files/tests/useDialFileManager.spec.tsx`):
- `onDeleteFiles` success: cache invalidated, retryCounter incremented, `isDeleting` transitions
- `onDeleteFiles` partial failure: success and error notifications emitted
- `onDeleteFiles` total failure: error notification emitted
- `onDeleteFiles` — current folder deleted: `folderPath` navigates to parent

**`DialFileManagerModal.spec.tsx`** (`apps/chat/src/components/DialFileManagerModal/tests/DialFileManagerModal.spec.tsx`):
- Delete action label appears in grid options when `deleteLabel` prop is provided
- Loading overlay visible when `isDeleting` is true (mock hook)
- `showNotification` from `useNotification` is passed to `useDialFileManager`
- `isOperationInProgress` disables Attach button when `isDeleting` is true
