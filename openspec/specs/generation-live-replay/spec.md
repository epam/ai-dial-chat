# generation-live-replay Specification

## Purpose

Backend-side buffering and multicast of an active generation's in-flight
assistant message, exposed through the `POST /api/v1/conversations/completions/attach`
SSE endpoint so a late-joining client (e.g. after a hard refresh mid-generation)
can snapshot the currently assembled message and then receive the remaining
live chunks and terminal event, without having watched the generation from its
start.

## Requirements

### Requirement: Backend retains in-flight assistant message content per active generation

`ConversationGenerationService`'s registry entry (`apps/chat-api/src/conversations/conversation-generation.service.ts`) SHALL retain the current assembled assistant `ConversationMessageDto` for each active generation, updated every time `ConversationStreamingService.streamCompletion`'s relay loop (`relayModelCompletion` or `ResponsesAdapter.stream`) applies a chunk via `applyChunkToMessage`. This retained content SHALL include merged `custom_content.stages`, matching exactly what the assembled message would contain if inspected at that instant.

#### Scenario: Assembled message reflects the latest chunk

- **WHEN** a chunk is applied to the in-flight assistant message during an active generation
- **THEN** the registry entry's retained assembled message reflects that chunk's content immediately, before the next chunk is processed

### Requirement: Late subscribers can attach to an active generation by conversation path

`POST /api/v1/conversations/completions/attach` SHALL accept `{ path }` for the caller's authenticated session and, when an active generation exists for that `sessionId`+`path` (the same key `ConversationGenerationService.abort` uses), SHALL open an SSE stream that:

1. Emits one `{ type: "snapshot", message: <ConversationMessageDto> }` event carrying the registry entry's current assembled message, synchronously captured before any subsequent chunk can be missed.
2. Emits one `{ type: "chunk", ... }` event — in the same shape as a live `/completions` chunk — for every chunk produced by the generation after the snapshot was captured.
3. Emits exactly one terminal event — `{ type: "done" }`, `{ type: "error", message?: string }`, or `{ type: "stopped" }` — matching the generation's actual outcome, then ends the response.

The endpoint SHALL support more than one concurrent subscriber for the same active generation, each receiving its own snapshot-then-live-chunks sequence.

#### Scenario: Attach immediately after generation start

- **WHEN** a client attaches shortly after a generation registers, before any chunk has been applied
- **THEN** the snapshot event carries the empty placeholder message, followed by every chunk as it is produced

#### Scenario: Attach mid-generation

- **WHEN** a client attaches after several chunks have already been applied
- **THEN** the snapshot event carries the content assembled so far (including any merged stages), and only chunks produced after the attach are delivered as separate `chunk` events — the snapshot is not followed by a re-delivery of chunks it already contains

#### Scenario: Two concurrent subscribers on the same generation

- **WHEN** two clients under the same session both attach to the same active generation
- **THEN** each receives its own snapshot (reflecting the state at its own attach time) and its own subsequent live chunk events, independently

#### Scenario: Generation finishes while a subscriber is attached

- **WHEN** the generation reaches `finalize()` while an attach subscriber is connected
- **THEN** the subscriber receives the matching terminal event (`done`, `error`, or `stopped`) before the SSE response ends

### Requirement: No active generation for the path returns 404

`POST /api/v1/conversations/completions/attach` SHALL respond `404` when no active generation exists in the registry for the caller's `sessionId`+`path` — including when a generation existed but already finalized before the attach request arrived.

#### Scenario: Attach after the generation already finished

- **WHEN** the attach request arrives after the registry entry for that path has already been deleted (via `complete`/`error`)
- **THEN** the endpoint responds `404` and opens no SSE stream

#### Scenario: Attach for a path with no generation history

- **WHEN** the attach request targets a path for which no generation was ever registered in this session
- **THEN** the endpoint responds `404`

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
