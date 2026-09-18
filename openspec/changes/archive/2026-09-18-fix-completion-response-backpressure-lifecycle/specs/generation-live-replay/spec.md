## MODIFIED Requirements

### Requirement: Attach subscribers are cleaned up on client disconnect

`ConversationController.streamCompletion` deliberately never stops its backend-owned generation for a closed or slow client — it only stops writing to that response and then terminates it (see `backend-owned-generation-persistence`). The attach endpoint's *subscription* is client-owned instead, so it SHALL detect client disconnect (`res.on('close', ...)`) and remove its listener from the generation's emitter, so listener count reflects only currently-connected subscribers.

The attach endpoint SHALL also detach a subscriber whose response cannot keep up with generation output, without pausing or slowing the generation itself (the generation continues to run and to update the retained assembled message regardless of any attached subscriber's write speed). On each `chunk`/terminal write, the handler SHALL check `res.writableLength` (Node's count of bytes currently buffered for that response) after calling `res.write()`; if it exceeds `SSE_ATTACH_MAX_BUFFERED_BYTES` (1 MiB), the handler SHALL treat the subscriber as unable to keep up and run the same cleanup as a client disconnect (remove its `chunk`/`terminal` listeners, clear its keepalive timer, release its `dial_chat_sse_active{kind="generation_attach"}` contribution, and release its response) without emitting further chunks to it.

Releasing the response SHALL follow the same bounded sequence the completion path uses: a graceful `res.end()` first, then `res.destroy()` only if `'finish'`/`'close'` has not fired within `SSE_RELEASE_TIMEOUT_MS`. `res.end()` alone marks the response ended but does not reclaim bytes already queued for a peer that has stopped reading, which is why the bounded fallback is required rather than optional. Because `cleanup()` is invoked from synchronous emitter callbacks, it SHALL start the release without awaiting it, and SHALL remain idempotent: a second `cleanup()` — from a subsequent disconnect, terminal event, or shutdown — MUST NOT re-end, re-destroy, or double-release the subscription.

#### Scenario: Client disconnects mid-attach

- **WHEN** an attached client's connection closes before the generation reaches a terminal state
- **THEN** the backend removes that subscriber's listener and performs no further writes to its (closed) response, and the generation itself continues unaffected

#### Scenario: A slow attach subscriber is detached without affecting the generation

- **GIVEN** an attach subscriber whose response cannot drain as fast as chunks are produced
- **WHEN** that subscriber's buffered output (`res.writableLength`) exceeds `SSE_ATTACH_MAX_BUFFERED_BYTES` after a write
- **THEN** the backend detaches that subscriber (removes its listeners, clears its keepalive timer, ends its response) while the generation and any other concurrently attached subscriber continue receiving chunks and the eventual terminal event unaffected

#### Scenario: A detached attach subscriber that cannot flush is destroyed after the bounded wait

- **GIVEN** a detached attach subscriber whose peer has stopped reading, so `'finish'` never fires after `res.end()`
- **WHEN** `SSE_RELEASE_TIMEOUT_MS` elapses
- **THEN** the backend destroys that subscriber's response, releasing its buffered bytes, while the generation and every other subscriber continue unaffected

#### Scenario: A well-behaved attach subscriber is never detached for backpressure

- **GIVEN** an attach subscriber whose response reads chunks promptly (buffered output stays under `SSE_ATTACH_MAX_BUFFERED_BYTES`)
- **WHEN** the generation produces any number of chunks before reaching a terminal state
- **THEN** the subscriber receives every chunk and the terminal event, and is never detached for backpressure

#### Scenario: Repeated cleanup for one subscriber is idempotent

- **GIVEN** a subscriber whose cleanup has already run (for backpressure, disconnect, or the terminal event)
- **WHEN** cleanup is invoked again for that same subscriber
- **THEN** its response is not ended or destroyed a second time and its `dial_chat_sse_active{kind="generation_attach"}` contribution is released exactly once
