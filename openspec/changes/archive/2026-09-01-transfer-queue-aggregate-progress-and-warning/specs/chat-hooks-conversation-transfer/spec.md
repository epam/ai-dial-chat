## MODIFIED Requirements

### Requirement: Structured success, warning, and error events
Both hooks SHALL report outcomes through optional `onSuccess`, `onWarning`,
and `onError` callbacks carrying library-owned event codes and
interpolation-ready facts (job id, conversation titles, skipped-attachment
names, a resolved trace id), never translated text or a `NotificationContext`
call made by the library itself. A warning SHALL additionally settle its job
into the `Warning` status rather than `Success`, so that a partially-complete
transfer is distinguishable from a clean one without reading the event stream.

#### Scenario: Successful export reports affected titles
- **WHEN** `exportSingle` completes successfully
- **THEN** `onSuccess` is called with an event whose `titles` includes the
  exported conversation's title

#### Scenario: Attachment skipped during export is a warning, not an error
- **WHEN** an attachment referenced by the conversation cannot be
  downloaded for a reason other than an unauthorized response
- **THEN** the job reaches `Warning` carrying `warningCode`
  `ConversationTransferWarningCode.AttachmentSkipped`, and `onWarning` is
  called with the same code and the skipped file's name

#### Scenario: A warned job still delivers its file
- **WHEN** an export completes with some attachments skipped
- **THEN** the archive is still downloaded and the job's `progress.percent`
  settles at complete, exactly as for a clean success

#### Scenario: Unauthorized error surfaces no toast-worthy event
- **WHEN** any request in a job fails because the host's injected
  `classifyTransferError` reports `isUnauthorized: true`
- **THEN** the job reaches `Failed` and neither `onSuccess` nor `onWarning`
  is called; `onError` is called with
  `ConversationTransferErrorCode.Unauthorized`

#### Scenario: Import of an unsupported file format
- **WHEN** `importConversations(file)` is called with a file that is
  neither valid JSON v5 nor a valid `.dial`/`.zip` archive
- **THEN** no job is added to `jobs`, and `onError` is called with
  `ConversationTransferErrorCode.UnsupportedFormat`

#### Scenario: Import with no resolved bucket
- **WHEN** `importConversations(file)` is called while the `bucket`
  parameter is `undefined`
- **THEN** the job reaches `Failed` and `onError` is called with
  `ConversationTransferErrorCode.MissingBucket`

## ADDED Requirements

### Requirement: The queue settles warned jobs through a dedicated helper

`useConversationTransferQueue` SHALL expose
`warnJob(jobId, warningCode: ConversationTransferWarningCode)`, which settles the job with status
`Warning`, `progress.percent` at complete, the warning code attached, and any `errorCode` cleared.
It SHALL obey the same already-settled guard as `succeedJob`, `failJob`, and `cancelJob`: a write
against a job that has already reached a terminal status is discarded.

#### Scenario: A warned job settles like a success, but distinguishably

- **WHEN** `warnJob(jobId, AttachmentSkipped)` is called on an `InProgress` job
- **THEN** the job's status is `Warning`, its `warningCode` is `AttachmentSkipped`, its
  `progress.percent` is complete, and its `errorCode` is `undefined`

#### Scenario: An aborted run cannot warn a settled job

- **GIVEN** a job that has already been canceled
- **WHEN** an in-flight request unwinds and calls `warnJob` for it
- **THEN** the job's status remains `Canceled` and no `warningCode` is attached
