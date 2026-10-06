# Spec: file-manager-rename-ui

## Purpose

Client-side rename validation and the rename save flow in the file-manager shell.

## Requirements

### Requirement: onRenameValidate — client-side inline validation

`useDialFileManager` SHALL expose `onRenameValidate(value: string, item: DialFile): string | null`, which validates a proposed new name before the rename is submitted.

**State ownership**: the rules run in `useDialFileMutations` (`libs/chat-hooks/src/files/useDialFileMutations/useDialFileMutations.ts`, `@epam/ai-dial-chat-hooks`), which returns a structured `FileNameValidationError` (`reason: FileNameValidationErrorReason`). `useDialFileManager` wraps it and turns the error into text through the host-supplied `buildValidationErrorMessage` option (`apps/chat/src/components/DialFileManagerShell/file-manager-notification-adapter.ts`, wired by `useDialFileManagerHostOptions`), so the lib holds no i18n. The app-level `DialFileManagerShell` wrapper receives the hook result as `hookResult` and forwards it as the `controller` prop of the shared `DialFileManagerShell` (`@epam/ai-dial-chat-shared/file-manager`), which passes `onRenameValidate` to `DialFileManager`.

**Validation rules** (checked in order):

| # | Rule | Error key |
|---|------|-----------|
| 1 | Empty or whitespace-only name | `dialFileManager.renameNameEmpty` |
| 2 | Name equals reserved `.dial_folder` | `dialFileManager.renameReservedName` |
| 3 | Name contains `/`, `\`, or a forbidden symbol (per `forbiddenSymbolsRegExp`) | File: `dialFileManager.forbiddenSymbolsTooltip`; folder: `dialFileManager.folderNameInvalidChars` |
| 4 | Name length > 255 | `dialFileManager.renameNameTooLong` |
| 5 | Duplicate sibling name (case-insensitive, among `currentFolder.items` excluding the item itself) | `dialFileManager.renameDuplicateName` |

Forbidden-symbol validation SHALL use the same effective symbol set as folder creation: path separators (`/` and `\`) are always rejected, and all other forbidden characters come from the `forbiddenSymbolsRegExp` option. If a file name contains a forbidden symbol, the function SHALL return `dialFileManager.forbiddenSymbolsTooltip` ("File name should not contain special symbols {{notAllowedSymbols}}"). If a folder name contains a forbidden symbol, it SHALL return `dialFileManager.folderNameInvalidChars` ("Folder name should not contain special symbols {{notAllowedSymbols}}"). This keeps file rename, folder rename, and create-folder validation aligned while preserving file-vs-folder wording.

**Caller wiring**: every production call site of `useDialFileManager` (`apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx` and `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`) MUST pass `forbiddenSymbolsRegExp: NOT_ALLOWED_SYMBOLS_REGEXP` (from `@epam/ai-dial-ui-kit`) to the hook. Without this, the regex-backed part of rule #3 never runs — the sibling regex check on `DialFileManagerShell` only feeds the ui-kit's static already-invalid-name indicator, not `onRenameValidate`, so a caller that omits this option lets any forbidden symbol beyond `/` and `\` through unvalidated.

**Memoisation**: `onRenameValidate` SHALL be wrapped in `useCallback` (depends on `currentFolder` and `forbiddenSymbolsRegExp`).

**i18n keys**:

| Key | English default |
|-----|-----------------|
| `dialFileManager.renameNameEmpty` | `"Name cannot be empty"` |
| `dialFileManager.renameDuplicateName` | `"An item with this name already exists"` |
| `dialFileManager.renameReservedName` | `"This name is reserved"` |
| `dialFileManager.forbiddenSymbolsTooltip` | `"File name should not contain special symbols {{notAllowedSymbols}}"` |
| `dialFileManager.folderNameInvalidChars` | `"Folder name should not contain special symbols {{notAllowedSymbols}}"` |
| `dialFileManager.renameNameTooLong` | `"Name must be 255 characters or fewer"` |
| `dialFileManager.renameHiddenItemWarning` | `"A dot at the start of the name will make the item hidden"` |

The ui-kit `renameValidationMessages` prop is built by each host (`DialFileManagerPage`, `DialFileManagerModal`) from `renameNameEmpty` (`emptyName`), `renameDuplicateName` (`duplicateName`), and `renameHiddenItemWarning` prefixed with `${NotificationVariant.Warning}__` (`hiddenItemWarning`), and reaches the shell through `labels.renameValidationMessages`.

**RTL**: no directional layout impact. Error message strings are direction-agnostic; ui-kit inline input inherits `dir` from `<html>`.

**Feature flag**: not gated behind `ENABLED_FEATURES`. Rename is a core CRUD operation.

**Accessibility**: error message is rendered by ui-kit inline rename input; no additional ARIA attributes required at the modal level.

#### Scenario: Empty name rejected

- **WHEN** the user clears the inline rename input and tries to confirm
- **THEN** `onRenameValidate` returns the `emptyName` message and the ui-kit input shows the error inline

#### Scenario: Reserved name rejected

- **WHEN** the user types `.dial_folder` as the new name
- **THEN** `onRenameValidate` returns `"This name is reserved"` and the save is blocked

#### Scenario: File path separator rejected with the file-name forbidden-symbols message

- **WHEN** the user types `folder/name`
- **THEN** `onRenameValidate` returns `"File name should not contain special symbols {{notAllowedSymbols}}"`

#### Scenario: File forbidden symbol rejected with specific message

- **WHEN** the user types a name containing a forbidden symbol (e.g. `report:v2`)
- **THEN** `onRenameValidate` returns `"File name should not contain special symbols {{notAllowedSymbols}}"` (the `forbiddenSymbolsTooltip` message), not a generic invalid-characters message
- **AND** the ui-kit renders this message as a live inline tooltip while the user is still typing

#### Scenario: Folder forbidden symbol rejected with folder wording

- **WHEN** the user renames a folder to a name containing a forbidden symbol (e.g. `reports:2026`)
- **THEN** `onRenameValidate` returns `"Folder name should not contain special symbols {{notAllowedSymbols}}"` (the `folderNameInvalidChars` message)

#### Scenario: Forbidden symbol rejected on the standalone File Manager page

- **WHEN** the user is on the standalone "DIAL File System" page (`DialFileManagerPage`) and types a name containing a forbidden symbol (e.g. `::::`)
- **THEN** `onRenameValidate` returns the `forbiddenSymbolsTooltip` message and the rename is blocked, because `DialFileManagerPage` passes `forbiddenSymbolsRegExp` to `useDialFileManager`

#### Scenario: Forbidden symbol rejected in the attach-file modal

- **WHEN** the user is renaming a file inside the attach-file modal (`DialFileManagerModal`) and types a name containing a forbidden symbol
- **THEN** `onRenameValidate` returns the `forbiddenSymbolsTooltip` message and the rename is blocked, because `DialFileManagerModal` passes `forbiddenSymbolsRegExp` to `useDialFileManager`

#### Scenario: Duplicate sibling name rejected

- **WHEN** the user types a name that matches an existing sibling item (case-insensitive)
- **THEN** `onRenameValidate` returns the `duplicateName` message

#### Scenario: Valid name accepted

- **WHEN** the user types a name that passes all checks
- **THEN** `onRenameValidate` returns `null` and the save is allowed

---

### Requirement: onMoveToFiles — rename save flow

`useDialFileManager` SHALL expose `onMoveToFiles(items: DialCopiedItem[], sourceFolder: string, destinationFolder: string): void` (implemented in `useDialFileMutations`), which splits ui-kit `DialCopiedItem[]` via `prepareMoveRenameItems` (`libs/chat-hooks/src/files/dial-file-manager-copy-move.util.ts`): items whose source and destination share a parent folder become `RenameItemDto[]` sent through the injected `filesApi.renameFiles` (`POST /api/v1/files/rename`); items whose parent changes become `MoveItemDto[]` sent through `filesApi.moveFiles` in parallel. The call is ignored when the list is empty or a copy, move, or rename is already in flight.

**State ownership**: `isRenaming: boolean` state is owned by `useDialFileManager`. It is `true` while the BFF call is in flight.

**Mapping rule**: `DialCopiedItem.sourceUrl` → `sourcePath` and `DialCopiedItem.destinationUrl` → `destinationPath` (both via `virtualPathToApiPath`; folders normalised to a trailing `/`, files without one). `DialCopiedItem.nodeType` → `RenameItemDtoNodeTypeEnum.Item` or `RenameItemDtoNodeTypeEnum.Folder`. Each DTO also carries `bucket` and the source `name`.

**Save flow**:
1. Map `DialCopiedItem[]` → `RenameItemDto[]` (and `MoveItemDto[]`).
2. `setIsRenaming(true)` when there is at least one rename DTO.
3. Call `filesApi.renameFiles(renameDtos)`; a thrown call counts every rename DTO as failed.
4. On full success of a single rename: raise a success notification (see below).
5. On partial failure: emit `onNotification` with `FileManagerNotificationReason.RenamePartiallyFailed` and the failed `count` (the host maps it to `dialFileManager.renamePartialError`). No success notification is raised for a partially failed batch.
6. On total failure: emit `onNotification` with `FileManagerNotificationReason.RenameFailed` (the host maps it to `dialFileManager.renameError`).
7. If a successfully renamed folder is the current browse path or an ancestor, update the current folder path via `setFolderPath` (replace the old prefix with the new prefix).
8. Whatever the outcome, invalidate the listing cache for every source and destination parent folder (`invalidateFolders`), call `bumpRetry()`, and `setIsRenaming(false)`.

**Success notification**: a fully successful single-item rename SHALL emit `onOperationSuccess` with `FileOperationKind.FileRenamed`, `isFolder` from the DTO `nodeType`, and `name` = the new name; the host adapter then notifies through `useOperationNotification` (see `entity-operation-notifications`) with `EntityOperation.Renamed` and `NotifiableEntity.File` or `NotifiableEntity.Folder`. A multi-item rename batch (which the grid cannot produce today) SHALL raise no success notification.

**Cache invalidation**: cache keys for the affected listing entries MUST be cleared so the next render fetches fresh data — the source parent and destination parent of every rename and move DTO, via `invalidateFolders` + `bumpRetry`.

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

**Accessibility**: loading overlay uses `aria-live="polite"` (same as delete overlay). Rename failures surface as host toasts, not an in-modal banner.

#### Scenario: File rename triggers BFF and refreshes listing

- **WHEN** the user confirms an inline rename of a file
- **THEN** `onMoveToFiles` is called, `isRenaming` becomes `true`, `filesApi.renameFiles` is called, and on success the listing refreshes, a success notification titled `"File renamed successfully"` is shown, and `isRenaming` returns to `false`

#### Scenario: Folder rename navigates to new path

- **WHEN** the user renames the folder they are currently browsing
- **THEN** after a successful rename the current folder path switches to the renamed folder's new path, and a success notification titled `"Folder renamed successfully"` is shown

#### Scenario: Partial rename failure shows toast

- **WHEN** one item in the rename batch fails at DIAL Core
- **THEN** a toast shows `"1 item(s) could not be renamed."`, the listing refreshes to show the actual state, and no success notification is raised

#### Scenario: isRenaming gate prevents concurrent operations

- **WHEN** `isRenaming` is `true`
- **THEN** `isAnyOperationInProgress` is `true` and a further `onMoveToFiles` call is ignored

### Requirement: DialFileManagerShell rename wiring

The shared `DialFileManagerShell` (`libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`) SHALL pass rename props to `DialFileManager`. `useDialFileManager` SHALL include `DialFileManagerActions.Rename` in its `actionLabels` only when `activeTab` is `DialFileManagerTabs.MyFiles` (the default when tabs are absent) and `uploadEnabled` (WRITE permission) is true; the shell forwards those labels to the grid.

**Props wired**:
- `onRenameValidate` — from `useDialFileManager`
- `onMoveToFiles` — from `useDialFileManager`
- `renameValidationMessages` — `labels.renameValidationMessages` (`{ emptyName, duplicateName, hiddenItemWarning }` i18n strings from the host)
- `isRenameFileAvailable` — `uploadEnabled` (WRITE-gated)
- `forbiddenSymbolsRegExp` — `NOT_ALLOWED_SYMBOLS_REGEXP`, with `forbiddenSymbolsTooltip` from `labels`

**Action labels** (tab-gated — see `file-manager-tabs` spec for the full action matrix):

| Tab | Rename in `actionLabels`? |
|-----|--------------------------|
| `my_files` | ✅ when `uploadEnabled` (WRITE) |
| `shared` | ❌ |
| `organization` | ❌ |

**Loading overlay**: when `isRenaming` is `true` and no move is in flight, the shell MUST show a full-coverage loading overlay (`absolute inset-0 z-[52]`, same pattern as the `isDeleting` overlay) containing a `Spinner` whose `ariaLabel` is `labels.renamingLabel`. `isRenaming` MUST be included in `isAnyOperationInProgress`.

**Error feedback**: rename failures are reported through the hook's `onNotification` toast (see the save flow above); the shell renders no rename error banner.

**Memoisation**: the host's `renameValidationMessages` object SHALL be wrapped in `useMemo` (in `DialFileManagerPage` and `DialFileManagerModal`).

**RTL**: no new directional layout; the overlay reuses existing RTL-safe patterns (logical inset classes).

**Accessibility**: loading overlay `aria-live="polite"`.

#### Scenario: Rename action visible on my_files with WRITE

- **WHEN** the active tab is `my_files` and the current folder has WRITE permission
- **THEN** `gridOptions.actionLabels` includes `DialFileManagerActions.Rename`

#### Scenario: Rename action hidden on shared tab

- **WHEN** the active tab is `shared`
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Rename`

#### Scenario: Rename loading overlay shown

- **WHEN** `isRenaming` is `true`
- **THEN** a full-coverage loading overlay with `aria-live="polite"` is displayed over the modal content

#### Scenario: Rename error reported as a toast

- **WHEN** every item in a rename batch fails
- **THEN** `onNotification` receives `FileManagerNotificationReason.RenameFailed`, the host shows `"Rename failed. Please try again."` as an error toast, and the overlay clears
