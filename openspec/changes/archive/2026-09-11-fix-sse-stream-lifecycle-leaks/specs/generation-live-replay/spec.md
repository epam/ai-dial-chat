## MODIFIED Requirements

### Requirement: Attach subscribers are cleaned up on client disconnect

Unlike `ConversationController.streamCompletion` (which has no client-disconnect handling, by design, so a closed tab does not stop generation), the attach endpoint SHALL detect client disconnect (`res.on('close', ...)`) and remove its listener from the generation's emitter, so listener count reflects only currently-connected subscribers.

The attach endpoint SHALL also detach a subscriber whose response cannot keep up with generation output, without pausing or slowing the generation itself (the generation continues to run and to update the retained assembled message regardless of any attached subscriber's write speed). On each `chunk`/terminal write, the handler SHALL check `res.writableLength` (Node's count of bytes currently buffered for that response) after calling `res.write()`; if it exceeds `SSE_ATTACH_MAX_BUFFERED_BYTES` (1 MiB), the handler SHALL treat the subscriber as unable to keep up and run the same cleanup as a client disconnect (remove its `chunk`/`terminal` listeners, clear its keepalive timer, end its response, release its `dial_chat_sse_active{kind="generation_attach"}` contribution) without emitting further chunks to it.

#### Scenario: Client disconnects mid-attach

- **WHEN** an attached client's connection closes before the generation reaches a terminal state
- **THEN** the backend removes that subscriber's listener and performs no further writes to its (closed) response, and the generation itself continues unaffected

#### Scenario: A slow attach subscriber is detached without affecting the generation

- **GIVEN** an attach subscriber whose response cannot drain as fast as chunks are produced
- **WHEN** that subscriber's buffered output (`res.writableLength`) exceeds `SSE_ATTACH_MAX_BUFFERED_BYTES` after a write
- **THEN** the backend detaches that subscriber (removes its listeners, clears its keepalive timer, ends its response) while the generation and any other concurrently attached subscriber continue receiving chunks and the eventual terminal event unaffected

#### Scenario: A well-behaved attach subscriber is never detached for backpressure

- **GIVEN** an attach subscriber whose response reads chunks promptly (buffered output stays under `SSE_ATTACH_MAX_BUFFERED_BYTES`)
- **WHEN** the generation produces any number of chunks before reaching a terminal state
- **THEN** the subscriber receives every chunk and the terminal event, and is never detached for backpressure
