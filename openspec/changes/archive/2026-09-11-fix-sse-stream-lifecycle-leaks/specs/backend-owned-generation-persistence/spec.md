## MODIFIED Requirements

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
