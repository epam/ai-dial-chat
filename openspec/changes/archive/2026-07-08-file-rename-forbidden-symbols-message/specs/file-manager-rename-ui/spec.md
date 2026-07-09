## MODIFIED Requirements

### Requirement: onRenameValidate — client-side inline validation

`useDialFileManager` SHALL expose `onRenameValidate(value: string, item: DialFile): string | null`, which validates a proposed new name before the rename is submitted.

**State ownership**: the hook in `apps/chat/src/hooks/files/useDialFileManager.ts` owns validation logic. `DialFileManagerShell` receives `onRenameValidate` via the `hookResult` prop and passes it to `DialFileManager`.

**Validation rules** (checked in order):

| # | Rule | Error key |
|---|------|-----------|
| 1 | Empty name | `renameValidationMessages.emptyName` |
| 2 | Name equals reserved `.dial_folder` | `dialFileManager.renameReservedName` |
| 3 | Name contains `/` or `\` | `dialFileManager.renameInvalidChars` |
| 4 | Name contains a forbidden symbol (per `forbiddenSymbolsRegExp`) | `dialFileManager.forbiddenSymbolsTooltip` |
| 5 | Name length > 255 | `dialFileManager.renameNameTooLong` |
| 6 | Duplicate sibling name (case-insensitive) | `renameValidationMessages.duplicateName` |

Forbidden-symbol validation (beyond `/` and `\`) SHALL use the same `forbiddenSymbolsRegExp` already wired in the modal for upload conflicts. If the name matches the regexp, the function SHALL return the same specific message used elsewhere for forbidden symbols — `dialFileManager.forbiddenSymbolsTooltip` ("File names cannot contain: : ; , = / { } % & \"") — not the generic `dialFileManager.renameInvalidChars` message. This keeps the rename tooltip and the upload/create-folder tooltip naming the same prohibited symbols with the same wording.

**Caller wiring**: every production call site of `useDialFileManager` (`apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx` and `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`) MUST pass `forbiddenSymbolsRegExp: NOT_ALLOWED_SYMBOLS_REGEXP` (from `@epam/ai-dial-ui-kit`) to the hook. Without this, rule #4 never runs — the sibling regex check on `DialFileManagerShell` only feeds the ui-kit's static already-invalid-name indicator, not `onRenameValidate`, so a caller that omits this option lets any forbidden symbol through unvalidated.

**Memoisation**: `onRenameValidate` SHALL be wrapped in `useCallback` (depends on sibling file list and `forbiddenSymbolsRegExp`).

**i18n keys**:

| Key | English default |
|-----|-----------------|
| `dialFileManager.renameNameEmpty` | `"Name cannot be empty"` |
| `dialFileManager.renameDuplicateName` | `"An item with this name already exists"` |
| `dialFileManager.renameReservedName` | `"This name is reserved"` |
| `dialFileManager.renameInvalidChars` | `"Name contains invalid characters"` |
| `dialFileManager.forbiddenSymbolsTooltip` | `"File names cannot contain: : ; , = / { } % & \""` |
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

#### Scenario: Forward slash rejected

- **WHEN** the user types `folder/name`
- **THEN** `onRenameValidate` returns `"Name contains invalid characters"`

#### Scenario: Forbidden symbol rejected with specific message

- **WHEN** the user types a name containing a forbidden symbol (e.g. `report:v2`)
- **THEN** `onRenameValidate` returns `"File names cannot contain: : ; , = / { } % & \""` (the `forbiddenSymbolsTooltip` message), not the generic `"Name contains invalid characters"` message
- **AND** the ui-kit renders this message as a live inline tooltip while the user is still typing

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
