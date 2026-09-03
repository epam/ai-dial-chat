## MODIFIED Requirements

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

## ADDED Requirements

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
