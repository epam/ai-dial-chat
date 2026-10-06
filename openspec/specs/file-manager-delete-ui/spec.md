# Spec: file-manager-delete-ui

## Purpose

The delete capability on `useDialFileManager` and its wiring into the file-manager modal.

## Requirements

### Requirement: useDialFileManager — delete capability

`useDialFileManager` in `libs/chat-hooks/src/files/useDialFileManager/useDialFileManager.ts` (`@epam/ai-dial-chat-hooks`) SHALL expose `onDeleteFiles` and `isDeleting`, and SHALL surface delete results through the `onNotification` option as structured, reason-tagged `FileManagerNotification` events that the host translates. The delete implementation lives in `useDialFileMutations` (`libs/chat-hooks/src/files/useDialFileMutations/useDialFileMutations.ts`), which `useDialFileManager` composes and whose `onDeleteFiles`/`isDeleting` it returns.

#### State ownership

Delete loading state is owned by `useDialFileMutations` and surfaced through `useDialFileManager`, which also folds it into `isAnyOperationInProgress`. Toast copy and rendering are owned by the host: `useDialFileManagerHostOptions` (`apps/chat/src/components/DialFileManagerShell/useDialFileManagerHostOptions.ts`) supplies an `onNotification` that maps each event through `buildFileManagerNotificationOptions` (`file-manager-notification-adapter.ts`) into the app-level `useNotification().showNotification`. No new React Context is introduced.

#### Interface additions

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
onNotification?: (notification: FileManagerNotification) => void;

interface FileManagerNotification {
  variant: NotificationVariant;
  title?: string;
  message?: string;
  reason?: FileManagerNotificationReason;
  count?: number;
  name?: string;
  folder?: string;
  names?: string[];
  restCount?: number;
}
```

#### `onDeleteFiles` implementation

`DialDeletedItem.sourceUrl` is the **virtual path** set on `DialFile.path` (e.g. `/All files/reports/q1.pdf`), NOT a DIAL resource URL. Convert it to an API-relative path using the `virtualPathToApiPath(sourceUrl, rootLabel)` helper.

```
0. Return immediately when no items are passed
1. setIsDeleting(true)
2. Map each DialDeletedItem to DeleteItemDto:
   - relPath = virtualPathToApiPath(item.sourceUrl, rootLabel), with a file's trailing '/' stripped
     e.g. "/All files/Screenshot.png" → "Screenshot.png"
          "/All files/reports/"       → "reports/"
   - nodeType: DialFileNodeType.FOLDER → DeleteItemDtoNodeTypeEnum.Folder, otherwise DeleteItemDtoNodeTypeEnum.Item
   - name: getVirtualPathName(item.sourceUrl, relPath) — the last non-empty segment
   - bucket/path: on the Shared tab, the owner's coordinates via resolveOwnerCoords; otherwise the hook's bucket and relPath
3. Call filesApi.deleteFiles(dtos)  [the caller-supplied DialFilesApi; the app passes dialFilesApiAdapter]
4. Count failures (results.filter(r => !r.success))
5. When any item succeeded, emit { variant: Success, reason: FileManagerNotificationReason.FilesDeleted,
   count: successCount, name: <first successful item's name>, folder: sourceFolder || rootLabel }
6. When any item failed, emit { variant: Error, reason: FileManagerNotificationReason.FilesDeletePartiallyFailed,
   names: <first 3 failed names>, restCount }; when the whole request throws, emit
   { variant: Error, reason: FileManagerNotificationReason.DeleteFailed }
7. Invalidate cache: invalidateFolders(<affected folder keys>)
8. Navigate: if currentFolderPath is, or is a descendant of, any deleted folder → setFolderPath(<parent of the outermost such folder>)
9. bumpRetry()  ← triggers re-fetch of current folder
10. setIsDeleting(false)
```

The host adapter turns those events into toasts with the legacy copy:

- `FilesDeleted`, one item → `dialFileManager.itemDeletedSuccessfully` + `dialFileManager.itemDeletedFromFolder`; several → `dialFileManager.itemsDeletedSuccessfully` + `dialFileManager.itemsDeletedFromFolder`
- `FilesDeletePartiallyFailed` → `dialFileManager.itemsDeletingFailed` + `dialFileManager.someItemsNotDeleted`, with `dialFileManager.andOtherItems` for `restCount`
- `DeleteFailed` → `dialFileManager.deleteFilesError`

#### Cache invalidation detail

For each deleted item, compute its API folder key (parent path):
- `item` node: parent = everything up to the last `/` in `relPath` (e.g. `reports/` for `reports/q1.pdf`)
- `folder` node: the folder path itself (e.g. `old-data/`)

Pass those keys to `useDialFileListing`'s `invalidateFolders`, which purges keys that are not currently rendered from both `cache` and `listingPermissionsCache`, and refreshes visible keys in place (fetch first, then overwrite) so the listing does not flash empty.

#### Navigation on current-folder deletion

Collect each deleted folder's API path in the listing's own path space (the `relPath` computed from `virtualPathToApiPath`, trailing-slashed — not `dto.path`, which on the Shared tab is in owner coordinates). Among those that `folderPath` (current) equals or starts with, take the outermost (shortest) one and navigate to its parent with `getParentFolderPath` from `@epam/ai-dial-chat-shared`. That is the nearest non-deleted ancestor: moving up one level from `folderPath` is not enough, because deleting `a/` while browsing `a/b/` would otherwise land in the deleted `a/`.

```typescript
const outermostDeletedAncestor = deletedListingFolderPaths
  .filter((deletedPath) => folderPath.startsWith(deletedPath))
  .reduce<string | undefined>(
    (outermost, deletedPath) =>
      outermost == null || deletedPath.length < outermost.length
        ? deletedPath
        : outermost,
    undefined,
  );
if (outermostDeletedAncestor != null) {
  setFolderPath(getParentFolderPath(outermostDeletedAncestor));
}
```

Deleting a file, or a folder that does not contain `folderPath` (including a sibling sharing a name prefix, such as `a/bc/` while browsing `a/b/`), leaves `folderPath` unchanged.

If `folderPath` is root (`''`), no navigation needed — root cannot be deleted.

#### Permission gating

`DialFileManagerActions.Delete` is included in `actionLabels` only on the My files tab (`activeTab === DialFileManagerTabs.MyFiles`), where every folder is the user's own; it is never offered on the Shared or Organization tabs. Unlike Rename/Copy/Move/Duplicate it is not additionally gated by `canWriteCurrentFolder`.

Bulk mixed-selection: items that DIAL Core still refuses produce per-item failures, captured as partial failures.

#### i18n keys (host notification adapter)

The hook emits no copy; `buildFileManagerNotificationOptions` resolves these keys:

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

### Requirement: DialFileManagerModal — delete wiring

`DialFileManagerModal` in `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx` SHALL expose props for the delete copy and forward them, with the file-manager controller, into the shared `FileManagerAttachModal` (`@epam/ai-dial-chat-shared/file-manager`), whose `DialFileManagerShell` (`libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`) wires delete into the `DialFileManager` component.

#### New Props

```typescript
interface Props {
  // ... existing ...
  deleteLabel: string;
  deletingLabel: string;
  deleteConfirmTitle?: (names: string[], items: DialFile[]) => ReactNode;
  deleteConfirmBody: (names: string[]) => ReactNode;
  deleteConfirmLabel: string;
  deleteCancelLabel: string;
}
```

All copy is passed from call sites using `useTranslation` at the app layer. The modal itself translates only the default title (`getFileDeleteConfirmTitle`, used when `deleteConfirmTitle` is omitted) and the close-control label (`deleteCloseLabel`, `buttons.close`).

#### Hook consumption

```typescript
const hostOptions = useDialFileManagerHostOptions();
const { controller: hookResult /* onDeleteFiles, isDeleting, ... */ } =
  useFileAttachmentPicker({ fileManagerOptions: hostOptions, bucket, /* ... */ });
```

#### isOperationInProgress update

```typescript
const { isAnyOperationInProgress } = hookResult;
```

`useDialFileManager` computes `isAnyOperationInProgress` over every in-flight mutation flag (`isCreatingFolder`, `isDownloading`, `isDeleting`, `isRenaming`, `isCopying`, `isMoving`, `isUnsharing`, `isRemovingAccess`) and an in-progress upload batch.

#### deleteConfirmationOptions (memoized, in `DialFileManagerShell`)

```typescript
const deleteConfirmationOptions = useMemo(
  () => ({
    cancelLabel: labels.deleteCancelLabel,
    confirmLabel: labels.deleteConfirmLabel,
    closeLabel: labels.deleteCloseLabel,
    titleRenderer: labels.deleteConfirmTitle,
    contentRenderer: labels.deleteConfirmBody,
  }),
  [labels.deleteCancelLabel, labels.deleteConfirmLabel, labels.deleteCloseLabel, labels.deleteConfirmTitle, labels.deleteConfirmBody],
);
```

#### Action labels — grid, tree, and bulk toolbar

`DialFileManagerShell` builds one memoized `actionLabels` map from the hook's per-tab `actionLabels`: `DialFileManagerActions.Delete` maps to `labels.deleteLabel` whenever the hook offers it. `gridOptions`, `treeOptions`, and `bulkActionsToolbarOptions` all read that map (the grid adds `Info`), so `deleteLabel` reaches every surface through one dependency chain.

#### DialFileManager props

```tsx
<DialFileManager
  // ... existing props ...
  onDeleteFiles={onDeleteFiles}
  deleteConfirmationOptions={deleteConfirmationOptions}
/>
```

#### Loading overlay (delete)

Inside the `<div className="relative ...">` that wraps `DialFileManager`, the shell renders one shared operation overlay whose label `resolveOverlayAriaLabel` picks from the in-flight operation — `deletingLabel` while `isDeleting`:

```tsx
{overlayLabel != null && (
  <div
    aria-live="polite"
    className="absolute inset-0 z-[52] flex items-center justify-center bg-backdrop desktop:p-4"
  >
    <Spinner size={32} fullWidth={false} ariaLabel={overlayLabel} />
  </div>
)}
```

#### Toast feedback (delete)

`DialFileManagerModal` passes `useDialFileManagerHostOptions()` (whose `onNotification` wraps `useNotification().showNotification`) into `useFileAttachmentPicker`. Delete success and failure feedback is rendered by the global `NotificationContainer`, not as an inline banner inside the modal.

#### Call sites: new prop values

Every host of the file manager's delete confirmation — `ConversationView`, `NewConversationComposer`, `SkillFileSystemModal`, and `DialFileManagerPage` — SHALL pass the same copy through `useTranslation`, and SHALL render the body with the shared `FileDeleteConfirmContent` rather than an inline block. The hosts pass no `deleteConfirmTitle`: `DialFileManagerModal` and `DialFileManagerPage` title the dialog with `getFileDeleteConfirmTitle` (`apps/chat/src/components/FileDeleteConfirmContent/file-delete-confirm-title.ts`), which reads the `nodeType` of the items the file manager passes as the renderer's second argument — "Delete folder" (`dialFileManager.deleteConfirmTitleFolder`) or "Delete file" (`dialFileManager.deleteConfirmTitleFile`) for one item, "Delete items" (`dialFileManager.deleteConfirmTitleMultiple`) for several — and name the close control with `buttons.close`. No current host passes `deleteConfirmTitle`; `AvatarPickerModal` (`@epam/ai-dial-builder-form`) is not a `DialFileManagerModal` host and receives its own delete-confirmation labels from `useApplicationAvatarPicker`:

```tsx
<DialFileManagerModal
  // ... existing ...
  deleteLabel={t(ButtonsI18nKeys.Delete)}
  deletingLabel={t(BasicI18nKeys.DeletingStatus)}
  deleteConfirmBody={(names) => <FileDeleteConfirmContent names={names} />}
  deleteConfirmLabel={t(ButtonsI18nKeys.Delete)}
  deleteCancelLabel={t(ButtonsI18nKeys.Cancel)}
/>
```

`FileDeleteConfirmContent` (`apps/chat/src/components/FileDeleteConfirmContent/FileDeleteConfirmContent.tsx`) SHALL render the shared `ConfirmationView` from `@epam/ai-dial-chat-shared` in its `ConfirmationPopupVariant.Danger` variant (see the `shared-delete-confirmation` spec), so the Files body matches every other delete surface:

- **Identity card** — a `ConfirmationIdentityCard` wrapping a `ConfirmationIdentityRow` with no icon and no type label: the item's name for a single item, the pluralized count (`dialFileManager.deleteConfirmItemCount`, e.g. "3 items") for several.
- **Message** — `dialFileManager.deleteConfirmMessageSingle` / `deleteConfirmMessageMultiple`, with the name or the count bold via `CONFIRMATION_BOLD_COMPONENTS`. For several items the message is followed by a list of the selected names, capped at ten (`MAX_LISTED_NAMES`), with a trailing "… and N more" row (`dialFileManager.deleteConfirmMoreItems`) when the selection is longer, so a long selection cannot push the actions off screen.
- **Consequences** — the single bullet `basic.consequenceCannotBeUndone` ("Cannot be undone").

Names are shown as basenames: the grid reports each entry as a DIAL resource path (`files/{bucket}/path/file.pdf`), and the content uses `.split('/').pop()` so the dialog names the item, not its location.

The dialog frame and action buttons belong to `@epam/ai-dial-react-file-manager` (from `0.3.0-dev.25`): it shows the header close control, a text Cancel, and a danger Delete led by a trash icon, matching the shared `ConfirmationFooter`. It passes the items with their `nodeType` to `titleRenderer` and `contentRenderer`, and names the close control from `closeLabel` (`DialFileManagerShellLabels.deleteCloseLabel`).

#### Scenario: Delete single file from grid row context menu

- **GIVEN** user is browsing a folder with WRITE permission
- **WHEN** user right-clicks a file → selects "Delete" → confirms in the popup
- **THEN** `onDeleteFiles` is called with one `DialDeletedItem`; a loading overlay appears; on completion the file is gone from the listing

#### Scenario: Bulk delete 3 items

- **GIVEN** user selects 3 items in the grid (files and/or folders)
- **WHEN** user clicks "Delete" in the bulk toolbar → confirms
- **THEN** all 3 items are deleted; list refreshes; selection is cleared

#### Scenario: Delete folder from folder tree context menu

- **GIVEN** user right-clicks a folder in the navigation tree
- **WHEN** user selects "Delete" → confirms
- **THEN** folder and all its contents are recursively deleted; folder disappears from the tree; if the user was browsing inside it, navigation moves to the deleted folder's parent

#### Scenario: Delete current folder

- **GIVEN** user is browsing `/All files/old-data/`
- **WHEN** user deletes `old-data` (via tree context menu) → confirms
- **THEN** hook detects `folderPath === 'old-data/'` is deleted; navigates to root; listing shows root contents

#### Scenario: Delete an ancestor of the current folder

- **GIVEN** user is browsing `/All files/a/b/`
- **WHEN** user deletes `a` (via tree context menu) → confirms
- **THEN** hook detects `folderPath === 'a/b/'` sits inside the deleted `a/`; navigates to the parent of `a/` (root), not to the deleted `a/`

#### Scenario: Deleting an unrelated folder or a file keeps the current folder

- **GIVEN** user is browsing `/All files/a/b/`
- **WHEN** user deletes `a/bc`, `z`, or the file `a/b/report.pdf` → confirms
- **THEN** `folderPath` stays `a/b/`

#### Scenario: Partial failure (some items forbidden)

- **GIVEN** a bulk selection of 4 items where 1 is in a read-only sub-folder
- **WHEN** delete is confirmed
- **THEN** 3 items are deleted successfully; a success toast is shown for the deleted items; an error toast lists the failed item names

#### Scenario: Read-only folder — delete action hidden

- **GIVEN** user navigates to a folder they only have READ permission on
- **WHEN** the grid row context menu is opened for any item in that folder
- **THEN** "Delete" is absent from the menu (no `DialFileManagerActions.Delete` in `actionLabels`)

#### Scenario: Delete 101 items (bulk)

- **GIVEN** user attempts a batch delete of 101 items
- **WHEN** `onDeleteFiles` builds the DTO and calls the BFF
- **THEN** BFF returns 400; an error toast shows `dialFileManager.deleteFilesError`

#### Scenario: DIAL Core 403 on all items

- **GIVEN** all items in the batch return 403 from DIAL Core
- **WHEN** delete completes
- **THEN** an error toast lists the failed item names; cache refresh still runs for the current folder

#### Scenario: Upload/Download/Attach unchanged

- **GIVEN** the modal is open with existing upload, download, and attach functionality
- **WHEN** the user uses any of those flows
- **THEN** they work identically to before this change (no regressions in `isOperationInProgress`, `selectedPaths`, footer button)


---

### Requirement: i18n keys

Every user-visible delete string SHALL resolve through a translation key; no delete label, confirmation copy, or toast text may be a literal in component code.

New keys added to `apps/chat/src/i18n/locales/en.json` under `dialFileManager`:

| Key (full) | English value | Notes |
|------------|---------------|-------|
| `dialFileManager.deleteConfirmTitleSingle` | `"Delete item"` | Popup title, single item — `AvatarPickerModal` only (via `useApplicationAvatarPicker`) |
| `dialFileManager.deleteConfirmTitleFile` | `"Delete file"` | Popup title, one file |
| `dialFileManager.deleteConfirmTitleFolder` | `"Delete folder"` | Popup title, one folder |
| `dialFileManager.deleteConfirmTitleMultiple` | `"Delete items"` | Popup title, multiple items |
| `dialFileManager.deleteConfirmMessageSingle` | `"Are you sure you want to delete <bold>{{name}}</bold>? This action is permanent and cannot be undone."` | Body sentence, single item; `<bold>` maps to `CONFIRMATION_BOLD_COMPONENTS` |
| `dialFileManager.deleteConfirmMessageMultiple` | `"Are you sure you want to delete <bold>{{count}} items</bold>? This action is permanent and cannot be undone."` | Body sentence, multiple items |
| `dialFileManager.deleteConfirmItemCount_one` / `_other` | `"{{count}} item"` / `"{{count}} items"` | Identity-card name for a multi-item selection |
| `dialFileManager.deleteConfirmMoreItems_one` / `_other` | `"… and {{count}} more"` | Trailing row once the listed names pass ten |
| `dialFileManager.deleteFilesError` | `"Failed to delete files. Please try again later."` | Request failure toast message |
| `dialFileManager.itemDeletedSuccessfully` | `"Item deleted successfully"` | Single-item success toast title |
| `dialFileManager.itemsDeletedSuccessfully` | `"Items deleted successfully"` | Multi-item success toast title |
| `dialFileManager.itemsDeletingFailed` | `"Items deleting failed"` | Failure toast title |
| `dialFileManager.itemDeletedFromFolder` | `"“{{fileName}}” deleted from {{folder}}"` | Single-item success toast message |
| `dialFileManager.itemsDeletedFromFolder` | `"{{count}} items deleted from {{folder}}"` | Multi-item success toast message |
| `dialFileManager.someItemsNotDeleted` | `"{{files}}{{rest}} were not deleted. Please try again."` | Failed-items toast message |
| `dialFileManager.andOtherItems` | `" and {{count}} other items"` | Failed-items overflow suffix |

The Delete action label, the confirm button, and Cancel reuse `buttons.delete` / `buttons.cancel`; the "Deleting…" overlay label and the "Cannot be undone" bullet reuse `basic.deletingStatus` / `basic.consequenceCannotBeUndone`, shared with every other delete confirmation. `dialFileManager.deleteConfirmBodyMultiple` and `dialFileManager.deleteConfirmBodyItems` are no longer read by the file-manager delete flow; `useApplicationAvatarPicker` still reads them for `AvatarPickerModal`'s `deleteConfirmMultipleText` / `deleteConfirmItemsLabel`.

#### Scenario: Delete copy is fully translated

- **WHEN** the delete action, its confirmation popup, and its result toasts are rendered
- **THEN** each string resolves through one of the listed `dialFileManager.*` keys, with Delete, Cancel, the in-flight label, and the "Cannot be undone" bullet reusing the shared `buttons.*` / `basic.*` keys

---

### Requirement: RTL

The delete surfaces SHALL introduce no physical-direction styling, so they follow the writing direction unchanged:

- No new physical-direction Tailwind classes. All classes follow the logical pattern or are symmetric.
- Toast placement is handled by `NotificationContainer`, which uses logical positioning (`start-1/2`).
- `aria-live`, `role="alert"`, `z-*`, `bg-*` — direction-agnostic.
- No new directional icons.

#### Scenario: Delete surfaces flip with the document

- **WHEN** the file manager is rendered with `dir="rtl"`
- **THEN** the delete overlay, toasts, and menu entries mirror through logical positioning, with no physical `left-*` / `right-*` class and no mirrored icon

---

### Requirement: Accessibility

The delete flow SHALL stay operable and announced without a pointer:

- Delete loading overlay: `aria-live="polite"` — announces to screen readers that an operation is in progress.
- Delete result toasts are rendered through `NotificationContainer` / `Notification`.
- Confirmation popup: handled by `DialFileManager` / ui-kit (focus trap, keyboard Escape = cancel, Enter = confirm).
- Delete action items in grid/tree context menus: rendered by ui-kit; keyboard-accessible via existing grid/tree keyboard navigation.

#### Scenario: A keyboard-only delete is announced end to end

- **WHEN** the user reaches the Delete action by keyboard and confirms it
- **THEN** focus stays trapped in the confirmation popup, Escape cancels and Enter confirms
- **AND** the in-progress overlay announces itself through `aria-live="polite"` before the result toast appears

---

### Requirement: Memoisation

Delete wiring SHALL keep the option objects the file manager already caches referentially stable:

- `deleteConfirmationOptions` wrapped in `useMemo` with all four copy props as deps.
- `gridOptions`, `treeOptions`, `bulkActionsToolbarOptions` use `useMemo` in `DialFileManagerShell`; each depends on the shared `actionLabels` map, which lists `labels.deleteLabel` among its deps.
- `onDeleteFiles` inside `useDialFileMutations` is wrapped in `useCallback` with `[activeTab, bucket, rootLabel, folderPath, onNotification, filesApi, sharedRootMetaRef, invalidateFolders, bumpRetry, setFolderPath]` deps (same pattern as `onDownloadFiles`).

#### Scenario: Unrelated re-render keeps option identity

- **WHEN** the host re-renders without changing bucket, root label, active tab, current folder, or labels
- **THEN** `onDeleteFiles`, `deleteConfirmationOptions`, `gridOptions`, `treeOptions`, and `bulkActionsToolbarOptions` keep their previous references

---

### Requirement: dial-file-system-picker spec sync

`openspec/specs/dial-file-system-picker/spec.md` SHALL record that delete is wired. It does so in its capability table rather than a dedicated sync note: the `onDeleteFiles` / `deleteConfirmationOptions` row reads "wired; reachable as a row/bulk action on the \"My files\" tab".

No requirement-level behavior in `dial-file-system-picker` changes.

#### Scenario: The picker spec records the new props

- **WHEN** this change ships
- **THEN** `dial-file-system-picker/spec.md` lists `onDeleteFiles` / `deleteConfirmationOptions` as wired
- **AND** none of its own requirements or scenarios are altered

---

## Feature flag

Not gated. Delete is available to all authenticated users with WRITE permission on the relevant folder.

---

## Tests

**`useDialFileMutations.spec.tsx`** (`libs/chat-hooks/src/files/useDialFileMutations/tests/useDialFileMutations.spec.tsx`) covers `onDeleteFiles` directly; **`useDialFileManager.spec.tsx`** (`libs/chat-hooks/src/files/useDialFileManager/tests/useDialFileManager.spec.tsx`) covers the composed result, including per-tab Delete visibility (MyFiles only) and `isDeleting`:
- `onDeleteFiles` success: cache invalidated, retryCounter incremented, `isDeleting` transitions
- `onDeleteFiles` partial failure: success and error notifications emitted
- `onDeleteFiles` total failure: error notification emitted
- `onDeleteFiles` — current folder deleted: `folderPath` navigates to parent; an ancestor (or several nested ancestors) deleted: navigates to the parent of the outermost one; unrelated folder or file deleted: `folderPath` unchanged

**`DialFileManagerModal.spec.tsx`** (`apps/chat/src/components/DialFileManagerModal/tests/DialFileManagerModal.spec.tsx`):
- Delete appears in `actionLabels` on the my_files tab and is omitted on the shared and organization tabs
- `isAnyOperationInProgress` disables the Attach button while an operation is in flight
