# chat-hooks-conversation-stream Specification

## Purpose

Reusable hook exported by `@epam/ai-dial-chat-hooks` that drives completion streaming exclusively through an injected transport, with per-path streaming state, stale-chunk rejection, reload-after-complete semantics, and awaiting-generation resume detection.

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
- **THEN** the chunk is not applied to conversation state, but streaming
  continues to be tracked for that path

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
state, marks its path as streaming, watches for a resume/finalization
signal via `transport.watchConversation`, and performs a final
`transport.getConversation` check on timeout or stream end regardless of
outcome.

#### Scenario: Awaiting-generation conversation is marked streaming
- **WHEN** `resumeIfAwaitingGeneration` is called with a conversation
  whose last message is an empty, non-stopped assistant placeholder
- **THEN** the conversation's path is added to the streaming-paths set

#### Scenario: Resume resolves on a qualifying watch event
- **WHEN** `transport.watchConversation`'s stream emits an update event
  after which the conversation is no longer awaiting generation
- **THEN** the hook reloads the conversation, updates displayed state if
  it is still the displayed conversation, and clears the path from
  streaming-paths

#### Scenario: Resume times out and still resolves
- **WHEN** no qualifying watch event arrives before the resume timeout
- **THEN** the hook performs one final `transport.getConversation` check
  and clears the path from streaming-paths regardless of the result
