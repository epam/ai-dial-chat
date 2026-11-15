## MODIFIED Requirements

### Requirement: Backend persists the conversation across the generation lifecycle

`ConversationStreamingService.streamCompletion` (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`, invoked via the `ConversationService` facade) SHALL own conversation persistence for a completion. The frontend MUST NOT call `saveConversation` during streaming. The backend SHALL save at the start of generation (user message + empty assistant placeholder), on successful completion (full assembled assistant message), and on stop/error (the partial assistant message accumulated so far).

On the Chat Completions and stateless Responses paths, the **start-state** save is the conditional write that stores the generation's `foregroundGeneration` marker, as `foreground-generation-lock` defines. Any failure of it SHALL end the request before SSE headers are sent, with the status the exception filter maps it to: `409` for an active generation or persistent conflicts, the mapped storage status otherwise. The stream SHALL NOT open without that marker stored, because the terminal write applies only to the generation's own marker. Before this change a failed start-state save was logged and the stream opened anyway. That made the terminal write the only write, and it is what let a second writer's exchange be overwritten.

On the background path defined by `background-responses-generation`, the start-state save is the placeholder that carries the background association and gates the Core job:

- a storage failure SHALL NOT abort the request; the request SHALL instead continue on the stateless Responses path instead of creating a background job. There the conditional start-state write above applies, and it ends the request if it fails too;
- a version conflict SHALL end the request with `409` before any Core call.

On that path the final, stopped and failed states are taken from DIAL Core's retrieved response rather than from an assembled message, and are written as defined there.

The terminal save SHALL distinguish how the generation ended:

| Outcome | Persisted marker | Registry status |
|---|---|---|
| Upstream reached `[DONE]` | assembled message, no marker | `Done` |
| Upstream rejected the request | `streamErrorMessage` = DIAL Core text, or `''` when it gave none | `Error` |
| The user pressed Stop | `wasStoppedByUser: true`, **no** `streamErrorMessage` | `Stopped` |
| Aborted for any other reason (e.g. the relay itself threw before producing a result) | `streamErrorMessage: ''` | `Error` |
| The relay itself threw (e.g. undici `TypeError: terminated` while reading the upstream body, a socket reset, a programming error) | `streamErrorMessage: ''` | `Error` |

A Stop stored on the marker from another instance or by another writer (`foreground-generation-lock` "A Stop from any writer is stored on the marker") is a user stop and is persisted as one.

`streamErrorMessage` SHALL only ever carry text that DIAL Core itself supplied as a user-facing error: a rejected request's error body, or an in-band `{error}` chunk's `displayMessage`/`message`. A thrown JavaScript error's `message` is transport or runtime detail. It SHALL be logged server-side through the service `Logger` with the full error, and SHALL NOT be persisted to the user or relayed to them through the generation registry.

A user stop is deliberately not an error state: the frontend renders an empty stopped message with its "Stopped generating" label, which it can only do when no `streamErrorMessage` is present.

The downstream HTTP connection closing (browser tab closed, page navigated away, refresh) is explicitly **not** one of the outcomes in this table — see "A closed downstream response does not alter generation persistence or outcome" below.

The terminal save and registry release MUST still run exactly once per generation, whatever the reason the generator stops iterating. The consuming loop legitimately stops iterating only when the relay reaches a terminal outcome (`[DONE]`/error/stop) or on an unexpected exception; a closed downstream response is not, by itself, a reason to stop. For the exception case the generator SHALL guarantee the exactly-once terminal save/release through its own cleanup (e.g. a `finally` around its relay loop), since an abandoned consumer cannot itself invoke the generator's terminal logic.

#### Scenario: Start state saved before streaming

- **WHEN** a completion request is accepted
- **THEN** the backend stores the conversation with the new user message and an empty assistant placeholder carrying the generation's `foregroundGeneration` marker, with `If-Match`, before opening the upstream stream

#### Scenario: Final state saved on completion

- **WHEN** the upstream stream emits `[DONE]`
- **THEN** the backend writes the fully assembled assistant message onto the stored message carrying the generation's marker, removes the marker, and saves the conversation with `If-Match`

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

#### Scenario: A failed start-state save fails the request before streaming

- **WHEN** the start-state write rejects with a storage error
- **THEN** the request ends with the mapped status before SSE headers are sent, no upstream model request is made, and the registry entry is released

#### Scenario: A failed background placeholder save falls back to the stateless path

- **WHEN** a background-eligible request's placeholder save rejects with a storage error
- **THEN** the failure is logged as a warning, no background job is created, and the request continues on the stateless Responses path, whose conditional start-state write then decides whether it streams

### Requirement: A pre-stream failure releases the registry entry

If any step between registering the generation and opening the upstream stream **rejects**, the backend SHALL release the registry entry before rethrowing, so a transient failure does not lock the conversation. The steps are:

- resolving the deployment's generation capability;
- fetching the conversation;
- building its history;
- writing the start state.

**No conversation write on this path,** with one exception. Nothing has been assembled, and a preflight failure must not invent a terminal save. The exception is the release write that `foreground-generation-lock` "A generation that stored its marker always releases it" requires after a start-state write whose outcome is unknown. That write applies only when the generation's own marker was in fact stored, so it never changes a conversation the failed request did not write.

**Settlement.** Release SHALL be the entry's single settlement, so its max-duration timer, its attach listeners, its registry key, its preparation timer and its runtime generation tracking are all released exactly once.

Because `generation-registry` no longer removes or replaces an owned entry on `register`, this release is the only thing that frees the key after a preflight failure. A retry therefore succeeds immediately rather than waiting for any sweep.

**Pending steps.** A step that is still **pending** when `GENERATION_PREPARATION_TIMEOUT_MS` elapses is not a rejection, and SHALL NOT take this path.

- An abandoned preparation releases its subscribers but retains the key until the abandoned step settles, as `generation-registry` "Generation preparation is bounded, and an abandoned preparation retains ownership until it settles" defines. The pending step may still be the start-state write, and once it settles the marker it may have stored is released as `foreground-generation-lock` defines.
- The existing `generation.capability_resolution{outcome="failed"}` count SHALL still be recorded when the abandoned step is capability resolution.

A start-state write that *rejects* before the deadline takes this path like any other step: the request fails before SSE headers and the entry is released.

#### Scenario: Conversation fetch fails after registration

- **WHEN** registration succeeds but the subsequent `getConversation` throws
- **THEN** the backend releases the entry — clearing its timer, listeners, registry key, and runtime tracking — and rethrows, performing no conversation write, so a retry is not rejected with 409

#### Scenario: A generation-capability resolution failure releases the entry without writing

- **WHEN** registration succeeds but resolving the deployment's generation API throws
- **THEN** the backend releases the entry and rethrows with no `saveConversation` call made, and the failure reaches the exception filter before any SSE response is opened

#### Scenario: A rejected start-state write releases the entry

- **WHEN** the start-state write ends in `409` because another generation's marker is live
- **THEN** the backend releases the entry and rethrows, no further write is made, and the response is `409` before SSE headers

#### Scenario: A pending step at the deadline does not release the key

- **GIVEN** a preparation step is still pending when `GENERATION_PREPARATION_TIMEOUT_MS` elapses
- **WHEN** the preparation is abandoned
- **THEN** no conversation write is made by the abandonment, the entry keeps its registry key until that step settles, and a retry before then is rejected with `409`

### Requirement: A failure before the stream opens is reported with its own status code

`ConversationStreamingService.streamCompletion` is an async generator, so `ConversationController.streamCompletion` SHALL distinguish a rejection that arrives before SSE headers were sent from one that arrives after. Everything the generator does before calling `onReadyToStream` runs on the consuming loop's first `next()` rather than at the call site: registering the generation, resolving the deployment, fetching the conversation, writing the start state. The controller handles the two cases this way:

- while `res.headersSent` is false, it MUST NOT end the response, so the rejection propagates to the exception filter, which owns the status code and body;
- once the stream is open, the status is already committed, so a later failure ends the response as before and only the SSE transport reports it.

Ending the response on the pre-stream path would flush an empty `200` and leave the exception filter nothing to write. That is how a second browser tab submitting into a conversation that is already generating rendered an empty assistant answer instead of the documented `409`.

**Abandoned preparation.** An abandoned preparation (`generation-registry`) SHALL be reported on this path as `503 Service Unavailable`, raised as `ServiceUnavailableException`, before any SSE header is sent. Because preparation always ends before `onReadyToStream`, an abandoned preparation SHALL NOT be reported as a post-header SSE termination. A preparation stopped by process shutdown SHALL also fail on this path, and so SHALL a start-state write that failed. Example response:

```http
POST /api/v1/conversations/completions
{ "path": "gpt-4o__Chat__0b1f…", "generationId": "4b2c…", "message": "Hello", "model": "gpt-4o", "custom_content": {} }

HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{ "statusCode": 503, "message": "Generation preparation timed out", "error": "Service Unavailable" }
```

**Generated-client impact: none.**

- The handler keeps its name and operation.
- The existing `@ApiResponse({ status: 503, description: 'DIAL Core unreachable' })` already documents this status, and every preparation step is a DIAL Core request or app-config evaluation.
- The frontend calls this streaming endpoint through `libs/chat-hooks/src/conversation/create-chat-stream-api.ts` rather than a generated method, and that file already reports any non-`409` pre-stream status as a failed send.

The OpenAPI document is not regenerated for this requirement. No new user-visible string, i18n key, RTL or accessibility impact. Not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`.

**The duplicate-generation condition has two sources, and both end in the same `409` (`ConflictException(GENERATION_ACTIVE_MESSAGE)`):**

- The registry's condition is scoped to the caller's **principal** and conversation path, as `generation-principal-ownership` defines — not to a cookie session. For a header-authenticated caller, all clients presenting tokens for the same (`providerId`, `sub`) are one principal, so a second such client submitting into the same conversation hits it. It needs no DIAL Core call.
- The stored marker's condition applies to every caller, whatever its principal, session or instance: a conversation whose stored version has an active generation (`foreground-generation-lock` `findActiveGeneration`) is rejected after the conversation read, or by the conditional start-state write.

#### Scenario: A duplicate active generation is reported as 409

- **GIVEN** a generation is already active for this principal and conversation path
- **WHEN** a second request to `POST /conversations/completions` reaches `register` for the same principal and path
- **THEN** the response is `409` with the conflict message, not a `200` with an empty body

#### Scenario: Another principal's active generation is reported as 409

- **GIVEN** a generation of another principal holds a live marker on the conversation, on this or another instance
- **WHEN** a request to `POST /conversations/completions` reads that conversation
- **THEN** the response is `409` with the conflict message before SSE headers, and no upstream model request is made

#### Scenario: A mid-stream failure still ends the open SSE response

- **GIVEN** SSE headers have been sent and at least one chunk written
- **WHEN** the generator subsequently rejects
- **THEN** the controller ends the response, leaving the already-committed `200` status and the chunks written so far intact

#### Scenario: An abandoned preparation is reported as 503 before headers

- **GIVEN** a preparation step never settles
- **WHEN** `GENERATION_PREPARATION_TIMEOUT_MS` elapses
- **THEN** the response is `503` with the timeout message, `res.headersSent` was false when the filter wrote it, no keepalive was started, and no completion-response termination is counted as `completed`

#### Scenario: A second bearer client of the same principal is reported as 409

- **GIVEN** a generation is already active on a conversation path for header principal (`providerId` P, `sub` S)
- **WHEN** a different client presenting a valid token for the same (P, S) posts to `POST /conversations/completions` for that path
- **THEN** the response is `409` with the conflict message

### Requirement: No upstream request is dispatched once a generation is cancelled or released during preparation

When preparation (as `generation-registry` defines it) completes in time but the generation's lease was aborted during it — by a user Stop, the max-duration timer or stale expiry — `ConversationStreamingService.streamCompletion` (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`) SHALL NOT invoke the Chat Completions relay or `ResponsesAdapter.stream`, and no DIAL Core model request SHALL be dispatched. Everything else SHALL be unchanged:

- the start-state save, `onReadyToStream` and the SSE response proceed as before;
- the generation is classified through the existing `aborted` outcome (`wasStoppedByUser: true` for a user Stop, `streamErrorMessage: ''` for any other reason);
- its single terminal write operation is made;
- the stream ends.

The observable Stop contract is preserved: `POST /api/v1/conversations/completions/stop` responds `204`, and the originating completion request opens its stream, persists the stopped partial, and closes.

**Shutdown during preparation.** When process shutdown cancels the generation during preparation (reason shutdown, `generation-registry` "Process shutdown has its own contract and waits for foreground terminal writes within a bound"), the worker SHALL stop at its next preparation boundary. It SHALL make no further preparation call, no start-state save and no upstream request, and SHALL fail the request before SSE headers are sent. When its start-state write had already stored the marker, it SHALL make the single release write `foreground-generation-lock` requires, within the shutdown flush bound. It makes no persistence claim about any other write already in flight.

#### Scenario: A user Stop during preparation persists a stopped answer without calling the model

- **GIVEN** a generation is preparing and the principal stops it
- **WHEN** preparation then completes before the deadline
- **THEN** Stop responded `204`, the completion stream opens and closes, the persisted assistant message carries `wasStoppedByUser: true` and no `streamErrorMessage`, and no DIAL Core completion or Responses request was made

#### Scenario: A max-duration cancellation during preparation is a non-user abort without a model call

- **GIVEN** `MAX_GENERATION_DURATION_MS` elapses while the generation is preparing
- **WHEN** preparation then completes before its own deadline
- **THEN** the persisted assistant message carries `streamErrorMessage: ''` and no `wasStoppedByUser`, and no upstream model request was made

#### Scenario: Shutdown during preparation makes no further write or request

- **GIVEN** the module is destroyed while a generation's stored-conversation read is pending
- **WHEN** that read then resolves
- **THEN** no start-state save, upstream model request or terminal save is made, and the request fails without SSE headers

#### Scenario: Shutdown after the start state was stored releases the marker

- **GIVEN** a generation stored its start state with the marker and has not opened its stream
- **WHEN** the module is destroyed
- **THEN** no upstream model request is made, the request fails without SSE headers, and one release write removes the marker

### Requirement: Exactly one terminal write operation, and cancellation never adds or replaces one

This requirement SHALL apply to the Chat Completions and stateless Responses paths. On the background path, terminal writes follow `background-responses-generation` "Every background write applies only to the same pending generation": more than one writer is allowed there, and exactly one terminal state is guaranteed by that storage-side precondition.

**One operation, bounded attempts.** A generation SHALL dispatch at most one terminal write operation.

- The operation is the conditional update `foreground-generation-lock` "The terminal write applies only to the generation's own marker" defines.
- It MAY make up to `CONDITIONAL_WRITE_ATTEMPTS` (3) attempts, each re-reading the stored version, and a project write repeats internally on changes to other project files.
- Each attempt applies only while the generation's own marker is stored, so at most one terminal state is ever stored and no other generation's exchange is overwritten.

**Dispatch.** The worker SHALL record that the terminal write has been dispatched before awaiting it. From that point:

- A cancellation request of any reason SHALL be recorded for logging and telemetry only. It SHALL NOT change the persisted outcome, SHALL NOT trigger a second operation, and SHALL NOT cancel the dispatched one.
- A cancellation that arrives while the generation is still running SHALL set its reason before the worker's single classification read, so the worker's outcome reflects it.
- When a cancellation and a normal completion race, whichever reaches settlement first determines the outcome and the other is a no-op.

**Pre-stream failures stay write-free.** A failure resolving the deployment's generation capability, fetching the conversation, or building its history SHALL release the registry entry and rethrow **without** performing any conversation write. A preflight failure SHALL NOT invent a terminal save. A start-state write that failed is covered by "A pre-stream failure releases the registry entry".

**A rejected terminal write** SHALL be logged and reported as a persistence error on the open completion stream and to generation-attach subscribers, and the entry SHALL settle and release its key. The completion stream SHALL use its existing error envelope with type `conversation_save_failed` and safe fallback text.

- When the rejected write raised an HTTP error, the envelope SHALL also carry that error's status as a numeric `status` field, for example `{"error": {"type": "conversation_save_failed", "message": "…", "status": 401}}`: `401` when DIAL Core rejected the credentials, and the status of the mapped error otherwise (a storage `5xx` surfaces as `502`).
- A write skipped because the marker is no longer the generation's, or one whose every attempt met a version conflict, raised no HTTP error, so its envelope SHALL omit `status`.
- When the rejected write belonged to an answer that did not complete (stopped, aborted, or failed), the envelope SHALL also carry the terminal markers that write held, so a client recovery save stores the same outcome: `wasStoppedByUser: true` for a user stop, or `streamErrorMessage` with the text the write stored (`''` when it had no displayable upstream text). A completed answer's envelope carries no markers.
- The envelope carries only the status code and those markers, never the storage response body, credentials or other storage detail. `streamErrorMessage` is the same upstream model text the failed write would have shown the user.

Generation-attach `error` events are unchanged. This applies to successful, stopped, and failed model outcomes; a storage failure SHALL NOT be reported as a successful save.

**No second operation.** The backend SHALL start no second terminal write operation, and SHALL NOT fall back to an unconditional write. The single recovery save that the originating client may send after this error is reported with `status: 401` (`chat-hooks-conversation-stream` "A credentials-rejected terminal save gets one client recovery save") is a separate client conversation save:

- it is authorized by that request's own session, and SHALL NOT be treated as a second terminal write of this generation;
- a `401` rejection means the write was refused before anything was stored, so that save cannot duplicate a committed terminal write.

A delivered terminal event, a released registry entry and a recorded `dial.chat.completion.response.terminations` point SHALL NOT be treated as evidence that the conversation was durably persisted.

#### Scenario: Cancellation arriving after the terminal write was dispatched does not add a second write

- **GIVEN** a worker has dispatched its terminal write and is awaiting it
- **WHEN** a user Stop, a stale cancellation, or a max-duration timeout occurs
- **THEN** exactly one terminal write operation was issued for that generation, the persisted outcome is the one the dispatched operation carries, and the cancellation is recorded without changing it

#### Scenario: A pre-stream failure releases the entry without writing

- **WHEN** registration succeeds and the subsequent generation-capability resolution or `getConversation` throws
- **THEN** the backend releases the registry entry and rethrows, no `saveConversation` call is made on that path, and a retry is not rejected with 409

#### Scenario: A dispatched terminal write is fenced by its storage precondition

- **GIVEN** a worker dispatched its terminal write
- **WHEN** another generation took the conversation over after this generation's marker expired
- **THEN** the write's re-read finds no marker of this generation and nothing is written, so the other generation's exchange is kept

#### Scenario: Terminal writes retry on a version conflict

- **GIVEN** a foreground generation's terminal write receives a version conflict caused by an unrelated writer
- **WHEN** the re-read shows the message still carrying the generation's marker
- **THEN** the backend writes again on the new version, bounded to 3 attempts in one operation

#### Scenario: A rejected terminal write is not retried by the backend

- **WHEN** the terminal write is rejected and `conversation_save_failed` is reported on the open completion stream
- **THEN** the backend issues no further write for that generation, and any later save of that answer arrives as a separate client conversation save

#### Scenario: An answer that did not complete is reported with its status and terminal markers

- **WHEN** the terminal write of a failed answer is rejected with `401`
- **THEN** the open completion stream receives `conversation_save_failed` with `status: 401` and the `streamErrorMessage` that write carried, so a client recovery save stores the answer as failed
- **AND WHEN** the rejected write belonged to an answer the user stopped
- **THEN** the envelope carries `wasStoppedByUser: true` instead

#### Scenario: A credentials-rejected terminal write reports its status

- **WHEN** the terminal write of a completed answer is rejected with `401`
- **THEN** the open completion stream receives `conversation_save_failed` with `status: 401` and the unchanged safe fallback text, and an attach subscriber receives its `error` event unchanged

#### Scenario: A skipped terminal write reports no status

- **WHEN** the terminal write is skipped because the conversation was deleted during the generation
- **THEN** the open completion stream receives `conversation_save_failed` without `status`, and no client recovery save is triggered

### Requirement: Conversation writes are fenced in storage on every generation path

This capability SHALL distinguish which guarantees are process-local from which rely on a DIAL Core contract.

**Process-local guarantees:**

- admission of at most one owner per `ownerKey + path`;
- internal operation identity;
- cancellation propagation through the entry's `AbortController`;
- single idempotent settlement;
- as a consequence, no second worker holds a key while an older write is outstanding.

**Not guaranteed by anything:** that a write already handed to the persistence adapter has not committed and will not commit. A lease or generation-id check placed before awaiting the write does not fence a write that has already been issued. Racing the write against a timeout does not cancel it. Aborting the underlying HTTP request would not prove the storage server has neither committed nor will commit it.

**Storage-side admission.** The generation registry is process-local and is not a cross-pod coordination mechanism. Admission across principals, sessions and instances SHALL rest on the stored marker of `foreground-generation-lock` and the stored background marker of `background-responses-generation` instead.

**Every generation write SHALL be conditional.** Each SHALL send `If-Match` with the `ETag` of the conversation version it read, and SHALL apply its change only while that version still satisfies the write's precondition:

- On the background path — placeholder, `responseId`, final, stopped, failed, expired, interrupted — the precondition is `pending` with the same `generationId`, or for the placeholder the conversation version the request started from.
- On the Chat Completions and stateless Responses paths:
  - start state: no active generation in the version;
  - terminal and release writes: the generation's own marker;
  - a stored Stop: a live marker with the Stop's `generationId`.

A `412` SHALL cause a re-read and a re-check, bounded to 3 attempts. The conditional write is DIAL Core's: it returns an `ETag` on read and honors `If-Match` with `412`. For a project conversation, `ProjectConversationStore.saveConversationIfMatch` narrows the project's aggregate `ETag` to the one file, as `project-conversations-api` defines.

**Unrelated writers** to the same conversation path SHALL be named explicitly rather than assumed absent.

- `ConversationPersistenceService.saveConversation` performs an awaited display-name-preservation read before its write. It then fire-and-forget schedules `ConversationNamingService.maybeRenameAfterFirstReply`, an independent asynchronous writer that can write after a generation has released ownership.
- That naming writer re-reads the conversation and writes the **whole** conversation with the new display name and naming-done marker. It SHALL therefore write conditionally (`If-Match` with the `ETag` of its re-read, bounded re-read and retry on `412`), so it can never write back a stale copy of a message — in particular a message holding a pending background marker or a live foreground marker when it read.
- A naming write that interleaves with a generation write causes that write's `412`, which the bounded re-read handles.

Client full-body saves through `PUT /api/v1/conversations` (rating, message delete, settings, system prompt, status messages, overlay bridge) are the other writers to the same path. They are governed by `background-responses-generation` "Client conversation saves cannot change a pending background message", which protects a live foreground marker the same way.

#### Scenario: The asynchronous naming writer can write after ownership is released

- **GIVEN** a generation settled and released its registry key, and a naming write it scheduled is still in flight
- **WHEN** that naming write completes
- **THEN** it updates the conversation's display name and naming-done marker on the version it re-read, and a `412` makes it re-read instead of overwriting a newer write

#### Scenario: Foreground writes are conditional

- **WHEN** a terminal write is performed for a Chat Completions or stateless Responses generation
- **THEN** it carries `If-Match` with the `ETag` of the version it read, and is skipped if that version no longer carries the generation's own marker

#### Scenario: Background writes are conditional

- **WHEN** a background-path write is performed
- **THEN** it carries `If-Match` with the `ETag` of the version it read, and is skipped if the re-read shows the message is no longer `pending` with the same `generationId`

#### Scenario: A naming write between read and write is retried

- **GIVEN** a generation's terminal write read the conversation, then the naming writer updated the display name
- **WHEN** the terminal write's conditional attempt receives `412`
- **THEN** it re-reads, finds the message still carrying the generation's marker, and writes again with the new `ETag`

## RENAMED Requirements

FROM: ### Requirement: Exactly one terminal write attempt, and cancellation never adds or replaces one
TO: ### Requirement: Exactly one terminal write operation, and cancellation never adds or replaces one

FROM: ### Requirement: Fencing guarantees are process-local, and storage-side fencing is not claimed
TO: ### Requirement: Conversation writes are fenced in storage on every generation path
