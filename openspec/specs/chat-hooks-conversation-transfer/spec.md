# chat-hooks-conversation-transfer Specification

## Purpose

Reusable conversation export/import hooks exported by `@epam/ai-dial-chat-hooks`, sharing one job-queue primitive and driven entirely by injected generated-client operations and structured, translation-free outcome events.

## Requirements

### Requirement: Shared job-queue primitives for export and import
`@epam/ai-dial-chat-hooks` SHALL export `useConversationExport` and
`useConversationImport`, each returning a `jobs: ConversationTransferJob[]`
list plus `cancelJob`, `dismissJob`, `retryJob`, and `dismissAll`, built on one shared
internal queue primitive so both hooks share identical cancellation,
retry, and dismissal semantics. Job identity SHALL be library-owned
structured data (`ConversationTransferSubject`), never a pre-rendered
translated string.

Every job SHALL additionally carry a `fileName: string` — the name of the file it writes or reads,
known at enqueue time — and a `progress: ConversationTransferProgress` maintained per the
`conversation-transfer-progress` capability. The queue primitive's `addJob` SHALL therefore take
both the subject and the file name.

`cancelJob(jobId)` and `dismissJob(jobId)` SHALL be distinct operations. Both abort the job's
in-flight request(s). `cancelJob` SHALL leave the job in `jobs` with status
`ConversationTransferJobStatus.Canceled`; `dismissJob` SHALL remove it from `jobs`. `cancelJob`
SHALL NOT discard the job's registered retry function, so a cancelled job remains retryable by a
host that chooses to offer it.

When a job fails, the queue SHALL record the reason on the job as
`errorCode: ConversationTransferErrorCode`, in addition to (not instead of) emitting the existing
`onError` event.

#### Scenario: Independent concurrent jobs
- **WHEN** two export or import operations are started before either
  finishes
- **THEN** `jobs` contains both with independent `status` and `progress`, and dismissing,
  cancelling, or retrying one does not affect the other

#### Scenario: Dismiss aborts an in-flight job
- **WHEN** `dismissJob(jobId)` is called while that job's status is
  `InProgress`
- **THEN** the job's underlying request is aborted and the job is removed
  from `jobs`

#### Scenario: Cancel aborts an in-flight job but keeps its row
- **WHEN** `cancelJob(jobId)` is called while that job's status is `InProgress`
- **THEN** the job's underlying request is aborted, the job stays in `jobs`, and its status becomes
  `Canceled`

#### Scenario: A cancelled job never produces output
- **GIVEN** an export job cancelled mid-attachment-download
- **WHEN** the aborted run unwinds
- **THEN** no blob download is triggered, no `onSuccess` is emitted, and the job's status stays
  `Canceled`

#### Scenario: Retry reuses the same job id
- **WHEN** `retryJob(jobId)` is called on a job whose status is `Failed`
- **THEN** the job's status returns to `InProgress` under the same `id`, its `progress.percent`
  resets to `0`, its `errorCode` is cleared, and the operation is re-attempted with its
  already-parsed/prepared state

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

#### Scenario: A failed job records its reason
- **WHEN** a job fails because the host's `classifyTransferError` reports `isUnauthorized: true`
- **THEN** the job's `errorCode` is `ConversationTransferErrorCode.Unauthorized` and `onError` is
  emitted with the same code

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

### Requirement: UI-facing transfer contract ownership
`@epam/ai-dial-chat-shared` SHALL canonically define the UI-facing transfer contracts:
`ConversationTransferJobStatus`, `ConversationTransferSubjectKind`, `ConversationTransferSubject`,
`ConversationTransferJob`, `ConversationTransferProgress`, `ConversationTransferUnitKind`, and
`ConversationTransferErrorCode`. `ConversationTransferJobStatus` SHALL carry the members
`InProgress`, `Success`, `Failed`, and `Canceled`.
`@epam/ai-dial-chat-hooks` SHALL NOT re-export any of them from its own barrel and SHALL NOT
declare a second, parallel definition of any of them — every consumer imports from the owning
package, per `remove-cross-package-reexports`. In particular `ConversationTransferErrorCode` SHALL
NOT remain declared in `libs/chat-hooks/src/conversation/conversation-transfer/types.ts`;
`chat-hooks`' own call sites, and every application call site that previously imported it from
`@epam/ai-dial-chat-hooks`, SHALL import it from `@epam/ai-dial-chat-shared`.
`useConversationTransferQueue`, `useConversationExport`, and `useConversationImport` SHALL continue
to use these types exactly as before; only the canonical declaration's package changes.

#### Scenario: `chat-hooks` neither redeclares nor re-exports the transfer contracts
- **WHEN** `libs/chat-hooks` is type-checked
- **THEN** `ConversationTransferJob` (and every other contract name above) resolves to the
  `chat-shared` declaration through a direct import, with no duplicate declaration and no
  forwarding export in `libs/chat-hooks/src/index.ts`

#### Scenario: The error taxonomy's importers move with it
- **WHEN** `apps/chat` imports `ConversationTransferErrorCode`
- **THEN** the import specifier is `@epam/ai-dial-chat-shared`, and importing it from
  `@epam/ai-dial-chat-hooks` is a type error

#### Scenario: The error taxonomy is reachable from a `type:ui` lib
- **WHEN** `libs/conversation-panel` imports `ConversationTransferErrorCode`
- **THEN** it resolves from `@epam/ai-dial-chat-shared` without `conversation-panel` gaining a
  dependency on `@epam/ai-dial-chat-hooks`

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

### Requirement: An oversized export archive fails as `FileTooLarge` rather than crashing the tab

`ConversationTransferErrorCode` SHALL include a `FileTooLarge` member. `useConversationExport` SHALL
accept an optional `maxArchiveBytes: number` parameter with a documented default. Before building a
`.dial` archive, the hook SHALL sum the byte length of the downloaded attachments and, if the total
exceeds `maxArchiveBytes`, SHALL fail the job with `FileTooLarge` without attempting the ZIP build.
The hook SHALL additionally treat a `RangeError` thrown out of `buildDialArchive` as `FileTooLarge`
rather than `Unknown`, since that is how a failed buffer allocation surfaces.

#### Scenario: An over-limit archive fails before the ZIP is attempted

- **GIVEN** a conversation whose attachments total more bytes than `maxArchiveBytes`
- **WHEN** the export-with-attachments job reaches the archive-build phase
- **THEN** the job's status is `Failed` with `errorCode` `FileTooLarge`, `buildDialArchive` is never
  called, and no partial file is downloaded

#### Scenario: An allocation failure is reported as too large, not unknown

- **GIVEN** an archive build that throws a `RangeError`
- **WHEN** the export job handles the error
- **THEN** the job's `errorCode` is `FileTooLarge`, not `Unknown`

#### Scenario: A within-limit export is unaffected

- **GIVEN** attachments totalling less than `maxArchiveBytes`
- **WHEN** the export runs
- **THEN** the archive is built and downloaded exactly as before
