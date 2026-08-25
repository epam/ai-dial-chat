## ADDED Requirements

### Requirement: Shared job-queue primitives for export and import
`@epam/ai-dial-chat-hooks` SHALL export `useConversationExport` and
`useConversationImport`, each returning a `jobs: ConversationTransferJob[]`
list plus `dismissJob`, `retryJob`, and `dismissAll`, built on one shared
internal queue primitive so both hooks share identical cancellation,
retry, and dismissal semantics. Job identity SHALL be library-owned
structured data (`ConversationTransferSubject`), never a pre-rendered
translated string.

#### Scenario: Independent concurrent jobs
- **WHEN** two export or import operations are started before either
  finishes
- **THEN** `jobs` contains both with independent `status`, and dismissing
  or retrying one does not affect the other

#### Scenario: Dismiss aborts an in-flight job
- **WHEN** `dismissJob(jobId)` is called while that job's status is
  `InProgress`
- **THEN** the job's underlying request is aborted and the job is removed
  from `jobs`

#### Scenario: Retry reuses the same job id
- **WHEN** `retryJob(jobId)` is called on a job whose status is `Failed`
- **THEN** the job's status returns to `InProgress` under the same `id`
  and the operation is re-attempted with its already-parsed/prepared state

#### Scenario: Dismiss-all aborts every in-flight job
- **WHEN** `dismissAll()` is called while one or more jobs are
  `InProgress`
- **THEN** every in-flight request is aborted and `jobs` becomes empty

#### Scenario: Unmount aborts every in-flight job
- **WHEN** the component using either hook unmounts while jobs are
  `InProgress`
- **THEN** every in-flight request's underlying `AbortController` is
  aborted

#### Scenario: All-conversations subject is structured, not translated text
- **WHEN** `exportAll()` is called, or `importConversations(file)` is
  called with a file containing more than one conversation
- **THEN** the resulting job's `subject.kind` is
  `ConversationTransferSubjectKind.All`, carrying no translated text

### Requirement: Injected generated-client operations, never a configured singleton
`useConversationExport` and `useConversationImport` SHALL accept minimal
`Pick<ConversationsApi, …>` / `Pick<FilesApi, …>` interfaces from
`@epam/ai-dial-chat-api-client` as parameters and SHALL NOT import a
configured client instance, a `server-api` wrapper, or any app context.

#### Scenario: Export operates only through injected operations
- **WHEN** `exportSingle`/`exportAll` runs
- **THEN** the only conversation/file data access is through the
  `conversationsApi`/`filesApi` parameters passed into
  `useConversationExport`

#### Scenario: Import operates only through injected operations
- **WHEN** `importConversations` runs
- **THEN** the only conversation/file data access is through the
  `conversationsApi`/`filesApi` parameters passed into
  `useConversationImport`, and the target `bucket` comes from the
  `bucket` parameter, not a `UserContext` read

### Requirement: Structured success, warning, and error events
Both hooks SHALL report outcomes through optional `onSuccess`, `onWarning`,
and `onError` callbacks carrying library-owned event codes and
interpolation-ready facts (job id, conversation titles, skipped-attachment
names, a resolved trace id), never translated text or a `NotificationContext`
call made by the library itself.

#### Scenario: Successful export reports affected titles
- **WHEN** `exportSingle` completes successfully
- **THEN** `onSuccess` is called with an event whose `titles` includes the
  exported conversation's title

#### Scenario: Attachment skipped during export is a warning, not an error
- **WHEN** an attachment referenced by the conversation cannot be
  downloaded for a reason other than an unauthorized response
- **THEN** the job still reaches `Success`, and `onWarning` is called with
  `ConversationTransferWarningCode.AttachmentSkipped` and the skipped
  file's name

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

### Requirement: Attachment-aware export and import preserve DIAL/ZIP format semantics
The hooks SHALL preserve the existing JSON v5 envelope format, the
`.dial`/`.zip` archive format (including old-chat archive layouts), export
attachment concurrency limits, and import name-collision/conflict-retry
behavior exactly as implemented today.

#### Scenario: Export bundles referenced attachments once each
- **WHEN** a conversation's attachment is referenced by more than one
  message and `exportSingle` is called with attachments included
- **THEN** the resulting archive contains exactly one copy of that
  attachment's bytes

#### Scenario: Import retries a name collision under a suffixed name
- **WHEN** an archive attachment's upload path already exists in the
  destination folder
- **THEN** the import retries the upload under a ` (n)`-suffixed name, up
  to the configured retry limit, before reporting the attachment as
  skipped
