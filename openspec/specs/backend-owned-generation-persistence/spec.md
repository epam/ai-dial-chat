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
| The relay itself threw | `streamErrorMessage` = the thrown error's message | `Error` |

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
- **THEN** the backend saves the partial assistant message with `streamErrorMessage` set — carrying the DIAL Core error text when one is available, or an empty string when no upstream text exists (empty body, non-user abort). The presence of the field (even `''`) is the terminal-error signal; the frontend localizes a generic fallback when the value is empty.

#### Scenario: A user stop is not persisted as an error

- **WHEN** the generation is aborted and the registry already records it as stopped by the user
- **THEN** the partial message is saved with `wasStoppedByUser: true` and no `streamErrorMessage`, and the generation is finalized as `Stopped`

#### Scenario: A failed start-state save does not abort the stream

- **WHEN** the start-state `saveConversation` rejects
- **THEN** the failure is logged as a warning and the completion request proceeds to stream normally

### Requirement: A closed downstream response does not alter generation persistence or outcome

Closing, refreshing, or navigating away from the browser connection that opened `POST /api/v1/conversations/completions` SHALL have no effect on the generation's outcome or persistence. `ConversationController.streamCompletion` SHALL continue consuming `ConversationStreamingService.streamCompletion`'s async generator to its natural terminal outcome after the downstream HTTP response closes; it MUST NOT abort the generation's `AbortController` and MUST NOT stop iterating merely because the response closed. It SHALL stop writing to the closed response (and MUST NOT attempt any further `res.write`/`res.end` calls against it) but otherwise treats the generation exactly as if the original client were still connected.

The same "stop writing but keep generating" treatment SHALL apply when the response is not closed but cannot keep up with output: after each `res.write(chunk)`, the handler SHALL check `res.writableLength`; if it exceeds `SSE_COMPLETION_MAX_BUFFERED_BYTES` (1 MiB), the handler SHALL mark the response detached (setting the same `isResponseDetached` flag used for a closed connection) and stop calling `res.write`/`res.end` against it for the remainder of the generation, without pausing, slowing, or aborting the generation loop itself.

When the upstream stream subsequently reaches a normal terminal event (`[DONE]`, a provider error, or an explicit Stop received before the disconnect), the backend persists the outcome per the existing outcome table in "Backend persists the conversation across the generation lifecycle" — a disconnect or a backpressure-driven detachment never substitutes a different, disconnect-specific outcome. Reopening the conversation (in the same or a different browser tab/session) after the generation finishes SHALL show the complete persisted response, not a truncated or error-marked one caused by the earlier disconnect or detachment.

This requirement applies only to `POST /api/v1/conversations/completions`. It does not apply to `POST /api/v1/client-channel/subscribe` (an ephemeral client subscription with no independent backend-owned lifecycle — see `client-channel-protocol`) or to `POST /api/v1/conversations/completions/attach` (an observer of an existing generation — see `generation-live-replay`), both of which correctly abort their own upstream work on disconnect because nothing else depends on that work continuing.

#### Scenario: Browser tab closes before the upstream reaches a terminal event

- **GIVEN** a generation is actively streaming and has received at least one chunk
- **WHEN** the client's HTTP connection to `POST /conversations/completions` closes (tab closed, navigation to another page, refresh) before the upstream reaches `[DONE]`, an error, or an explicit Stop
- **THEN** the backend keeps consuming the upstream stream unaffected, and no `AbortController` tied to the generation is aborted because of the closed response

#### Scenario: No writes are attempted against a closed response

- **GIVEN** the downstream response has closed while the generation is still streaming
- **WHEN** further chunks are produced by the upstream relay
- **THEN** the backend does not call `res.write` or `res.end` against the closed response for those chunks

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
- **THEN** the backend stops writing further chunks to that response (marking it detached, the same as a closed connection) while the generation continues unaffected until its natural terminal outcome

#### Scenario: The complete response is persisted after a backpressure-driven detachment

- **GIVEN** the response was detached for backpressure as in the scenario above
- **WHEN** the upstream subsequently reaches `[DONE]`
- **THEN** the backend persists the full assembled assistant message exactly as it would for a client disconnect, and reopening the conversation shows the complete response

### Requirement: Generation finalizes on `[DONE]`, not on socket close

The streaming read loop SHALL treat the `[DONE]` SSE payload as the completion signal: it MUST save the final conversation, mark the generation complete in the registry, and close the response. It MUST NOT wait for the upstream socket to close, because providers may keep the connection open after `[DONE]`, which would otherwise leave the generation registered as active and reject the next request with HTTP 409. Stopping at `[DONE]` SHALL cancel the upstream reader rather than merely releasing its lock, so the connection is actually closed instead of left dangling.

An upstream socket that closes **without** ever sending `[DONE]` SHALL be treated as the end of the stream too, and logged as such, so a truncated response still finalizes rather than hanging.

#### Scenario: Provider keeps the connection open after `[DONE]`

- **WHEN** the upstream emits `[DONE]` but does not close the connection
- **THEN** the backend still finalizes the generation, releases the registry entry, and closes its response

### Requirement: A pre-stream failure releases the registry entry

If any step between registering the generation and opening the upstream stream fails — resolving the deployment's generation capability, fetching the conversation, or building its history — the backend SHALL release the registry entry before rethrowing, so a transient failure does not lock the conversation until stale eviction.

#### Scenario: Conversation fetch fails after registration

- **WHEN** registration succeeds but the subsequent `getConversation` throws
- **THEN** the backend marks the generation errored (releasing the entry) and rethrows, so a retry is not rejected with 409

### Requirement: A failure before the stream opens is reported with its own status code

`ConversationStreamingService.streamCompletion` is an async generator, so everything it does before calling `onReadyToStream` — registering the generation, resolving the deployment, fetching the conversation — runs on the consuming loop's first `next()` rather than at the call site. `ConversationController.streamCompletion` SHALL therefore distinguish a rejection that arrives before SSE headers were sent from one that arrives after: while `res.headersSent` is false it MUST NOT end the response, so the rejection propagates to the exception filter, which owns the status code and body. Once the stream is open the status is already committed, so a later failure ends the response as before and only the SSE transport reports it.

Ending the response on the pre-stream path would flush an empty `200` and leave the exception filter nothing to write, which is how a second browser tab submitting into a conversation that is already generating rendered an empty assistant answer instead of the documented `409`.

#### Scenario: A duplicate active generation is reported as 409

- **GIVEN** a generation is already active for this session and conversation path
- **WHEN** a second request to `POST /conversations/completions` reaches `register` for the same session and path
- **THEN** the response is `409` with the conflict message, not a `200` with an empty body

#### Scenario: A mid-stream failure still ends the open SSE response

- **GIVEN** SSE headers have been sent and at least one chunk written
- **WHEN** the generator subsequently rejects
- **THEN** the controller ends the response, leaving the already-committed `200` status and the chunks written so far intact
