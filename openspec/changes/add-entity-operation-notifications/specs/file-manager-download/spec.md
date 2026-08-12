## ADDED Requirements

### Requirement: A completed download confirms itself

The frontend download flow SHALL raise a success notification once the blob has been handed to the browser — i.e. after the transient object URL has been clicked and revoked — through `useOperationNotification` (see `entity-operation-notifications`).

This extends step 9/10 of the single-item flow and the archive flow, which today notify only on failure: `setIsDownloading(false)` on the happy path leaves the user with no confirmation, indistinguishable from a click that did nothing when the browser saves silently to a default folder.

- Single file → `NotifiableEntity.File` + `EntityOperation.Downloaded` with `count: 1`, `name` = the filename actually used for the saved file (the `Content-Disposition` name when present, otherwise `file.name`), so the notification names what is on disk rather than what was requested.
- A single folder → `NotifiableEntity.Folder` + `EntityOperation.Downloaded`, `name` = the archive filename.
- A multi-item selection → `NotifiableEntity.File` + `EntityOperation.Downloaded` with `count` = the number of selected items, resolving the plural body (`{{count}} files are saved on your device.`). The archive file itself is not named: the user picked items, not an archive.
- The error branch is unchanged: `dialFileManager.downloadFileError` / `downloadFilesError` through `onNotification`, with `setIsDownloading(false)`.

#### Scenario: Single file download confirms with the saved filename

- **WHEN** a user downloads one file and the response carries `Content-Disposition: attachment; filename="report final.pdf"`
- **THEN** after the object URL is revoked a success notification titled `"File downloaded successfully"` is shown, naming `report final.pdf`

#### Scenario: Folder download confirms with the archive name

- **WHEN** a user downloads a single folder
- **THEN** exactly one success notification titled `"Folder downloaded successfully"` is shown, naming the archive file

#### Scenario: Multi-item download confirms with the item count

- **WHEN** a user downloads a selection of three items as an archive
- **THEN** exactly one success notification titled `"Files downloaded successfully"` is shown, with the body `3 files are saved on your device.`

#### Scenario: Failed download raises no success notification

- **WHEN** the download request rejects
- **THEN** only the existing error toast is shown and `isDownloading` returns to `false`
