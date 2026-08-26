# chat-hooks-file-manager-mutations Specification

## Purpose

Specifies `@epam/ai-dial-chat-hooks`'s `useDialFileMutations` and
`useDialFileSharing` — folder create/delete/rename/copy/move and
share/unshare operations that invalidate the shared listing cache via
injected callbacks, validate names with structured (non-translated) errors,
support independent cancellation, and report outcomes as structured events
rather than calling application notification services.

## Requirements

### Requirement: Mutation hooks invalidate the shared cache instead of owning a copy

`@epam/ai-dial-chat-hooks` SHALL export `useDialFileMutations` and
`useDialFileSharing`, neither of which SHALL hold its own copy of the
listing cache — every successful mutation SHALL call the injected
`invalidateFolders`/`bumpRetry`/`mergeCreatedFolder` callbacks (owned by
`useDialFileListing`) to reflect the change, and every network call SHALL go
through the injected `DialFilesApi` port.

#### Scenario: Folder creation merges optimistically rather than invalidating

- **WHEN** `onCreateFolder` succeeds
- **THEN** the hook calls `mergeCreatedFolder` to insert the new folder into
  its parent's cache entry directly, rather than invalidating and refetching

#### Scenario: Delete invalidates exactly the affected parent folders

- **WHEN** `onDeleteFiles` completes (success or partial failure)
- **THEN** the hook calls `invalidateFolders` with exactly the set of
  affected parent-folder API paths, followed by `bumpRetry`

### Requirement: Name validation returns a structured reason, not a translated message

`onCreateFolderValidate` and `onRenameValidate` SHALL return a discriminated
`FileNameValidationError` (`empty`, `forbiddenSymbols`, `reservedName`,
`tooLong`, `duplicateName`, `leadingDot` — folder-creation only) or `null`
for a valid name, and SHALL NOT import `react-i18next` or produce a
pre-rendered message string. Validation SHALL check, in order: empty,
forbidden symbols (including a caller-supplied `forbiddenSymbolsRegExp`),
leading dot (creation only), the reserved marker name, length over 255
characters, and case-insensitive sibling-name conflict.

#### Scenario: A forbidden-symbol name is rejected with the offending symbols

- **WHEN** `onCreateFolderValidate` is called with a name containing `:`
- **THEN** it returns `{ reason: 'forbiddenSymbols', symbols: ':' }`

#### Scenario: A case-insensitive sibling conflict is detected

- **WHEN** `onRenameValidate` is called with a name that matches an existing
  sibling in `currentFolder.items` case-insensitively, excluding the item
  being renamed itself
- **THEN** it returns `{ reason: 'duplicateName', existingName: <matched
  name> }`

### Requirement: Rename-vs-move split executes in parallel and aggregates results separately

`onMoveToFiles` SHALL classify a `DialCopiedItem[]` batch into same-folder
renames and cross-folder moves via `prepareMoveRenameItems`, execute
`renameFiles` and `moveFiles` via the injected `DialFilesApi` concurrently
(not sequentially), and aggregate their successes/failures independently so
that a rename-only batch never calls `moveFiles` and a move-only batch never
calls `renameFiles`.

#### Scenario: A same-folder rename batch never calls the move operation

- **WHEN** every item in a `DialCopiedItem[]` batch has the same parent for
  `sourceUrl` and `destinationUrl`
- **THEN** only `DialFilesApi.renameFiles` is called

#### Scenario: Renaming the currently-browsed folder itself updates folderPath

- **WHEN** the folder currently being browsed is itself renamed
- **THEN** the hook rewrites `folderPath` by substituting the old prefix
  with the new one, rather than leaving the browsed path stale

### Requirement: Copy and move are independently cancellable via AbortController

`onCopyFiles` and `onMoveToFiles` SHALL each track their own
`AbortController`, exposed collectively through `cancelCopyMove`, and SHALL
NOT report a failure notification when the operation was cancelled via that
controller (as opposed to a genuine request failure).

#### Scenario: Cancelling a copy clears its loading flag without a failure toast

- **WHEN** `cancelCopyMove` is called while `onCopyFiles` is in flight
- **THEN** `isCopying` becomes `false` and `onNotification` is not called

### Requirement: Mutation success feedback is a structured event, not a call to app notification services

`useDialFileMutations` SHALL emit an `onOperationSuccess` callback carrying
a library-owned `FileOperationSuccessEvent` (kind, name, count,
destinationFolderName as applicable) instead of calling any application
notification service directly, and SHALL NOT import
`apps/chat/src/hooks/useOperationNotification` or
`apps/chat/src/types/entity-notification`.

#### Scenario: Multi-file download success reports a count, not a translated string

- **WHEN** `onDownloadFiles` succeeds for three files
- **THEN** `onOperationSuccess` is called with
  `{ kind: 'filesDownloaded', count: 3 }`, and the hook produces no
  translated text itself

### Requirement: Sharing mutations bump retry silently on success

`useDialFileSharing`'s `onUnshareFiles` and `onRemoveFilesAccess` SHALL call
the injected `bumpRetry` on success without emitting any success
notification, and SHALL report failures through `onNotification` with a
structured reason.

#### Scenario: A successful unshare triggers a retry with no success toast

- **WHEN** `onUnshareFiles` succeeds
- **THEN** `bumpRetry` is called and `onOperationSuccess`/`onNotification`
  is not called for a success case
