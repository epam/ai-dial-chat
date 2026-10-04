# Spec Delta

## MODIFIED Requirements

### Requirement: Backend persists the conversation across the generation lifecycle

`ConversationStreamingService.streamCompletion` (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`, invoked via the `ConversationService` facade) SHALL own conversation persistence for a completion. The frontend MUST NOT call `saveConversation` during streaming. The backend SHALL save at the start of generation (user message + empty assistant placeholder), on successful completion (full assembled assistant message), and on stop/error (the partial assistant message accumulated so far).

A failure of the **start-state** save SHALL be logged as a warning and SHALL NOT abort the request: the stream still opens, and the terminal save that follows writes the conversation anyway. Losing the placeholder costs a resumable mid-flight view; refusing to stream because of it would cost the answer itself.

On the background path defined by `background-responses-generation`, the start-state save is the placeholder that carries the background association and gates the Core job: a storage failure SHALL NOT abort the request either, but the request SHALL continue on the stateless Responses path (with its best-effort start save) instead of creating a background job, and a version conflict SHALL end the request with `409` before any Core call. On that path the final, stopped, and failed states are taken from DIAL Core's retrieved response rather than from an assembled message, and are written as defined there.

The terminal save SHALL distinguish how the generation ended:

| Outcome | Persisted marker | Registry status |
|---|---|---|
| Upstream reached `[DONE]` | assembled message, no marker | `Done` |
| Upstream rejected the request | `streamErrorMessage` = DIAL Core text, or `''` when it gave none | `Error` |
| The user pressed Stop | `wasStoppedByUser: true`, **no** `streamErrorMessage` | `Stopped` |
| Aborted for any other reason (e.g. the relay itself threw before producing a result) | `streamErrorMessage: ''` | `Error` |
| The relay itself threw (e.g. undici `TypeError: terminated` while reading the upstream body, a socket reset, a programming error) | `streamErrorMessage: ''` | `Error` |

`streamErrorMessage` SHALL only ever carry text that DIAL Core itself supplied as a user-facing error (a rejected request's error body, or an in-band `{error}` chunk's `displayMessage`/`message`). A thrown JavaScript error's `message` is transport or runtime detail: it SHALL be logged server-side through the service `Logger` with the full error, and SHALL NOT be persisted to, or relayed through the generation registry to, the user.

A user stop is deliberately not an error state: the frontend renders an empty stopped message with its "Stopped generating" label, which it can only do when no `streamErrorMessage` is present.

The downstream HTTP connection closing (browser tab closed, page navigated away, refresh) is explicitly **not** one of the outcomes in this table — see "A closed downstream response does not alter generation persistence or outcome" below. The terminal save and registry release MUST still run exactly once per generation regardless of *why* the generator stops iterating, but the only ways the generator's consuming loop legitimately stops iterating are the relay reaching a terminal outcome (`[DONE]`/error/stop) or an unexpected exception; a closed downstream response is not, by itself, a reason for the consuming loop to stop. The generator SHALL guarantee the exactly-once terminal save/release via its own cleanup (e.g. a `finally` around its relay loop) for the exception case, since an abandoned consumer cannot itself invoke the generator's terminal logic.

#### Scenario: Start state saved before streaming

- **WHEN** a completion request is accepted
- **THEN** the backend saves the conversation with the new user message and an empty assistant placeholder before opening the upstream stream

#### Scenario: Final state saved on completion

- **WHEN** the upstream stream emits `[DONE]`
- **THEN** the backend writes the fully assembled assistant message at the placeholder index and saves the conversation

#### Scenario: Partial state saved on error

- **WHEN** the upstream stream fails before `[DONE]`
- **THEN** the backend saves the partial assistant message with `streamErrorMessage` set — carrying the DIAL Core error text when one is available, or an empty string when no upstream text exists (empty body, non-user abort, relay throw). The presence of the field (even `''`) is the terminal-error signal; the frontend localizes a generic fallback when the value is empty.

#### Scenario: A mid-stream transport abort persists no raw error text

- **WHEN** reading the upstream stream throws `TypeError('terminated')` after some content was already assembled
- **THEN** the backend saves the partial assistant message (assembled content preserved) with `streamErrorMessage: ''`, finalizes the generation as `Error` with an empty message, and logs the thrown error via `Logger.error`; the string `terminated` is not present in the saved conversation

#### Scenario: DIAL Core-supplied error text is still persisted

- **WHEN** DIAL Core rejects the request with an error body, or emits an in-band `{error:{message}}` chunk
- **THEN** the persisted `streamErrorMessage` is that DIAL Core text, unchanged by this requirement

#### Scenario: A Responses stream that ends without a terminal signal persists no internal text

- **WHEN** a Responses API stream ends with no recognized terminal event (no `response.completed`, `response.failed`, `response.incomplete`, or `error` event)
- **THEN** the persisted `streamErrorMessage` is `''`, not the adapter's internal "ended before completion" diagnostic, and that diagnostic is logged server-side instead

#### Scenario: A Responses terminal failure keeps its upstream message
- **WHEN** a Responses API stream ends with `response.failed`, `response.incomplete`, or an `error` event carrying a message
- **THEN** the persisted `streamErrorMessage` is that upstream message

#### Scenario: A user stop is not persisted as an error

- **WHEN** the generation is aborted and the registry already records it as stopped by the user
- **THEN** the partial message is saved with `wasStoppedByUser: true` and no `streamErrorMessage`, and the generation is finalized as `Stopped`

#### Scenario: A failed start-state save does not abort the stream

- **WHEN** the start-state `saveConversation` rejects
- **THEN** the failure is logged as a warning and the completion request proceeds to stream normally

#### Scenario: A failed background placeholder save falls back to the stateless path

- **WHEN** a background-eligible request's placeholder save rejects with a storage error
- **THEN** the failure is logged as a warning, no background job is created, and the request streams on the stateless Responses path

### Requirement: Exactly one terminal write attempt, and cancellation never adds or replaces one

This requirement applies to the Chat Completions and stateless Responses paths. On the background path, terminal writes follow `background-responses-generation` "Every background write applies only to the same pending generation": more than one writer and a bounded retry on a version conflict are allowed there, and exactly one terminal state is guaranteed by that storage-side precondition instead of by a single attempt.

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

### Requirement: Fencing guarantees are process-local, and storage-side fencing is not claimed

This capability SHALL distinguish which guarantees are process-local from which rely on a DIAL Core contract, and SHALL distinguish the non-background paths (Chat Completions and stateless Responses) from the background path defined by `background-responses-generation`.

Process-local, and guaranteed on the non-background paths: admission of at most one owner per `ownerKey + path`; internal operation identity; cancellation propagation through the entry's `AbortController`; single idempotent settlement; and the consequence that no second worker holds a key while an older write is outstanding.

Not guaranteed on the non-background paths: that a write already handed to the persistence adapter has not committed and will not commit. In particular, a lease or generation-id check placed before awaiting the write does not fence a write that has already been issued; racing the write against a timeout does not cancel it; and aborting the underlying HTTP request would not prove the storage server has neither committed nor will commit it. The generation registry is process-local and is not a cross-pod coordination mechanism. Non-background writes SHALL remain unconditional.

On the background path, writes to the conversation (placeholder, `responseId`, final, stopped, failed, expired, interrupted) SHALL be conditional: each SHALL send `If-Match` with the `ETag` of the conversation version it read, and SHALL apply its change only if that version's last assistant message still satisfies the write's precondition (`pending` with the same `generationId`, or for the placeholder: the conversation version the request started from). A `412` SHALL cause a re-read and a re-check, bounded to 3 attempts. The persistence port SHALL expose this conditional write for the background path only. Because background-path writers can run on different instances, correctness on that path rests on this storage-side precondition rather than on process-local admission; the spike SHALL verify that DIAL Core returns an `ETag` on read and honors `If-Match` with `412`.

Unrelated writers to the same conversation path SHALL be named explicitly rather than assumed absent. `ConversationPersistenceService.saveConversation` performs an awaited display-name-preservation read before its write, and then fire-and-forget schedules `ConversationNamingService.maybeRenameAfterFirstReply`, which is an independent asynchronous writer that can write after a generation has released ownership. It re-reads the conversation and writes the **whole** conversation with the new display name and naming-done marker. It SHALL therefore write conditionally (`If-Match` with the `ETag` of its re-read, bounded re-read and retry on `412`), so it can never write back a stale copy of a message — in particular a background message that was `pending` when it read. A naming write that interleaves with a background write causes that write's `412`, which the bounded re-read handles.

Client full-body saves through `PUT /api/v1/conversations` (rating, message delete, settings, system prompt, status messages, overlay bridge) are the other writers to the same path; on the background path they are governed by `background-responses-generation` "Client conversation saves cannot change a pending background message".

#### Scenario: The asynchronous naming writer can write after ownership is released

- **GIVEN** a generation settled and released its registry key, and a naming write it scheduled is still in flight
- **WHEN** that naming write completes
- **THEN** it updates the conversation's display name and naming-done marker on the version it re-read, and a `412` makes it re-read instead of overwriting a newer write

#### Scenario: No storage-side fencing is asserted

- **WHEN** a terminal write is performed for a Chat Completions or stateless Responses generation
- **THEN** it is issued without a conditional-write precondition, and correctness rests on process-local admission

#### Scenario: Background writes are conditional

- **WHEN** a background-path write is performed
- **THEN** it carries `If-Match` with the `ETag` of the version it read, and is skipped if the re-read shows the message is no longer `pending` with the same `generationId`

#### Scenario: A naming write between read and write is retried

- **GIVEN** a background finalizer read the conversation, then the naming writer updated the display name
- **WHEN** the finalizer's conditional write receives `412`
- **THEN** it re-reads, finds the message still `pending` with its `generationId`, and writes again with the new `ETag`

### Requirement: Terminal reloads cannot erase received assistant payload

A client SHALL retain its accumulated assistant payload on an explicit persistence error or when a terminal reload returns the unresolved empty placeholder at that generation's assistant index. It SHALL show an app-localized warning that server persistence is unconfirmed and a page reload can lose the local answer. It SHALL preserve text and custom content together and SHALL NOT attempt a client-side save. Successful reloads SHALL still replace local state with server-persisted data. A reload that returns a conversation containing a background message with `status: "pending"` is neither a persistence error nor an unresolved placeholder for this requirement: the client SHALL resume through attach as `chat-hooks-conversation-stream` "A stream that ends on a pending background message resumes" defines, and the answer is restored by Core replay rather than by the retained local payload. A superseded generation or another displayed conversation SHALL NOT receive stale restoration.

`useConversationStream` SHALL own the retained message in its existing per-conversation buffer, including buffers assembled by `createResumeIfAwaitingGeneration`. The buffer lasts only within the mounted hook and is replaced by a new generation; it introduces no durable cache or cache TTL. Apps SHALL supply translated warning text through the optional `generationPersistenceErrorMessage` parameter using `chat.generationPersistenceError`; independently embedded hosts can use the safe default. The warning SHALL use the existing message `role="alert"` surface alongside the answer on mobile and desktop. It introduces no new controls or directional layout; existing RTL rendering and keyboard behavior remain applicable. This behavior is not feature-gated and requires no new memoisation, metrics, REST endpoint, OpenAPI schema, or generated-client method. The existing terminal-save logger SHALL retain the original failure server-side while the client receives safe text.

#### Scenario: Empty terminal read after visible text and stages

- **WHEN** a client receives text and stages and its completion reload returns the unresolved assistant placeholder
- **THEN** the text and stages remain visible with a persistence warning and streaming controls settle

#### Scenario: Server enrichment survives a successful save

- **WHEN** the terminal reload contains the saved answer with server-enriched attachment data
- **THEN** the client uses the server answer without adding a persistence warning

#### Scenario: A newer generation supersedes a pending reload

- **WHEN** another generation starts before the prior generation's terminal reload returns
- **THEN** the old callback cannot restore its content over the new generation

#### Scenario: Reload shows a pending background message

- **WHEN** a client's completion stream ends cleanly and the reload returns the conversation with its background message still `pending`
- **THEN** the client shows no persistence warning and resumes through attach, which replays the answer
