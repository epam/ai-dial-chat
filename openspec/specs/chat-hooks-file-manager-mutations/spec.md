# chat-hooks-file-manager-mutations Specification

## Purpose

Specifies `@epam/ai-dial-chat-hooks`'s `useDialFileMutations` and
`useDialFileSharing` — folder create/delete/rename/copy/move/download and
unshare/remove-access operations that invalidate the shared listing cache via
injected callbacks, validate names with structured (non-translated) errors,
support independent cancellation, and report outcomes as structured events
rather than calling application notification services.

## Requirements

### Requirement: Mutation hooks invalidate the shared cache instead of owning a copy

`@epam/ai-dial-chat-hooks` SHALL export `useDialFileMutations` and
`useDialFileSharing`, neither of which SHALL hold its own copy of the
listing cache — every successful mutation SHALL call the injected
`invalidateFolders`/`bumpRetry`/`mergeCreatedFolder` callbacks (owned by
`useDialFileListing`; `useDialFileSharing` receives only `bumpRetry`) to
reflect the change, and every network call SHALL go
through the injected `DialFilesApi` port.

#### Scenario: Folder creation merges optimistically rather than invalidating

- **WHEN** `onCreateFolder` succeeds
- **THEN** the hook calls `mergeCreatedFolder` to insert the new folder into
  its parent's cache entry directly (passing the parent's cached
  permissions), followed by `bumpRetry`, rather than calling
  `invalidateFolders`

#### Scenario: Delete invalidates exactly the affected parent folders

- **WHEN** `onDeleteFiles` completes (success or partial failure)
- **THEN** the hook calls `invalidateFolders` with exactly the set of
  affected cache keys — the parent-folder API path of each deleted file and
  the own (trailing-slash) API path of each deleted folder — followed by
  `bumpRetry`

### Requirement: Name validation returns a structured reason, not a translated message

`onCreateFolderValidate` and `onRenameValidate` SHALL return a discriminated
`FileNameValidationError` (`empty`, `forbiddenSymbols`, `reservedName`,
`tooLong`, `duplicateName`) or `null`
for a valid name, and SHALL NOT import `react-i18next` or produce a
pre-rendered message string. `onCreateFolderValidate` SHALL check, in order:
empty, forbidden symbols (including a caller-supplied
`forbiddenSymbolsRegExp`), the reserved marker name (`RESERVED_MARKER_NAME`),
length over 255 characters, and case-insensitive sibling-name conflict
against `parentFolder.items`. `onRenameValidate` SHALL apply the same checks
but test the reserved marker name before forbidden symbols, and match
siblings in `currentFolder.items` excluding the renamed item itself.

#### Scenario: A forbidden-symbol name is rejected with the offending symbols

- **WHEN** `onCreateFolderValidate` is called with a name containing `:`
- **THEN** it returns `{ reason: 'forbiddenSymbols', symbols: NOT_ALLOWED_SYMBOLS }`
  — the full forbidden-symbol list exported by `@epam/ai-dial-ui-kit`, not
  only the offending character

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
isFolder, destinationFolderName as applicable) instead of calling any
application notification service directly — delete success is the one
exception, reported through `onNotification` as a `Success`-variant
`FileManagerNotificationReason.FilesDeleted` notification — and SHALL NOT import
`apps/chat/src/hooks/useOperationNotification` or
`apps/chat/src/types/entity-notification`.

#### Scenario: Multi-file download success reports a count, not a translated string

- **WHEN** `onDownloadFiles` succeeds for three files
- **THEN** `onOperationSuccess` is called with
  `{ kind: 'filesDownloaded', count: 3 }`, and the hook produces no
  translated text itself

### Requirement: Sharing mutations refresh the listing on success

`useDialFileSharing`'s `onUnshareFiles` and `onRemoveFilesAccess` SHALL call
the injected `bumpRetry` on success and SHALL report failures through
`onNotification` with a structured reason. `onUnshareFiles` SHALL additionally
call the injected `removeSharedRootItems` with the unshared items' names before
`bumpRetry`, so the rows leave the cached Shared listing at once, and SHALL emit
`onOperationSuccess({ kind: FileOperationKind.FilesUnshared, name, count })`
(`name` = the first item's name, `count` = the number of items).
`onRemoveFilesAccess` emits no success event.

#### Scenario: A successful unshare removes the rows and reports success

- **WHEN** `onUnshareFiles` succeeds
- **THEN** `removeSharedRootItems` is called with the unshared names, `onOperationSuccess` is called with `FileOperationKind.FilesUnshared`, and `bumpRetry` is called

#### Scenario: A successful remove-access only refreshes

- **WHEN** `onRemoveFilesAccess` succeeds
- **THEN** `bumpRetry` is called and `onOperationSuccess` is not called

### Requirement: Downloads are cancellable, progress-reporting batch entries

`useDialFileMutations` (`libs/chat-hooks/src/files/useDialFileMutations/useDialFileMutations.ts`) SHALL expose:

- `downloadBatchState: FileDownloadBatchState | null`;
- `cancelDownloadFile(id: string)`;
- `cancelAllDownloads()`;
- `clearDownloadBatch()`.

`useDialFileManager` (`libs/chat-hooks/src/files/useDialFileManager/useDialFileManager.ts`) and `useDialFileManagerSections` SHALL pass them through. `onDownloadFiles` SHALL add an entry, run the transfer in the background, and settle the entry as `FileDownloadStatus.Completed`, `Failed` (with `failureReason`) or `Cancelled`. It SHALL no longer hold a page-wide flag that blocks other mutations. `isDownloading` is derived from the batch (some entry in progress) and SHALL NOT be folded into `isAnyOperationInProgress`.

`DialFilesApi.downloadArchive` (`libs/chat-hooks/src/files/dial-files-api.ts`) SHALL accept an optional `signal?: AbortSignal`, mirroring `downloadFile`. `createFilesApiClient` (`libs/chat-hooks/src/files/create-files-api.ts`) SHALL forward it to the generated `downloadArchiveRaw` call as a request-init override.

The hook SHALL NOT read browser download APIs or URLs. Progress is counted on the `Response` body it already receives from the injected `DialFilesApi`, and the bytes are still written through the injected `DownloadDestinationHandlers.triggerDownload`.

#### Scenario: onDownloadFiles returns before the transfer ends

- **WHEN** `onDownloadFiles([file])` is called
- **THEN** a download entry appears with status `FileDownloadStatus.Downloading`, and `isAnyOperationInProgress` stays `false`

#### Scenario: Archive downloads can be aborted

- **WHEN** `cancelDownloadFile` is called for an archive entry
- **THEN** the signal passed to `downloadArchive` is aborted and the entry becomes `Cancelled`

#### Scenario: Clearing the batch

- **WHEN** `clearDownloadBatch()` is called after every entry settled
- **THEN** `downloadBatchState` is `null`
