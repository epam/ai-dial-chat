## ADDED Requirements

### Requirement: The completion response sends a periodic SSE keepalive while streaming

`ConversationController.streamCompletion` (`POST /api/v1/conversations/completions`) SHALL write the existing `SSE_KEEPALIVE_PAYLOAD` (`: keepalive\n\n`) every `SSE_KEEPALIVE_INTERVAL_MS` (15 s), the same interval `completions/attach` and `watch` already use. The timer SHALL start only after `startSseResponse(res)` has sent the headers. That happens in the `onReadyToStream` callback, so a request that fails before the stream opens, for example `409`, writes no keepalive and keeps its documented status code.

A keepalive tick SHALL write only when both of these hold:

- the response is in `SseResponseState.Streaming`;
- the last write to `res` ended at a line boundary, meaning its final byte was `\n`.

The line-boundary rule matters because the relay yields raw upstream byte slices that can end mid-line, and a comment written there would corrupt the SSE frame. A tick that finds the stream mid-line SHALL be skipped. Bytes are flowing in that case, so no liveness signal is lost. A keepalive write SHALL go through the same `writableLength > SSE_COMPLETION_MAX_BUFFERED_BYTES` check as a chunk write, and a thrown write SHALL enter `BackpressureDetached` exactly as a chunk write does.

The timer SHALL be cleared in the handler's `finally` block, before the response is released. It SHALL never outlive the handler, and SHALL never write to a `ClientClosed`, `BackpressureDetached`, or `Completed` response. A keepalive SHALL NOT affect the generation, its persistence, its outcome, or `dial.chat.completion.response.terminations`.

This requirement changes no API contract. An SSE comment is not part of the OpenAPI schema, and every SSE reader in the repo already ignores comment lines, so no generated-client or `npm run openapi` change results. The endpoint's authorization is unchanged.

#### Scenario: A silent generation phase still produces bytes
- **GIVEN** a generation whose upstream produces no chunk for 40 s, for example a long "Thinking" stage
- **WHEN** the completion response is `Streaming`
- **THEN** the client receives `: keepalive\n\n` at least twice during that window

#### Scenario: No keepalive before the stream opens
- **WHEN** the generation is rejected with `409` before `onReadyToStream`
- **THEN** no keepalive is written and the response carries the `409` status and body

#### Scenario: No keepalive after the client closes
- **WHEN** the downstream response has entered `ClientClosed` or `BackpressureDetached`
- **THEN** no further keepalive is written to it

#### Scenario: A keepalive never splits an SSE line
- **WHEN** a keepalive tick fires while the last written upstream slice ended without a trailing `\n`
- **THEN** that tick writes nothing

#### Scenario: The timer is released with the handler
- **WHEN** the generator returns for any outcome (completed, error, stopped, or failed before streaming)
- **THEN** the keepalive interval is cleared, and no timer referencing `res` remains
