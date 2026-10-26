## MODIFIED Requirements

### Requirement: A completed download confirms itself

The frontend download flow SHALL raise a success notification once the response has been handed to the host destination and the save has completed, through `useOperationNotification` (see `entity-operation-notifications`). For a blob download that means after the transient object URL has been clicked and revoked. The lib emits an `onOperationSuccess` event (`FileOperationKind.FileDownloaded` / `FilesDownloaded`), and `handleFileOperationSuccess` in `apps/chat/src/components/DialFileManagerShell/file-manager-notification-adapter.ts` maps it to the entity/operation pairs below. The download's queue row turns into success at the same moment (see `file-manager-download-queue`).

- Single file → `NotifiableEntity.File` + `EntityOperation.Downloaded` with `count: 1`. `name` is the filename actually used for the saved file (the `Content-Disposition` name when present, otherwise `file.name`), so the notification names what is on disk rather than what was requested.
- A single folder → `NotifiableEntity.Folder` + `EntityOperation.Downloaded`, `name` = the archive filename.
- A multi-item selection → `NotifiableEntity.File` + `EntityOperation.Downloaded` with `count` = the number of selected items, resolving the plural body (`{{count}} files are saved on your device.`). The archive file itself is not named: the user picked items, not an archive.
- The error branch keeps `FileManagerNotificationReason.DownloadFileFailed` / `DownloadFilesFailed` through `onNotification` (shown as `dialFileManager.downloadFileError` / `downloadFilesError`), and the download's queue row becomes `Failed` with its reason.
- A dismissed "Save As" picker (`DownloadDestinationType.Cancelled`) raises neither notification and adds no queue row.
- A download canceled from its queue row raises neither notification.

#### Scenario: Single file download confirms with the saved filename

- **WHEN** a user downloads one file and the response carries `Content-Disposition: attachment; filename="report final.pdf"`
- **THEN** after the save completes a success notification titled `"File downloaded successfully"` is shown, naming `report final.pdf`, and its queue row shows success

#### Scenario: Folder download confirms with the archive name

- **WHEN** a user downloads a single folder
- **THEN** exactly one success notification titled `"Folder downloaded successfully"` is shown, naming the archive file

#### Scenario: Multi-item download confirms with the item count

- **WHEN** a user downloads a selection of three items as an archive
- **THEN** exactly one success notification titled `"Files downloaded successfully"` is shown, with the body `3 files are saved on your device.`

#### Scenario: Failed download raises no success notification

- **WHEN** the download request rejects
- **THEN** only the existing error toast is shown, and the download's queue row shows failed

#### Scenario: Canceled download raises no notification

- **WHEN** the user cancels a download from its queue row
- **THEN** no success or error notification is shown
