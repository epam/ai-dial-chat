## MODIFIED Requirements

### Requirement: onMoveToFiles — rename save flow

`useDialFileManager` SHALL expose `onMoveToFiles(items: DialCopiedItem[], sourceFolder: string, destinationFolder: string): void`, which maps ui-kit `DialCopiedItem[]` to `RenameItemDto[]` and calls `POST /api/v1/files/rename`.

**State ownership**: `isRenaming: boolean` state is owned by `useDialFileManager`. It is `true` while the BFF call is in flight.

**Mapping rule**: `DialCopiedItem.sourceUrl` → `sourcePath` (via `virtualPathToApiPath`, same as delete). `DialCopiedItem.destinationUrl` → `destinationPath`. `DialCopiedItem.nodeType` → `RenameItemNodeType.Item` or `RenameItemNodeType.Folder`.

**Save flow**:
1. `setIsRenaming(true)`.
2. Map `DialCopiedItem[]` → `RenameItemDto[]`.
3. Call `renameFiles(dtos)` from `apps/chat/src/server-api/files.api.ts`.
4. On success: invalidate listing cache for source parent folder and destination parent folder keys; trigger `setRetryCounter` (same as delete refresh); raise a success notification (see below).
5. On partial failure: show toast naming failed items (mirror delete partial-error toast). No success notification is raised for a partially failed batch.
6. On total failure: show error toast.
7. If the renamed folder is the current browse path or an ancestor, navigate to the new virtual path (replace old prefix with new prefix in the URL).
8. `setIsRenaming(false)`.

**Success notification**: a fully successful rename SHALL notify through `useOperationNotification` (see `entity-operation-notifications`) with `EntityOperation.Renamed`, `NotifiableEntity.File` or `NotifiableEntity.Folder` resolved from the renamed item's `nodeType`, and `name` = the new name. A single notification SHALL be raised per rename action; a multi-item batch SHALL use the existing plural copy rather than one notification per item.

**Cache invalidation**: cache keys for the affected listing entries MUST be cleared so the next render fetches fresh data. Same strategy as delete (invalidate source parent + destination parent).

**Memoisation**: `onMoveToFiles` SHALL be wrapped in `useCallback`.

**Observability/telemetry**: no new analytics events required.

**i18n keys**:

| Key | English default |
|-----|-----------------|
| `dialFileManager.renamingLabel` | `"Renaming…"` |
| `dialFileManager.renameError` | `"Rename failed. Please try again."` |
| `dialFileManager.renamePartialError` | `"{{count}} item(s) could not be renamed."` |

Success copy lives in the `entityNotifications.file.renamed*` / `entityNotifications.folder.renamed*` keys, not in the `dialFileManager` namespace.

**RTL**: error toast uses existing toast infrastructure (logical layout already applied). No new physical-direction classes.

**Accessibility**: loading overlay uses `aria-live="polite"` (same as delete overlay). Error banner uses `role="alert"`.

#### Scenario: File rename triggers BFF and refreshes listing

- **WHEN** the user confirms an inline rename of a file
- **THEN** `onMoveToFiles` is called, `isRenaming` becomes `true`, `renameFiles` is called, and on success the listing refreshes, a success notification titled `"File renamed successfully"` is shown, and `isRenaming` returns to `false`

#### Scenario: Folder rename navigates to new path

- **WHEN** the user renames the folder they are currently browsing
- **THEN** after a successful rename the app navigates to the new virtual path corresponding to the renamed folder, and a success notification titled `"Folder renamed successfully"` is shown

#### Scenario: Partial rename failure shows toast

- **WHEN** one item in the rename batch fails at DIAL Core
- **THEN** a toast shows `"1 item(s) could not be renamed."`, the listing refreshes to show the actual state, and no success notification is raised

#### Scenario: isRenaming gate prevents concurrent operations

- **WHEN** `isRenaming` is `true`
- **THEN** rename and other destructive operations are disabled (treated as `isOperationInProgress`)
