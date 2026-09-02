## ADDED Requirements

### Requirement: Every transfer job carries determinate, monotonic progress

`@epam/ai-dial-chat-shared` SHALL define `ConversationTransferProgress` as
`{ percent: number; units?: { completed: number; total: number; kind: ConversationTransferUnitKind } }`
and `ConversationTransferUnitKind` as a string enum with members `Attachment` and `Conversation`.
Every `ConversationTransferJob` SHALL carry a non-optional `progress: ConversationTransferProgress`
from the moment it is added to the queue.

`percent` SHALL be an integer in the inclusive range `0..100`. It SHALL be monotonically
non-decreasing for the lifetime of a job id: a write that would lower it SHALL be discarded rather
than applied. There SHALL be no indeterminate state — a job is renderable as a determinate
indicator from its first frame.

`units` SHALL be present only while the transfer phase's unit count is known, and SHALL describe
the phase currently advancing (downloaded/uploaded attachments, or fetched/saved conversations),
never the whole job.

#### Scenario: A newly enqueued job is already determinate

- **WHEN** `addJob` adds a job to the queue
- **THEN** the job's `progress.percent` is `0` and `progress.units` is `undefined`

#### Scenario: Progress never runs backwards

- **GIVEN** a job whose `progress.percent` is `70`
- **WHEN** a progress write of `40` is applied for that job
- **THEN** the job's `progress.percent` remains `70`

#### Scenario: Concurrent attachment completions cannot lower progress

- **GIVEN** an export job downloading attachments at a concurrency of 5
- **WHEN** two attachment callbacks resolve in an interleaved order
- **THEN** `progress.percent` after both is the higher of the two computed values, never the lower

#### Scenario: Percent is clamped to the valid range

- **WHEN** a progress write computes a value above `100` or below `0`
- **THEN** the stored `progress.percent` is `100` or `0` respectively

### Requirement: Progress advances through fixed, kind-specific phase weights

Progress SHALL be computed from three phases — **prepare**, **transfer**, and **finalize** — whose
weights are fixed per transfer kind and sum to `100`. The transfer phase's weight SHALL be
subdivided evenly across the units discovered for that job (attachments to download/upload, or
conversations to fetch); the prepare and finalize weights SHALL NOT be subdivided.

The weights SHALL be:

| Transfer                          | Prepare | Transfer | Finalize |
| --------------------------------- | ------- | -------- | -------- |
| Export single, without attachments| 20      | 0        | 80       |
| Export single, with attachments   | 15      | 70       | 15       |
| Export all                        | 20      | 70       | 10       |
| Import                            | 10      | 70       | 20       |

Because the transfer phase's unit count is discovered only after the prepare phase completes,
learning that count SHALL NOT change `percent`; it SHALL only determine how the already-reserved
transfer weight is subdivided.

#### Scenario: Discovering the attachment count does not move the ring backwards

- **GIVEN** an export-with-attachments job that has completed its prepare phase at `15`
- **WHEN** the conversation is found to reference 10 attachments
- **THEN** `progress.percent` is still `15`, and each subsequent downloaded attachment adds `7`

#### Scenario: A phase with zero units is credited in full

- **GIVEN** an export-with-attachments job whose conversation references no attachments
- **WHEN** the prepare phase completes
- **THEN** `progress.percent` advances directly from `15` to `85` without stalling

#### Scenario: Import progress spans parse, upload, and save

- **GIVEN** an import of an archive holding 2 conversations and 4 attachments
- **WHEN** the file has been parsed, all 4 attachments uploaded, and 1 conversation saved
- **THEN** `progress.percent` is `90` (10 prepare + 70 transfer + 10 of the 20 finalize weight)

### Requirement: Reaching a terminal status settles progress

A job reaching `Success` SHALL have `progress.percent` set to `100`, regardless of the value the
phase arithmetic produced. A job reaching `Failed` or `Canceled` SHALL retain the last `percent`
it reached, and SHALL NOT be advanced further.

#### Scenario: Success completes the ring

- **GIVEN** a job whose phase arithmetic left `progress.percent` at `98`
- **WHEN** the job's status becomes `Success`
- **THEN** `progress.percent` is `100`

#### Scenario: Cancelling freezes progress where it stopped

- **GIVEN** an in-progress job at `progress.percent` `42`
- **WHEN** the user cancels it
- **THEN** the job's status is `Canceled` and `progress.percent` stays `42`

#### Scenario: An aborted run cannot advance a settled job

- **GIVEN** a job that has been cancelled while attachment downloads were in flight
- **WHEN** one of those aborted requests would otherwise report a completed unit
- **THEN** the job's `progress.percent` is unchanged

### Requirement: Progress is a contract on the job, not rendered by the queue

`progress.percent` and `progress.units` SHALL be computed and carried on the job for hosts to read,
but the transfer queue SHALL NOT render either value: an `InProgress` row shows the indeterminate
UI kit `Spinner` (see `conversation-panel-transfer-queue-ui`). Neither `libs/chat-shared` nor
`libs/conversation-panel` SHALL render or construct a translated unit string.

#### Scenario: The row surfaces activity, not completion

- **GIVEN** a job whose `progress` is `{ percent: 36, units: { completed: 3, total: 10, kind: Attachment } }`
- **WHEN** the row renders
- **THEN** neither the percentage nor the unit counts appear in the DOM or in any ARIA attribute

#### Scenario: The contract is still available to the host

- **GIVEN** a host reading `jobs` from `useConversationExport` or `useConversationImport`
- **WHEN** attachment units complete
- **THEN** `progress.percent` advances monotonically and `progress.units` reports the counts
