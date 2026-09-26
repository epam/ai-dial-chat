# backend-owned-generation-persistence Specification

## Purpose

The backend owns conversation persistence across the generation lifecycle — saving the start, final, and partial (stop/error) states — so the frontend never races to save and chunks cannot land in the wrong conversation.
## Requirements
### Requirement: Backend persists the conversation across the generation lifecycle

`ConversationStreamingService.streamCompletion` (`apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`, invoked via the `ConversationService` facade) SHALL own conversation persistence for a completion. The frontend MUST NOT call `saveConversation` during streaming. The backend SHALL save at the start of generation (user message + empty assistant placeholder), on successful completion (full assembled assistant message), and on stop/error (the partial assistant message accumulated so far).

A failure of the **start-state** save SHALL be logged as a warning and SHALL NOT abort the request: the stream still opens, and the terminal save that follows writes the conversation anyway. Losing the placeholder costs a resumable mid-flight view; refusing to stream because of it would cost the answer itself.

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

### Requirement: A closed downstream response does not alter generation persistence or outcome

Closing, refreshing, or navigating away from the browser connection that opened `POST /api/v1/conversations/completions` SHALL have no effect on the generation's outcome or persistence. `ConversationController.streamCompletion` SHALL continue consuming `ConversationStreamingService.streamCompletion`'s async generator to its natural terminal outcome after the downstream HTTP response closes; it MUST NOT abort the generation's `AbortController` and MUST NOT stop iterating merely because the response closed. It SHALL stop writing to the closed response (and MUST NOT attempt any further `res.write`/`res.end` calls against it) but otherwise treats the generation exactly as if the original client were still connected.

The handler SHALL track the downstream response with an explicit lifecycle state, not a single boolean, and SHALL distinguish at least these states:

| State | Entered when | Cleanup obligation |
|---|---|---|
| `Streaming` | headers sent (or pending) and writes still go to the client | end the response normally when the generator finishes |
| `ClientClosed` | `res.on('close')` fired | none — Node has already destroyed the response; the handler MUST NOT call `res.write`, `res.end`, or `res.destroy` against it |
| `BackpressureDetached` | `res.writableLength` exceeded `SSE_COMPLETION_MAX_BUFFERED_BYTES` (1 MiB) after a write, or a write threw while the response was still open | the handler owns terminating it — see the release sequence below |
| `Completed` | the handler ended the response normally | none |

`ClientClosed` SHALL take precedence over `BackpressureDetached`: a disconnect observed at any point, including while a detached response is being released, is the authoritative fact. `BackpressureDetached` SHALL be entered only from `Streaming`.

The same "stop writing but keep generating" treatment SHALL apply when the response is not closed but cannot keep up with output: after each `res.write(chunk)`, the handler SHALL check `res.writableLength`; if it exceeds `SSE_COMPLETION_MAX_BUFFERED_BYTES`, the handler SHALL enter `BackpressureDetached` and stop writing SSE chunks to that response for the remainder of the generation, without pausing, slowing, or aborting the generation loop itself. The handler MUST continue iterating the generator with `continue` and MUST NOT `break` or `return` out of the consuming loop, because abandoning the generator triggers its own cleanup, which aborts the generation's `AbortController`.

A `BackpressureDetached` response SHALL NOT be left open after the handler completes. Once the generator has returned — and therefore after the terminal save and registry release have already run — the handler SHALL release the response in this order:

1. If the response is already terminal (`writableFinished` or `destroyed`), do nothing further.
2. Otherwise call `res.end()` gracefully. No additional SSE event SHALL be written first; the client is by definition not reading, and a further frame would only enlarge the queue.
3. Wait for `'finish'` or `'close'`, bounded by `SSE_RELEASE_TIMEOUT_MS`.
4. If neither fired within that bound, call `res.destroy()`.

`res.destroy()` SHALL be used only as this bounded fallback, never as the primary termination. The release SHALL leave the response in an observable terminal state: `writableEnded === true` in every case, and additionally `destroyed === true` when the timeout fallback was used. Releasing the response MUST NOT call into the persistence service, the generation registry, or the generation's `AbortController`.

When the upstream stream subsequently reaches a normal terminal event (`[DONE]`, a provider error, or an explicit Stop received before the disconnect), the backend persists the outcome per the existing outcome table in "Backend persists the conversation across the generation lifecycle" — a disconnect or a backpressure-driven detachment never substitutes a different, disconnect-specific outcome. Reopening the conversation (in the same or a different browser tab/session) after the generation finishes SHALL show the complete persisted response, not a truncated or error-marked one caused by the earlier disconnect or detachment.

This requirement applies only to `POST /api/v1/conversations/completions`. It does not apply to `POST /api/v1/client-channel/subscribe` (an ephemeral client subscription with no independent backend-owned lifecycle — see `client-channel-protocol`) or to `POST /api/v1/conversations/completions/attach` (an observer of an existing generation — see `generation-live-replay`), both of which correctly abort their own upstream work on disconnect because nothing else depends on that work continuing.

#### Scenario: Browser tab closes before the upstream reaches a terminal event

- **GIVEN** a generation is actively streaming and has received at least one chunk
- **WHEN** the client's HTTP connection to `POST /conversations/completions` closes (tab closed, navigation to another page, refresh) before the upstream reaches `[DONE]`, an error, or an explicit Stop
- **THEN** the backend keeps consuming the upstream stream unaffected, and no `AbortController` tied to the generation is aborted because of the closed response

#### Scenario: No writes are attempted against a closed response

- **GIVEN** the downstream response has closed while the generation is still streaming
- **WHEN** further chunks are produced by the upstream relay
- **THEN** the backend does not call `res.write`, `res.end`, or `res.destroy` against the closed response for those chunks

#### Scenario: The complete response is persisted and visible after disconnect

- **GIVEN** the browser disconnected mid-stream as in the scenario above
- **WHEN** the upstream subsequently reaches `[DONE]`
- **THEN** the backend persists the full assembled assistant message (no `streamErrorMessage`, no `wasStoppedByUser`), releases the registry entry as `Done`, and reopening the conversation shows the complete response

#### Scenario: Navigating between conversations does not stop a completion

- **WHEN** a generation is active for conversation A and the user navigates to conversation B and back, or to an unrelated page in the SPA, before the generation finishes
- **THEN** the generation for conversation A continues unaffected and completes normally

#### Scenario: A slow browser connection is detached without pausing generation

- **GIVEN** a generation is actively streaming to a connected browser that reads slower than chunks are produced
- **WHEN** `res.writableLength` exceeds `SSE_COMPLETION_MAX_BUFFERED_BYTES` after a write
- **THEN** the backend enters `BackpressureDetached`, stops writing further chunks to that response, and keeps consuming the generator to its natural terminal outcome without aborting the generation

#### Scenario: The complete response is persisted after a backpressure-driven detachment

- **GIVEN** the response was detached for backpressure as in the scenario above
- **WHEN** the upstream subsequently reaches `[DONE]`
- **THEN** the backend persists the full assembled assistant message exactly as it would for a client disconnect, and reopening the conversation shows the complete response

#### Scenario: A backpressure-detached response reaches a terminal state

- **GIVEN** the response was detached for backpressure and the generator has since returned
- **WHEN** the handler's cleanup runs
- **THEN** the backend calls `res.end()` on that response and the response reaches `writableEnded === true` rather than being left open with buffered bytes

#### Scenario: A detached response that cannot flush is destroyed after the bounded wait

- **GIVEN** a backpressure-detached response whose peer has stopped reading entirely, so `'finish'` never fires after `res.end()`
- **WHEN** `SSE_RELEASE_TIMEOUT_MS` elapses
- **THEN** the backend calls `res.destroy()`, the response reports `destroyed === true`, and its buffered bytes are released

#### Scenario: A detached response that flushes in time is not destroyed

- **GIVEN** a backpressure-detached response whose peer resumes reading after `res.end()`
- **WHEN** `'finish'` fires before `SSE_RELEASE_TIMEOUT_MS` elapses
- **THEN** the backend does not call `res.destroy()`, and the client observes a clean end of the SSE stream

#### Scenario: A client that drains below the limit is never released early

- **GIVEN** a connected client whose buffered output rises but never exceeds `SSE_COMPLETION_MAX_BUFFERED_BYTES` after any write
- **WHEN** the generation produces any number of chunks before reaching its terminal outcome
- **THEN** the response is never detached, receives every chunk, and is ended once normally when the generator finishes

#### Scenario: Releasing a detached response does not disturb generation or persistence

- **GIVEN** a backpressure-detached response
- **WHEN** the handler releases it, including via the `res.destroy()` fallback
- **THEN** the generation's `AbortController` is not aborted, no additional or different conversation save is performed, and the registry entry's terminal status is the one the generator already recorded

### Requirement: Completion response terminations are counted by reason

The application SHALL expose a counter `dial.chat.completion.response.terminations` (Prometheus `dial_chat_completion_response_terminations_total`) recording how each downstream completion response ended, with a single bounded `reason` attribute taking only the fixed values `completed`, `client_closed`, `backpressure_ended`, and `backpressure_destroyed`. Exactly one point SHALL be recorded per completion response that reached the streaming phase.

The counter SHALL carry no user, conversation, deployment, session, or pod identifier, and the instrumentation SHALL NOT retain a reference to the `Response`, its socket, or any per-user key — the same constraint the runtime gauges in `apps/chat-api/src/telemetry/runtime-metrics.ts` already observe. For that reason no gauge of open completion responses and no aggregate of their buffered `writableLength` is exposed; `reason="backpressure_destroyed"` is the signal that graceful release did not complete within its bound.

Ordinary completion-response delivery SHALL still NOT contribute to `dial.chat.sse.active`, whose fixed `kind` values remain `client_channel`, `conversation_watch`, and `generation_attach`.

#### Scenario: A normally completed response is counted as completed

- **WHEN** a completion response is ended by the handler after the generator finishes
- **THEN** one point is recorded with `reason="completed"`

#### Scenario: A disconnected response is counted as client-closed

- **WHEN** the downstream response closed before the generator finished
- **THEN** one point is recorded with `reason="client_closed"` and no write, end, or destroy is attempted against it

#### Scenario: A gracefully released detached response is distinguishable from a destroyed one

- **WHEN** a backpressure-detached response is released
- **THEN** one point is recorded with `reason="backpressure_ended"` if `'finish'`/`'close'` fired within `SSE_RELEASE_TIMEOUT_MS`, or `reason="backpressure_destroyed"` if the timeout fallback destroyed it

#### Scenario: Termination metrics carry no unbounded identifiers

- **WHEN** completion response termination points are collected
- **THEN** their attributes contain only the four fixed `reason` values and no user, conversation, deployment, or pod identifier

### Requirement: Generation finalizes on `[DONE]`, not on socket close

The streaming read loop SHALL treat the `[DONE]` SSE payload as the completion signal: it MUST save the final conversation, mark the generation complete in the registry, and close the response. It MUST NOT wait for the upstream socket to close, because providers may keep the connection open after `[DONE]`, which would otherwise leave the generation registered as active and reject the next request with HTTP 409. Stopping at `[DONE]` SHALL cancel the upstream reader rather than merely releasing its lock, so the connection is actually closed instead of left dangling.

An upstream socket that closes **without** ever sending `[DONE]` SHALL be treated as the end of the stream too, and logged as such, so a truncated response still finalizes rather than hanging.

#### Scenario: Provider keeps the connection open after `[DONE]`

- **WHEN** the upstream emits `[DONE]` but does not close the connection
- **THEN** the backend still finalizes the generation, releases the registry entry, and closes its response

### Requirement: A pre-stream failure releases the registry entry

If any step between registering the generation and opening the upstream stream fails — resolving the deployment's generation capability, fetching the conversation, or building its history — the backend SHALL release the registry entry before rethrowing, so a transient failure does not lock the conversation.

Releasing on this path SHALL NOT perform a conversation write of any kind: nothing has been assembled, and a preflight failure must not invent a terminal save. Release SHALL be the entry's single settlement, so its max-duration timer, its attach listeners, its registry key, and its runtime generation tracking are all released exactly once.

Because `generation-registry` no longer removes or replaces an owned entry on `register`, this release is the only thing that frees the key after a preflight failure. A retry therefore succeeds immediately rather than waiting for any sweep.

#### Scenario: Conversation fetch fails after registration

- **WHEN** registration succeeds but the subsequent `getConversation` throws
- **THEN** the backend releases the entry — clearing its timer, listeners, registry key, and runtime tracking — and rethrows, performing no conversation write, so a retry is not rejected with 409

#### Scenario: A generation-capability resolution failure releases the entry without writing

- **WHEN** registration succeeds but resolving the deployment's generation API throws
- **THEN** the backend releases the entry and rethrows with no `saveConversation` call made, and the failure reaches the exception filter before any SSE response is opened

### Requirement: A failure before the stream opens is reported with its own status code

`ConversationStreamingService.streamCompletion` is an async generator, so everything it does before calling `onReadyToStream` — registering the generation, resolving the deployment, fetching the conversation — runs on the consuming loop's first `next()` rather than at the call site. `ConversationController.streamCompletion` SHALL therefore distinguish a rejection that arrives before SSE headers were sent from one that arrives after: while `res.headersSent` is false it MUST NOT end the response, so the rejection propagates to the exception filter, which owns the status code and body. Once the stream is open the status is already committed, so a later failure ends the response as before and only the SSE transport reports it.

Ending the response on the pre-stream path would flush an empty `200` and leave the exception filter nothing to write, which is how a second browser tab submitting into a conversation that is already generating rendered an empty assistant answer instead of the documented `409`.

The duplicate-generation condition is scoped to the caller's **principal** and conversation path, as `generation-principal-ownership` defines — not to a cookie session. For a header-authenticated caller, all clients presenting tokens for the same (`providerId`, `sub`) are one principal, so a second such client submitting into the same conversation hits the same `409`.

#### Scenario: A duplicate active generation is reported as 409

- **GIVEN** a generation is already active for this principal and conversation path
- **WHEN** a second request to `POST /conversations/completions` reaches `register` for the same principal and path
- **THEN** the response is `409` with the conflict message, not a `200` with an empty body

#### Scenario: A mid-stream failure still ends the open SSE response

- **GIVEN** SSE headers have been sent and at least one chunk written
- **WHEN** the generator subsequently rejects
- **THEN** the controller ends the response, leaving the already-committed `200` status and the chunks written so far intact

#### Scenario: A second bearer client of the same principal is reported as 409

- **GIVEN** a generation is already active on a conversation path for header principal (`providerId` P, `sub` S)
- **WHEN** a different client presenting a valid token for the same (P, S) posts to `POST /conversations/completions` for that path
- **THEN** the response is `409` with the conflict message

### Requirement: Backend-owned persistence is independent of the authentication mode

Every persistence guarantee in this capability — saving the start state before opening the upstream stream, assembling the assistant message chunk by chunk, and saving the final or partial state on completion, stop, or error regardless of whether the originating HTTP request is still connected — SHALL hold identically for a header-authenticated caller and a cookie-authenticated caller.

#### Scenario: A bearer caller's generation persists after the client disconnects

- **GIVEN** a header-authenticated caller started a generation and its HTTP connection then closed
- **WHEN** the upstream stream subsequently reaches `[DONE]`
- **THEN** the backend persists the complete assistant message, and reopening the conversation shows the full response — the same outcome the cookie-authenticated path produces

#### Scenario: A bearer caller's stopped generation persists the partial answer

- **GIVEN** a header-authenticated caller's generation has produced some tokens
- **WHEN** that principal stops it via `POST .../completions/stop`
- **THEN** the saved conversation contains the partial assistant message flagged `wasStoppedByUser: true`

### Requirement: Terminal classification and partial-message reads belong to the finalizing generation

`ConversationStreamingService.streamCompletion` SHALL classify its own terminal outcome and read its own partial assistant message through the lease `register` returned to it, never by re-reading the registry by `ownerKey + path`. Specifically, the abort-outcome branch and the abandoned-generator cleanup branch SHALL obtain the cancellation state and the assembled message through lease-scoped accessors that resolve only an entry carrying that lease's internal operation identity.

A worker whose entry is no longer the one occupying its registry key SHALL read no cancellation state and no assembled message from the registry, and SHALL fall back to the assembled message it holds locally. It SHALL NOT read, mutate, remove, notify subscribers of, or release runtime tracking for whatever entry currently occupies that key.

The start-state write, the assembled-message updates, and the single terminal write SHALL all belong to the generation that holds the lease. Because `generation-registry` admits no replacement while an entry is owned, no replacement can exist for the key while any of those writes is outstanding.

#### Scenario: An old worker classifying a stop never reads a replacement's state

- **GIVEN** a generation is stopped and its worker is unwinding, and the registry key has since been released and re-registered by a new generation
- **WHEN** the old worker classifies its outcome and reads its partial message
- **THEN** it reads no state from the new entry, uses its own locally-held assembled message, persists its own partial answer, and neither delivers a terminal event to the new generation's subscribers nor removes the new generation's entry

#### Scenario: A replacement reusing the same client generation id is not mistaken for the old generation

- **GIVEN** an old worker is finalizing and a new generation for the same principal and path was registered with the same client-supplied `generationId`
- **WHEN** the old worker performs its terminal transition
- **THEN** the transition is a no-op against the new entry, and the new generation's status, assembled message, subscribers, and runtime tracking are unaffected

#### Scenario: A stale-cancelled generation persists a non-user abort, not a user stop

- **GIVEN** a generation was cancelled by stale expiry rather than by the Stop endpoint
- **WHEN** its worker finalizes
- **THEN** the persisted partial assistant message carries `streamErrorMessage: ''` and no `wasStoppedByUser`, matching the existing "aborted for any other reason" outcome row

### Requirement: Exactly one terminal write attempt, and cancellation never adds or replaces one

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

### Requirement: Fencing guarantees are process-local, and storage-side fencing is not claimed

This capability SHALL distinguish which guarantees are process-local from which would require a verified DIAL Core contract.

Process-local, and guaranteed: admission of at most one owner per `ownerKey + path`; internal operation identity; cancellation propagation through the entry's `AbortController`; single idempotent settlement; and the consequence that no second worker holds a key while an older write is outstanding.

Not guaranteed, and requiring a verified DIAL Core contract to ever be guaranteed: that a write already handed to the persistence adapter has not committed and will not commit. In particular, a lease or generation-id check placed before awaiting the write does not fence a write that has already been issued; racing the write against a timeout does not cancel it; and aborting the underlying HTTP request would not prove the storage server has neither committed nor will commit it. The generation registry is process-local and is not a cross-pod coordination mechanism.

`ConversationPersistencePort` exposes no cancellation parameter and no conditional-write parameter, and this change SHALL NOT add one. The DIAL Core conversation-save contract declared by the installed `@epam/ai-dial-typescript-sdk` does accept `If-Match`/`If-None-Match` preconditions and can answer `412`, and returns an `ETag` on both save and read — but that is a contract declaration, not verified deployment behaviour, so no storage-side fencing guarantee SHALL be asserted on its basis.

Unrelated writers to the same conversation path SHALL be named explicitly rather than assumed absent. `ConversationPersistenceService.saveConversation` performs an awaited display-name-preservation read before its write, and then fire-and-forget schedules `ConversationNamingService.maybeRenameAfterFirstReply`, which is an independent asynchronous writer that can write after a generation has released ownership. It writes only the conversation's display name and its naming-done marker, so it does not overwrite assistant message content and is not part of the overlap this capability fences; it would, however, have to be brought into any future conditional-write chain.

#### Scenario: The asynchronous naming writer can write after ownership is released

- **GIVEN** a generation settled and released its registry key, and a naming write it scheduled is still in flight
- **WHEN** that naming write completes
- **THEN** it updates only the conversation's display name and naming-done marker, and does not overwrite the assistant message content persisted by any generation

#### Scenario: No storage-side fencing is asserted

- **WHEN** a terminal write is performed
- **THEN** it is issued without a conditional-write precondition, and the capability documents that correctness rests on process-local admission rather than on storage-side fencing

### Requirement: Terminal reloads cannot erase received assistant payload

A client SHALL retain its accumulated assistant payload on an explicit persistence error or when a terminal reload returns the unresolved empty placeholder at that generation's assistant index. It SHALL show an app-localized warning that server persistence is unconfirmed and a page reload can lose the local answer. It SHALL preserve text and custom content together and SHALL NOT attempt a client-side save. Successful reloads SHALL still replace local state with server-persisted data. A superseded generation or another displayed conversation SHALL NOT receive stale restoration.

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
