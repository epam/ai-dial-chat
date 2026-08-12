## ADDED Requirements

### Requirement: A completed download confirms itself

The frontend download flow SHALL raise a success notification once the blob has been handed to the browser — i.e. after the transient object URL has been clicked and revoked — through `useOperationNotification` (see `entity-operation-notifications`).

This extends step 9/10 of the single-item flow and the archive flow, which today notify only on failure: `setIsDownloading(false)` on the happy path leaves the user with no confirmation, indistinguishable from a click that did nothing when the browser saves silently to a default folder.

- Single file → `NotifiableEntity.File` + `EntityOperation.Downloaded`, `name` = the filename actually used for the saved file (the `Content-Disposition` name when present, otherwise `file.name`), so the notification names what is on disk rather than what was requested.
- Folder or multi-item archive → `NotifiableEntity.Folder` + `EntityOperation.Downloaded`, `name` = the archive filename.
- The error branch is unchanged: `dialFileManager.downloadFileError` / `downloadFilesError` through `onNotification`, with `setIsDownloading(false)`.

#### Scenario: Single file download confirms with the saved filename

- **WHEN** a user downloads one file and the response carries `Content-Disposition: attachment; filename="report final.pdf"`
- **THEN** after the object URL is revoked a success notification titled `"File downloaded successfully"` is shown, naming `report final.pdf`

#### Scenario: Archive download confirms once

- **WHEN** a user downloads a folder or a multi-item selection as an archive
- **THEN** exactly one success notification is shown, naming the archive file

#### Scenario: Failed download raises no success notification

- **WHEN** the download request rejects
- **THEN** only the existing error toast is shown and `isDownloading` returns to `false`
