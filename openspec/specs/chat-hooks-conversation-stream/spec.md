# chat-hooks-conversation-stream Specification

## Purpose

Reusable hook exported by `@epam/ai-dial-chat-hooks` that drives completion streaming exclusively through an injected transport, with per-path streaming state and live-message buffering, stale-chunk rejection, reload-after-complete semantics, and awaiting-generation resume detection.

## Requirements

### Requirement: Transport-driven completion streaming
`@epam/ai-dial-chat-hooks` SHALL export `useConversationStream`, which
performs all completion start/stop/watch/reload operations exclusively
through an injected `ConversationStreamTransport` and SHALL NOT hardcode
an `/api` path, CSRF handling, or import an app `server-api` module.

#### Scenario: Start delegates to the injected transport
- **WHEN** `startStream` is called
- **THEN** the only network-shaped call made is
  `transport.streamCompletion(...)` with the caller-supplied path,
  message, model, and options

#### Scenario: Stop delegates to the injected transport
- **WHEN** `handleStop` is called while a generation is active and
  stoppable
- **THEN** the only call made is `transport.stopCompletion({ generationId, path })`

### Requirement: Per-path streaming state with stale-chunk rejection
The hook SHALL track streaming state per conversation path (not as a
single boolean) and SHALL reject a chunk whose generation id does not
match the currently active generation for that path.

#### Scenario: Concurrent generations across conversations
- **WHEN** a generation is active for conversation A and `startStream` is
  called for conversation B
- **THEN** `isStreaming` reported for A and for B are independent, and a
  chunk for A does not affect B's state

#### Scenario: Stale chunk is dropped
- **WHEN** a chunk arrives whose generation id no longer matches the
  active generation for its path
- **THEN** the chunk is not applied to conversation state

#### Scenario: Chunk for a non-displayed conversation is dropped
- **WHEN** a chunk arrives for a conversation path that is not the
  currently displayed `conversationId`
- **THEN** the chunk is not applied to the displayed conversation state, but
  it is accumulated in that path's live-message buffer and streaming continues
  to be tracked for the path

### Requirement: Buffered live message can be restored after navigation
The hook SHALL accumulate accepted chunks into a per-path assistant-message
snapshot, including merged `custom_content.stages`, regardless of whether the
path is displayed. It SHALL expose
`restoreBufferedGeneration(conversationId, conversation)`, which returns the
conversation unchanged when no buffer exists and otherwise restores the
buffered message at its recorded index. Completion and error callbacks SHALL
clear the buffer because the backend's terminal save is then authoritative.

#### Scenario: Earlier and background stages are restored
- **WHEN** stage chunks arrive before and while their conversation is hidden
  and the host reloads that conversation before completion
- **THEN** `restoreBufferedGeneration` returns it with every accumulated stage
  update, rather than only updates received after the conversation became
  visible again

#### Scenario: Completed generation no longer uses its buffer
- **WHEN** the transport signals completion or error for a generation
- **THEN** a later `restoreBufferedGeneration` call does not restore that
  generation's in-memory snapshot

### Requirement: Reload-after-complete, never trust the local stream
On stream completion, the hook SHALL reload the conversation through
`transport.getConversation` rather than trusting the locally-accumulated
streamed content, and SHALL NOT reload eagerly on `handleStop` — reload
happens only once the transport's completion signal (driven by the
backend's save) fires.

#### Scenario: Completion triggers a reload
- **WHEN** `transport.streamCompletion`'s `onComplete` callback fires for
  the displayed conversation
- **THEN** the hook calls `transport.getConversation` and replaces
  conversation state with the result

#### Scenario: Stop does not reload before completion
- **WHEN** `handleStop` is called
- **THEN** no reload happens until the transport's own completion signal
  fires afterward

### Requirement: Optional client-channel and overlay capabilities
The hook SHALL accept `channel` and `overlay` as independently optional
parameters; a consumer that supplies neither SHALL NOT be required to pass
no-op implementations.

#### Scenario: Streaming works without a client channel
- **WHEN** `channel` is omitted
- **THEN** `startStream` still starts a completion, passing no
  `clientChannelId` to the transport

#### Scenario: Streaming works without overlay notification
- **WHEN** `overlay` is omitted
- **THEN** `startStream`/`handleStop` still function, and no overlay
  notification call is attempted

### Requirement: Resume detection after a hard refresh mid-generation

The hook SHALL expose `resumeIfAwaitingGeneration(conversationId,
conversation)`, which detects a conversation left in an awaiting-generation
state, marks its path as streaming, and attempts to attach to the backend's
live replay stream via `transport.attachToGeneration` before falling back to
the watch-based resume path. On a successful attach, it SHALL seed the
per-path buffered message from the stream's `snapshot` event, apply every
subsequent `chunk` event through the same merge logic `startStream`'s
`onChunk` uses, and treat a terminal event (`done`/`error`/`stopped`) the same
way the hook already treats a live generation's own completion/error signal —
including performing the existing reload via `transport.getConversation`
rather than trusting the locally-accumulated replayed content. If
`attachToGeneration` fails outright (attach not found, network error, or any
unexpected response), or the attach stream ends without a terminal event
before `GENERATION_RESUME_WATCH_TIMEOUT_MS` elapses, the hook SHALL fall back
to the pre-existing behavior: watch for a resume/finalization signal via
`transport.watchConversation`, and perform a final `transport.getConversation`
check on timeout or stream end regardless of outcome.

#### Scenario: Awaiting-generation conversation is marked streaming

- **WHEN** `resumeIfAwaitingGeneration` is called with a conversation
  whose last message is an empty, non-stopped assistant placeholder
- **THEN** the conversation's path is added to the streaming-paths set

#### Scenario: Attach succeeds and replays progressively

- **WHEN** `transport.attachToGeneration` succeeds and delivers a `snapshot`
  event followed by one or more `chunk` events
- **THEN** the hook seeds the buffered message from the snapshot, applies each
  chunk to it via the existing merge logic, and — for the currently displayed
  conversation — the assistant message content visibly updates as each event
  arrives, before any terminal event or reload occurs

#### Scenario: Attach terminal event triggers the existing reload path

- **WHEN** the attach stream emits a `done`, `error`, or `stopped` terminal
  event
- **THEN** the hook reloads the conversation via `transport.getConversation`
  and applies the result exactly as it does for a live generation's own
  completion/error, discarding the locally-replayed content in favor of the
  fetched result

#### Scenario: Attach failure falls back to the watch-based resume path

- **WHEN** `transport.attachToGeneration` fails or is unavailable (e.g. no
  active generation found, or the backend does not yet expose the attach
  endpoint)
- **THEN** the hook falls back to subscribing via `transport.watchConversation`
  and re-checking `isAwaitingGenerationResume` on each qualifying update,
  exactly as it did before this change

#### Scenario: Resume resolves on a qualifying watch event (fallback path)

- **WHEN** the hook is on the fallback watch path and
  `transport.watchConversation`'s stream emits an update event after which the
  conversation is no longer awaiting generation
- **THEN** the hook reloads the conversation, updates displayed state if
  it is still the displayed conversation, and clears the path from
  streaming-paths

#### Scenario: Resume times out and still resolves

- **WHEN** no qualifying event arrives (via attach or the fallback watch)
  before the resume timeout
- **THEN** the hook performs one final `transport.getConversation` check
  and clears the path from streaming-paths regardless of the result
