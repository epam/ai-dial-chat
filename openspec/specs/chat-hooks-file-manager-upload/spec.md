# chat-hooks-file-manager-upload Specification

## Purpose

Specifies `@epam/ai-dial-chat-hooks`'s `useDialFileUploadBatch` — bounded-
concurrency batched file upload with per-file progress and cancellation,
deferred overwrite-vs-create-only conflict resolution, archive-upload
partial/full failure classification, and structured (non-translated)
failure/completion reporting through injected callbacks.

## Requirements

### Requirement: Batched upload runs with bounded concurrency and per-file progress

`@epam/ai-dial-chat-hooks` SHALL export `useDialFileUploadBatch`, which
uploads a batch of files with `UPLOAD_CONCURRENCY` (3) parallel workers
pulling from a shared cursor, tracking each file's status
(`Queued → Uploading → Completed | Failed | Cancelled`) and progress
percentage in `uploadBatchState`, via the injected `DialFilesApi.uploadFile`.

#### Scenario: At most three files upload concurrently

- **WHEN** a batch of five files is uploaded
- **THEN** no more than three `DialFilesApi.uploadFile` calls are in flight
  at once, with the remaining two queued until a worker frees up

#### Scenario: Per-file progress updates the batch state

- **WHEN** `DialFilesApi.uploadFile`'s `onProgress` callback fires for a file
- **THEN** that file's entry in `uploadBatchState.files` reflects the
  updated percentage without affecting other files' entries

### Requirement: Conflict resolution decides overwrite vs. create-only per file at upload time

`onValidateUpload` SHALL sanitize every file's name via `sanitizeFileName`
and always resolve `{ valid: true }`; the overwrite-vs-create-only decision
SHALL be deferred to upload time, computed per file from a case-insensitive
comparison of the sanitized name against the destination folder's cached
listing snapshot.

#### Scenario: A name collision with a cached sibling triggers overwrite mode

- **WHEN** a sanitized upload file name case-insensitively matches an
  existing entry in the destination folder's cache snapshot
- **THEN** that file uploads with `uploadMode: 'overwrite'`

#### Scenario: Validation never blocks on a name collision

- **WHEN** `onValidateUpload` is called for a batch containing a name
  collision
- **THEN** it still resolves `{ valid: true }` for every file

### Requirement: Cancellation aborts remaining queued and in-flight work

`cancelUpload` SHALL abort the batch's shared `AbortController`; workers
SHALL mark not-yet-started queued files `Cancelled` and distinguish an
aborted in-flight upload (`Cancelled`) from one that failed for another
reason (`Failed`).

#### Scenario: Cancelling a batch marks queued files Cancelled, not Failed

- **WHEN** `cancelUpload` is called while two files are queued and one is
  uploading
- **THEN** the queued files transition to `Cancelled`, and the in-flight
  file transitions to `Cancelled` if its own request observes the abort,
  or `Failed` if it fails for an unrelated reason first

### Requirement: Archive upload classifies partial vs. full failure

`onUploadArchive` SHALL call `DialFilesApi.uploadArchive`, and SHALL report,
through `onNotification`, a structured reason distinguishing: zero
successes (full failure, including up to the first 5 failed entry names),
some failures (partial failure with a count), and a request-level rejection
— each a distinct structured reason, not a pre-rendered string.

#### Scenario: Full archive-extraction failure lists failed entries up to a limit

- **WHEN** every entry in an uploaded archive fails to extract
- **THEN** `onNotification` receives a structured event listing up to 5
  failed entry names with an indication of how many more failed beyond
  that limit

### Requirement: A sanitized filename that loses its archive extension still routes to archive extraction

The hook SHALL detect the case where a single `.zip`-content file's display
name was sanitized in a way that removes the `.zip` suffix, and SHALL still
route that file through archive-extraction upload rather than a plain
file upload.

#### Scenario: Sanitization removing the .zip suffix still triggers archive extraction

- **WHEN** a single uploaded file has ZIP content but its sanitized display
  name no longer ends in `.zip`
- **THEN** the hook uploads it via `onUploadArchive`'s path, not a plain
  file upload

### Requirement: Upload failures and completion are reported through injected callbacks, not app services

The hook SHALL NOT import `react-i18next` or any application notification
service; on batch completion it SHALL report success or failure counts
through `onNotification` with a structured reason, and SHALL always
invalidate the destination folder and clear its internal upload state in a
`finally`-equivalent path regardless of outcome.

#### Scenario: Batch completion always invalidates the destination folder

- **WHEN** a plain-file upload batch completes, whether every file
  succeeded, some failed, or the batch was cancelled
- **THEN** the destination folder's cache entry is invalidated and
  `uploadBatchState` is cleared
