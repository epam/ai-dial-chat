# Spec: file-manager-rename-ui

## Purpose

Client-side rename validation and the rename save flow in the file-manager shell.

### Requirement: onRenameValidate — client-side inline validation

`useDialFileManager` SHALL expose `onRenameValidate(value: string, item: DialFile): string | null`, which validates a proposed new name before the rename is submitted.

**State ownership**: the hook in `apps/chat/src/hooks/files/useDialFileManager.ts` owns validation logic. `DialFileManagerShell` receives `onRenameValidate` via the `hookResult` prop and passes it to `DialFileManager`.

**Validation rules** (checked in order):

| # | Rule | Error key |
|---|------|-----------|
| 1 | Empty name | `renameValidationMessages.emptyName` |
| 2 | Name equals reserved `.dial_folder` | `dialFileManager.renameReservedName` |
| 3 | Name contains `/`, `\`, or a forbidden symbol (per `forbiddenSymbolsRegExp`) | File: `dialFileManager.forbiddenSymbolsTooltip`; folder: `dialFileManager.folderNameInvalidChars` |
| 4 | Name length > 255 | `dialFileManager.renameNameTooLong` |
| 5 | Duplicate sibling name (case-insensitive) | `renameValidationMessages.duplicateName` |

Forbidden-symbol validation SHALL use the same effective symbol set as folder creation: path separators (`/` and `\`) are always rejected, and all other forbidden characters come from the `forbiddenSymbolsRegExp` option. If a file name contains a forbidden symbol, the function SHALL return `dialFileManager.forbiddenSymbolsTooltip` ("File name should not contain special symbols {{notAllowedSymbols}}"). If a folder name contains a forbidden symbol, it SHALL return `dialFileManager.folderNameInvalidChars` ("Folder name should not contain special symbols {{notAllowedSymbols}}"). This keeps file rename, folder rename, and create-folder validation aligned while preserving file-vs-folder wording.

**Caller wiring**: every production call site of `useDialFileManager` (`apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx` and `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`) MUST pass `forbiddenSymbolsRegExp: NOT_ALLOWED_SYMBOLS_REGEXP` (from `@epam/ai-dial-ui-kit`) to the hook. Without this, the regex-backed part of rule #3 never runs — the sibling regex check on `DialFileManagerShell` only feeds the ui-kit's static already-invalid-name indicator, not `onRenameValidate`, so a caller that omits this option lets any forbidden symbol beyond `/` and `\` through unvalidated.

**Memoisation**: `onRenameValidate` SHALL be wrapped in `useCallback` (depends on sibling file list and `forbiddenSymbolsRegExp`).

**i18n keys**:

| Key | English default |
|-----|-----------------|
| `dialFileManager.renameNameEmpty` | `"Name cannot be empty"` |
| `dialFileManager.renameDuplicateName` | `"An item with this name already exists"` |
| `dialFileManager.renameReservedName` | `"This name is reserved"` |
| `dialFileManager.renameInvalidChars` | `"Name contains invalid characters"` |
| `dialFileManager.forbiddenSymbolsTooltip` | `"File name should not contain special symbols {{notAllowedSymbols}}"` |
| `dialFileManager.folderNameInvalidChars` | `"Folder name should not contain special symbols {{notAllowedSymbols}}"` |
| `dialFileManager.renameNameTooLong` | `"Name must be 255 characters or fewer"` |

`renameValidationMessages.emptyName` and `renameValidationMessages.duplicateName` are supplied via the ui-kit `renameValidationMessages` prop using the explicit rename i18n keys above.

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
- **THEN** `onRenameValidate` returns `"File name should not contain special symbols {{notAllowedSymbols}}"` (the `forbiddenSymbolsTooltip` message), not the generic `"Name contains invalid characters"` message
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

### Requirement: DialFileManagerShell rename wiring

`DialFileManagerShell` SHALL pass rename props to `DialFileManager` and include `DialFileManagerActions.Rename` in `actionLabels` only on the `my_files` tab (or when tabs are absent and the folder has WRITE permission).

**Props wired**:
- `onRenameValidate` — from `useDialFileManager`
- `onMoveToFiles` — from `useDialFileManager`
- `renameValidationMessages` — `{ emptyName, duplicateName, hiddenItemWarning }` i18n strings
- `isRenameFileAvailable` — `uploadEnabled` (WRITE-gated)
- `forbiddenSymbolsRegExp` — already wired (reuse)

**Action labels** (tab-gated — see `file-manager-tabs` spec for the full action matrix):

| Tab | Rename in `actionLabels`? |
|-----|--------------------------|
| `my_files` | ✅ when `uploadEnabled` (WRITE) |
| `shared` | ❌ |
| `organization` | ❌ |

**Loading overlay**: when `isRenaming` is `true`, the modal MUST show a full-coverage loading overlay (same z-index and pattern as `isDeleting` overlay). `isRenaming` MUST be included in `isOperationInProgress`.

**Error banner**: if rename fails, an error banner appears at the bottom of the modal (same pattern as delete error banner). Clicking it dismisses the error.

**Memoisation**: `renameValidationMessages` object SHALL be wrapped in `useMemo`.

**RTL**: no new directional layout; overlay and banner reuse existing RTL-safe patterns (logical inset classes, `text-start`).

**Accessibility**: loading overlay `aria-live="polite"`, error banner `role="alert"`.

#### Scenario: Rename action visible on my_files with WRITE

- **WHEN** the active tab is `my_files` and the current folder has WRITE permission
- **THEN** `gridOptions.actionLabels` includes `DialFileManagerActions.Rename`

#### Scenario: Rename action hidden on shared tab

- **WHEN** the active tab is `shared`
- **THEN** `gridOptions.actionLabels` does NOT include `DialFileManagerActions.Rename`

#### Scenario: Rename loading overlay shown

- **WHEN** `isRenaming` is `true`
- **THEN** a full-coverage loading overlay with `aria-live="polite"` is displayed over the modal content

#### Scenario: Rename error banner dismissible

- **WHEN** a rename error occurs and the user clicks the error banner
- **THEN** the banner is dismissed and the rename error state is cleared
