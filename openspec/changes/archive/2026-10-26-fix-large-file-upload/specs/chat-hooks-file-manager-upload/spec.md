## MODIFIED Requirements

### Requirement: Upload failures and completion are reported through injected callbacks, not app services

The hook SHALL NOT import `react-i18next` or any application notification
service; on plain-file batch completion it SHALL report through
`onNotification` a structured reason — `UploadFailed` when no file
succeeded and at least one failed, or `UploadCompleted` (with the
destination `folder`) when at least one succeeded — and no notification
when every file in the batch was cancelled. On `UploadFailed` it SHALL set
`FileManagerNotification.failureReason`
(`libs/chat-hooks/src/files/dial-file-manager.types.ts`, typed
`FileUploadFailureReason` from `@epam/ai-dial-chat-shared`) to the reason
every failed file shares, and SHALL leave it unset when the failed files
have different reasons. The notification SHALL carry no user-visible string
and no size limit; the host resolves both. It SHALL always invalidate the
destination folder (`invalidateFolders` + `bumpRetry`) after the batch
settles regardless of outcome. Settled entries SHALL stay in
`uploadBatchState` until the host calls `clearUploadBatch`.

#### Scenario: Batch completion always invalidates the destination folder

- **WHEN** a plain-file upload batch completes, whether every file
  succeeded, some failed, or the batch was cancelled
- **THEN** the destination folder's cache entry is invalidated, and the
  settled entries remain in `uploadBatchState` until `clearUploadBatch` is
  called

#### Scenario: All failures share one reason

- **WHEN** every file of a batch fails and each resolves to
  `FileUploadFailureReason.TooLarge`
- **THEN** `onNotification` receives `{ reason: UploadFailed, failureReason: FileUploadFailureReason.TooLarge }`

#### Scenario: Failures have different reasons

- **WHEN** every file of a batch fails, one with `Conflict` and one with
  `Unavailable`
- **THEN** `onNotification` receives `UploadFailed` with no `failureReason`

#### Scenario: Some files succeed

- **WHEN** at least one file of a batch completes and another fails
- **THEN** `onNotification` receives `UploadCompleted` and no `failureReason`
