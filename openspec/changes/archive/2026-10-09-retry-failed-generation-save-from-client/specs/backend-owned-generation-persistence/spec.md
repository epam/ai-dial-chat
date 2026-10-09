## MODIFIED Requirements

### Requirement: Exactly one terminal write attempt, and cancellation never adds or replaces one

This requirement SHALL apply to the Chat Completions and stateless Responses paths. On the background path, terminal writes follow `background-responses-generation` "Every background write applies only to the same pending generation": more than one writer and a bounded retry on a version conflict are allowed there, and exactly one terminal state is guaranteed by that storage-side precondition instead of by a single attempt.

A generation SHALL attempt at most one terminal write. The worker SHALL record that the terminal write has been dispatched before awaiting it, and from that point:

- A cancellation request of any reason SHALL be recorded for logging and telemetry only. It SHALL NOT change the persisted outcome, SHALL NOT trigger a second write, and SHALL NOT cancel the dispatched write.
- A cancellation that arrives while the generation is still running SHALL set its reason before the worker's single classification read, so the worker's outcome reflects it.
- When a cancellation and a normal completion race, whichever reaches settlement first determines the outcome and the other is a no-op.

The pre-stream failure paths SHALL remain write-free: a failure resolving the deployment's generation capability, fetching the conversation, or building its history SHALL release the registry entry and rethrow **without** performing any conversation write. A preflight failure SHALL NOT invent a terminal save.

A rejected terminal write SHALL be logged and reported as a persistence error on the open completion stream and to generation-attach subscribers, and the entry SHALL settle and release its key. The completion stream SHALL use its existing error envelope with type `conversation_save_failed` and safe fallback text. When the rejected write belonged to a completed answer (the model finished, not stopped, aborted, or failed) and raised an HTTP error, the envelope SHALL also carry that error's status as a numeric `status` field, for example `{"error": {"type": "conversation_save_failed", "message": "…", "status": 401}}`: `401` when DIAL Core rejected the credentials, and the status of the mapped error otherwise (a storage `5xx` surfaces as `502`). In every other case the envelope SHALL omit `status`. In particular, a stopped, aborted, or failed answer's write carries terminal markers (`wasStoppedByUser`, or a `streamErrorMessage`) that the client does not hold. The field carries only the status code, never the storage response body, credentials, or other upstream detail. Generation-attach `error` events are unchanged. This applies to successful, stopped, and failed model outcomes; a storage failure SHALL NOT be reported as a successful save. The backend SHALL make no automatic second write. A single recovery save that the client which started the generation sends after this error is reported to its completion stream with `status: 401` (`chat-hooks-conversation-stream` "A credentials-rejected terminal save gets one client recovery save") is a separate client conversation save, authorized by that request's own session, and SHALL NOT be treated as a second terminal write of this generation. A `401` rejection means the write was refused before anything was stored, so that save cannot duplicate a committed terminal write. A delivered terminal event, a released registry entry, and a recorded `dial.chat.completion.response.terminations` point SHALL NOT be treated as evidence that the conversation was durably persisted.

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

#### Scenario: A rejected terminal write is not retried by the backend

- **WHEN** the terminal write is rejected and `conversation_save_failed` is reported on the open completion stream
- **THEN** the backend issues no further write for that generation, and any later save of that answer arrives as a separate client conversation save

#### Scenario: An answer that did not complete is reported without a status

- **WHEN** the terminal write of a stopped, aborted, or failed answer is rejected with `401`
- **THEN** the open completion stream receives `conversation_save_failed` without `status`, so the client shows the persistence warning and makes no recovery save

#### Scenario: A credentials-rejected terminal write reports its status

- **WHEN** the terminal write of a completed answer is rejected with `401`
- **THEN** the open completion stream receives `conversation_save_failed` with `status: 401` and the unchanged safe fallback text, and an attach subscriber receives its `error` event unchanged

### Requirement: Terminal read failures are distinct from persistence failures

`useConversationStream` SHALL own transient, per-conversation reload-error state separately from message `streamErrorMessage`. When the terminal conversation read rejects, it SHALL retain all received assistant payload, settle streaming controls, and expose a reload notification and retry through its result. A read rejection alone SHALL NOT create `GenerationPersistenceError`, add an unsaved-answer warning, or claim that persistence succeeded. The library SHALL use the injected `ConversationStreamTransport.getConversation`; endpoint paths, translated UI, and client configuration SHALL remain app-owned.

Retry SHALL only repeat the read and existing reconciliation. It SHALL NOT start a completion or save a conversation, and concurrent retries for the same failure SHALL be deduplicated. A successful read SHALL clear the reload notification and apply server enrichment, preserve the existing empty-placeholder protection, or resume a pending background generation as appropriate. Explicit `conversation_save_failed` events SHALL retain their existing warning behavior, except that a `401` failure on a stream this tab started defers the warning to its single recovery save, as `chat-hooks-conversation-stream` "A credentials-rejected terminal save gets one client recovery save" defines. A failure is local to the mounted hook, keyed by conversation path and buffer ownership, and invalidated by successful reconciliation or a newer generation; no durable cache or TTL is introduced. Stable callbacks SHALL use `useCallback`.

No endpoint, generated-client, authorization, feature-flag, metric, or analytics contract changes. Read failures SHALL NOT be reported as synthetic persistence failures to `onStreamError`.

#### Scenario: Reading fails after a completed reply

- **WHEN** a terminal GET rejects after text or custom content was received
- **THEN** the reply remains visible, streaming controls settle, and only the separate reload notification appears

#### Scenario: Retry applies saved server data

- **WHEN** the user retries a failed terminal read and the GET returns the completed answer
- **THEN** server-enriched data replaces the buffered answer and the reload notification disappears without a completion or save request

#### Scenario: Navigation restores a stale conversation snapshot

- **WHEN** a terminal read fails for an initiating or attached stream and the host later loads a stale user-only snapshot of that conversation
- **THEN** the hook restores the complete buffered assistant message and retains the reload notification without restarting generation
- **AND** the hook discards the buffer and clears the notification only when the loaded conversation reaches the buffered message index, has an assistant message at that index, and is not awaiting generation resume

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
