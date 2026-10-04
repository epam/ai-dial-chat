## ADDED Requirements

### Requirement: Terminal read failures are distinct from persistence failures

`useConversationStream` SHALL own transient, per-conversation reload-error state separately from message `streamErrorMessage`. When the terminal conversation read rejects, it SHALL retain all received assistant payload, settle streaming controls, and expose a reload notification and retry through its result. A read rejection alone SHALL NOT create `GenerationPersistenceError`, add an unsaved-answer warning, or claim that persistence succeeded. The library SHALL use the injected `ConversationStreamTransport.getConversation`; endpoint paths, translated UI, and client configuration SHALL remain app-owned.

Retry SHALL only repeat the read and existing reconciliation. It SHALL NOT start a completion or save a conversation, and concurrent retries for the same failure SHALL be deduplicated. A successful read SHALL clear the reload notification and apply server enrichment, preserve the existing empty-placeholder protection, or resume a pending background generation as appropriate. Explicit `conversation_save_failed` events SHALL retain their existing warning behavior. A failure is local to the mounted hook, keyed by conversation path and buffer ownership, and invalidated by successful reconciliation or a newer generation; no durable cache or TTL is introduced. Stable callbacks SHALL use `useCallback`.

No endpoint, generated-client, authorization, feature-flag, metric, or analytics contract changes. Read failures SHALL NOT be reported as synthetic persistence failures to `onStreamError`.

#### Scenario: Reading fails after a completed reply

- **WHEN** a terminal GET rejects after text or custom content was received
- **THEN** the reply remains visible, streaming controls settle, and only the separate reload notification appears

#### Scenario: Retry applies saved server data

- **WHEN** the user retries a failed terminal read and the GET returns the completed answer
- **THEN** server-enriched data replaces the buffered answer and the reload notification disappears without a completion or save request

#### Scenario: Retry fails again or is clicked twice

- **WHEN** a retry is pending or rejects again
- **THEN** the payload and notification remain, at most one retry is in flight for that failure, and the control becomes available again after rejection

#### Scenario: Retry returns an unresolved placeholder

- **WHEN** retry succeeds but returns the unresolved non-background empty assistant placeholder after output was received
- **THEN** the reload notification clears, the received payload remains, and the existing persistence warning is shown

#### Scenario: Retry returns a pending background generation

- **WHEN** retry of the initiating stream's terminal read returns a pending background message
- **THEN** the reload notification clears and existing attach recovery resumes with the buffered answer as seed

#### Scenario: Navigation or a new generation supersedes retry

- **WHEN** a retry completes after navigation, unmount, or replacement of its generation
- **THEN** it cannot overwrite another displayed conversation or a newer generation, and an old failure cannot label the newer answer

## MODIFIED Requirements

### Requirement: Exactly one terminal write attempt, and cancellation never adds or replaces one

This requirement SHALL apply to the Chat Completions and stateless Responses paths. On the background path, terminal writes follow `background-responses-generation` "Every background write applies only to the same pending generation": more than one writer and a bounded retry on a version conflict are allowed there, and exactly one terminal state is guaranteed by that storage-side precondition instead of by a single attempt.

A generation SHALL attempt at most one terminal write. The worker SHALL record that the terminal write has been dispatched before awaiting it, and from that point:

- A cancellation request of any reason SHALL be recorded for logging and telemetry only. It SHALL NOT change the persisted outcome, SHALL NOT trigger a second write, and SHALL NOT cancel the dispatched write.
- A cancellation that arrives while the generation is still running SHALL set its reason before the worker's single classification read, so the worker's outcome reflects it.
- When a cancellation and a normal completion race, whichever reaches settlement first determines the outcome and the other is a no-op.

The pre-stream failure paths SHALL remain write-free: a failure resolving the deployment's generation capability, fetching the conversation, or building its history SHALL release the registry entry and rethrow **without** performing any conversation write. A preflight failure SHALL NOT invent a terminal save.

A rejected terminal write SHALL be logged and reported as a persistence error on the open completion stream and to generation-attach subscribers, and the entry SHALL settle and release its key. The completion stream SHALL use its existing error envelope with type `conversation_save_failed` and safe fallback text. This applies to successful, stopped, and failed model outcomes; a storage failure SHALL NOT be reported as a successful save. There SHALL be no automatic second write. A delivered terminal event, a released registry entry, and a recorded `dial.chat.completion.response.terminations` point SHALL NOT be treated as evidence that the conversation was durably persisted.

#### Scenario: Cancellation arriving after the terminal write was dispatched does not add a second write

- **GIVEN** a worker has dispatched its terminal write and is awaiting it
- **WHEN** a user Stop, a stale cancellation, or a max-duration timeout occurs
- **THEN** exactly one write was issued for that generation, the persisted outcome is the one the dispatched write carries, and the cancellation is recorded without changing it

#### Scenario: A pre-stream failure releases the entry without writing

- **WHEN** registration succeeds and the subsequent generation-capability resolution or `getConversation` throws
- **THEN** the backend releases the registry entry and rethrows, no `saveConversation` call is made on that path, and a retry is not rejected with 409

#### Scenario: A terminal write that is already dispatched cannot be fenced by an identity check

- **GIVEN** a worker checked its lease identity and then dispatched its terminal write
- **WHEN** that write is in flight
- **THEN** the capability makes no claim that the write can be prevented, cancelled, or proven uncommitted; safety instead rests on no replacement being admitted while the entry is owned

#### Scenario: Background terminal writes may retry

- **GIVEN** a background generation's final write receives a version conflict caused by an unrelated writer
- **WHEN** the re-read shows the message still `pending` with the same `generationId`
- **THEN** the backend writes again (bounded to 3 attempts), which this requirement does not forbid on the background path
