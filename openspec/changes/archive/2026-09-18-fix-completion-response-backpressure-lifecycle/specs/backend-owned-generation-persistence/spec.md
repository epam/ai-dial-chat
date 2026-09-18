## MODIFIED Requirements

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

## ADDED Requirements

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
