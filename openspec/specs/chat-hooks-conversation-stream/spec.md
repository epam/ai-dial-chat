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
- **THEN** the only call made is
  `transport.stopCompletion({ generationId, path, content })`, where
  `content` is the buffered answer text shown so far (the backend saves it
  for a generation whose text it does not hold)

### Requirement: A generation conflict is shown as a host-supplied message
The hook SHALL show only host-supplied or upstream-supplied text in `streamErrorMessage`.
When the transport reports a `GenerationConflictError` — the backend
rejected the completion because this conversation is already generating,
typically from another browser tab of the same session — the hook SHALL
write its `generationConflictMessage` parameter (defaulting to
`DEFAULT_GENERATION_CONFLICT_MESSAGE`) to the placeholder message's
`streamErrorMessage` instead of the raw error text, and SHALL otherwise
settle the generation exactly as any other stream error does. The one
exception is a start that passed `{ resumeOnConflict: true }`: its
conflict SHALL first be handed over as "A conflict on an opted-in start
joins the running generation" defines, and SHALL reach this conflict
message only when that handover cannot resolve the generation.

When the transport reports a `StreamUpstreamError` — DIAL Core sent an
in-band `{ error: { message } }` SSE chunk — the hook SHALL write that
error's `message` to `streamErrorMessage`, because it is upstream text
intended for the user.

When the transport reports a `GenerationPersistenceError` — the backend
sent an in-band error chunk with `error.type === 'conversation_save_failed'`
(`GenerationPersistenceError.type`) — the hook SHALL write its
`generationPersistenceErrorMessage` parameter (defaulting to
`DEFAULT_GENERATION_PERSISTENCE_ERROR_MESSAGE`) to `streamErrorMessage` and
keep the received answer in the buffer, as
`backend-owned-generation-persistence` defines.

When the transport reports a `StreamInterruptedError` — the network
connection carrying the stream was lost or stalled while the backend-owned
generation may still be running — the hook SHALL NOT settle the generation
as failed; it SHALL enter recovery as `generation-stream-recovery` defines,
and SHALL write `streamErrorMessage: ''` only if that recovery cannot
resolve the generation.

Every other error (a non-OK HTTP status other than 409, a missing response
body, or any other error a custom transport raises) is transport detail:
the hook SHALL write `streamErrorMessage: ''` so the host renders its
localized fallback, and SHALL NOT surface that error's `message` to the
user. A transport failure is still never disguised as a conflict.

`useConversationStream` SHALL accept an optional
`onStreamError?: (error: Error) => void` parameter and SHALL call it once
with the original error object for every error it settles through
`onError` (including conflicts and upstream errors), so the host can log
or report it. The lib itself SHALL NOT log it or choose a logging
destination.

`libs/chat-hooks` SHALL export `StreamUpstreamError` (an `Error` subclass
with `name === 'StreamUpstreamError'`), `StreamInterruptedError` (an
`Error` subclass with `name === 'StreamInterruptedError'`) and
`GenerationPersistenceError` alongside `GenerationConflictError`. The
built-in `createChatStreamApi` transport SHALL raise `StreamUpstreamError`
for every in-band SSE error chunk except one whose `error.type` is
`conversation_save_failed` (raised as `GenerationPersistenceError`), and
`StreamInterruptedError` for the network-level failures listed in
`generation-stream-recovery`.

#### Scenario: Conflict shows the host's message
- **WHEN** `onError` receives a `GenerationConflictError` for a start that
  did not pass `resumeOnConflict`
- **THEN** the assistant placeholder's `streamErrorMessage` is the
  `generationConflictMessage` the host supplied, and `isStreaming` /
  `canStopStreaming` return to `false` so the composer is usable again

#### Scenario: An upstream in-band error shows its own message
- **WHEN** `onError` receives a `StreamUpstreamError('Rate limit exceeded')`
- **THEN** the assistant placeholder's `streamErrorMessage` is
  `'Rate limit exceeded'`

#### Scenario: A transport error is hidden behind the fallback
- **WHEN** `onError` receives `new TypeError('Failed to fetch')` from a
  custom transport, or `new Error('Stream request failed with status 502')`
- **THEN** the assistant placeholder's `streamErrorMessage` is `''`, and
  `isStreaming` / `canStopStreaming` return to `false`

#### Scenario: An interruption enters recovery instead of the fallback
- **WHEN** `onError` receives a `StreamInterruptedError`
- **THEN** no `streamErrorMessage` is written immediately, `isStreaming`
  stays `true`, and the hook re-fetches the conversation through
  `transport.getConversation` per `generation-stream-recovery`

#### Scenario: The host still receives the raw error
- **WHEN** `onError` receives any error and the host passed `onStreamError`
- **THEN** `onStreamError` is called exactly once with that same error
  object, and omitting `onStreamError` changes nothing else

#### Scenario: The built-in transport tags in-band errors
- **WHEN** `createChatStreamApi`'s stream reader parses a
  `data: {"error":{"message":"Model overloaded"}}` line
- **THEN** it calls `onError` with a `StreamUpstreamError` whose `message`
  is `'Model overloaded'`

#### Scenario: The built-in transport leaves non-network failures untagged
- **WHEN** the response is non-OK and not 409, or the body is missing
- **THEN** `onError` receives an error that is neither a
  `StreamUpstreamError`, a `GenerationConflictError`, nor a
  `StreamInterruptedError`

#### Scenario: The built-in transport tags network failures as interruptions
- **WHEN** `fetch` rejects, or `reader.read()` throws a non-abort error
  after a 2xx response
- **THEN** `onError` receives a `StreamInterruptedError` whose `cause` is
  the original error

### Requirement: Per-path streaming state with stale-chunk rejection
The hook SHALL track streaming state per conversation path (not as a
single boolean) and SHALL reject a chunk whose generation id does not
match the newest generation started for that path. The newest generation
id SHALL be tracked per conversation path (`latestGenerationIdsRef`), never
as a single hook-wide id, so starting a generation in one conversation never
makes another conversation's still-running generation stale. This applies
to both the immediate write and the batched per-frame write.

Stop state SHALL be tracked per conversation path in the same way: the
locally started generation that `handleStop` targets is held per path
(`activeGenerationIdsRef`, path → generation id), and `canStopStreaming`
reads a per-path set of stoppable paths. `handleStop` SHALL resolve the
generation id for the displayed conversation from that per-path entry, and a
generation that settles SHALL clear only its own path's entry, and only while
that entry still holds its id.

#### Scenario: Concurrent generations across conversations
- **WHEN** a generation is active for conversation A and `startStream` is
  called for conversation B
- **THEN** `isStreaming` reported for A and for B are independent, and a
  chunk for A does not affect B's state

#### Scenario: A generation in another conversation does not cut off a running one
- **WHEN** conversation A's generation is streaming, the user navigates to
  conversation B and starts a generation there, and A's stream keeps
  delivering chunks
- **THEN** every later chunk of A is still accumulated in A's live-message
  buffer (and written to the displayed state once the user returns to A
  mid-generation), and no chunk of B is applied to A's buffer or state

#### Scenario: Stop reaches a conversation's generation while another conversation generates
- **WHEN** conversation A's generation is streaming, the user navigates to
  conversation B and starts a generation there, then returns to A
- **THEN** `canStopStreaming` is `true` for A, and `handleStop` calls
  `transport.stopCompletion` once, with A's `generationId` and A's path,
  leaving B's generation untouched
- **AND WHEN** B's generation finishes while A's is still running
- **THEN** A stays stoppable and Stop still targets A's generation; likewise
  A finishing leaves B stoppable

#### Scenario: Stale chunk is dropped
- **WHEN** a chunk arrives whose generation id is no longer the newest
  generation started for its path (regenerate, edit or re-submit on the same
  conversation)
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
clear the buffer because the backend's terminal save is then authoritative,
except where the received answer must survive: a `GenerationPersistenceError`,
a terminal reload that still shows the unsaved placeholder, or a rejected
terminal reload keep the buffer (see `backend-owned-generation-persistence`),
and a reload that shows a pending background message hands it to the resume
flow.

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

### Requirement: A superseded generation never touches shared state
The terminal callbacks of an older generation on a path SHALL NOT, once a newer
generation has been started for that path, clear the path's streaming state,
report a generation end to the overlay, write a stream error into the
conversation, or replace conversation state with the reload they fetched. The
reload is re-checked after its round trip, because the newer generation can
start while that reload is in flight.

#### Scenario: Stopped generation completes after the user re-submitted
- **WHEN** the user stops a generation and — while the stopped generation's
  post-completion reload is still in flight — submits an edit that starts a
  new generation on the same path
- **THEN** the stopped generation's completion leaves `isStreaming` true for
  the path and does not restore the answer it had fetched over the edited
  messages

#### Scenario: Superseded generation errors
- **WHEN** a superseded generation's `onError` fires
- **THEN** no `streamErrorMessage` is written onto the newer generation's
  answer and the path stays marked as streaming

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
rather than trusting the locally-accumulated replayed content (a terminal
`error` event whose `errorType` is `conversation_save_failed` instead keeps the
replayed answer with the persistence warning, without a reload). The attach
stream has no timeout: it waits for a genuine terminal event, so a
long-running generation is never abandoned. If `attachToGeneration` fails
outright (attach not found, network error, or any unexpected response), or
the attach stream ends without a terminal event, the hook SHALL fall back to
the pre-existing behavior: watch for a resume/finalization signal via
`transport.watchConversation`, bounded by
`GENERATION_RESUME_WATCH_TIMEOUT_MS` (5 minutes), and perform a final
`transport.getConversation` check on timeout or stream end regardless of
outcome.

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

- **WHEN** the hook is on the fallback watch path and no qualifying event
  arrives before `GENERATION_RESUME_WATCH_TIMEOUT_MS`
- **THEN** the hook performs one final `transport.getConversation` check
  and clears the path from streaming-paths regardless of the result

### Requirement: Optional per-frame batching of displayed chunks

`useConversationStream` SHALL accept an optional `batchChunksPerFrame?: boolean` parameter, default `false`. With the default, chunk application is exactly as it is today.

When `batchChunksPerFrame` is `true`:

- **Per chunk:**
  - Each accepted chunk SHALL still be applied synchronously to the per-path buffered message. The buffer is never deferred, so restore-after-navigation and completion checks see every chunk immediately.
  - The display write (`setConversation` with the buffered message) SHALL be coalesced: at most one pending write per conversation path, scheduled with `requestAnimationFrame`. A `setTimeout(…, 16)` fallback is used when `requestAnimationFrame` is unavailable.
- **At flush time:** the pending write SHALL re-check the same guards the immediate write uses: the generation is not superseded on its own path, the path is displayed, and a previous conversation exists. It then applies `restoreBufferedMessage` with the buffer's current content and assigns `state.conversationRef.current` inside the updater, as today.
- **Before terminal transitions:** a pending write SHALL be flushed synchronously before any of the following touches displayed state for that path:
  - the completion reload's `setConversation`;
  - error handling and interrupted-stream recovery;
  - `handleStop`'s settle;
  - a superseding `startStream` for the same path.
- **Cancellation:** a pending write SHALL be cancelled, not flushed, when the path stops being displayed or the hook unmounts.
- **Resume path:** the resume path (`generation-resume.ts` chunk application) SHALL batch the same way.

The parameter is host-agnostic and uses only the standard browser frame API. `apps/chat` passes `true`. This adds no user-visible string, feature flag or telemetry. The message log's `aria-live` region still receives every text addition, at most one frame later.

#### Scenario: Several chunks in one frame produce one displayed update

- **GIVEN** `batchChunksPerFrame: true` and a displayed streaming conversation
- **WHEN** three chunks arrive before the next animation frame
- **THEN** `setConversation` is invoked once when the frame fires, and the displayed message contains all three chunks' content

#### Scenario: Completion never shows an older state than the last chunk

- **GIVEN** `batchChunksPerFrame: true` and a chunk whose display write is still pending
- **WHEN** the stream completes
- **THEN** the pending write is flushed before the completion reload, and no later frame re-applies the buffer over the reloaded conversation

#### Scenario: A pending write is dropped when the user navigates away

- **GIVEN** `batchChunksPerFrame: true` and a pending display write for path P
- **WHEN** P stops being the displayed path before the frame fires
- **THEN** the write is cancelled and the newly displayed conversation is untouched, while P's buffer still holds all chunks

#### Scenario: The default keeps synchronous application

- **WHEN** `batchChunksPerFrame` is omitted
- **THEN** each accepted chunk calls `setConversation` synchronously, as before

### Requirement: A pending background message is awaiting resume

The hook's awaiting-generation detection SHALL treat a conversation that contains a message with `backgroundGeneration.status: "pending"` — at any position, even when that message already carries a `responseId` or other payload and even when a status message follows it — as awaiting resume. The resume SHALL seed and update the buffered message at **that** message's index (not at the last index), and its terminal reload check SHALL compare against that index. A message whose `backgroundGeneration.status` is `completed`, `stopped`, or `failed` SHALL NOT make the conversation awaiting resume. For conversations without `backgroundGeneration`, detection and the buffer index SHALL behave exactly as before this change.

The hook SHALL read only this data field of the conversation it is given. It SHALL NOT call DIAL Core, read feature flags, or know which deployments are eligible — the backend's attach and Stop endpoints, reached through the injected transport, perform all recovery.

**State owner:** `useConversationStream` (existing per-path streaming state); no new context. **UI / i18n / RTL / a11y impact:** none — the existing generating indicator, error banner and Retry are reused.

#### Scenario: Pending background message with responseId resumes

- **WHEN** a conversation is loaded that contains a message with `responseId` set and `backgroundGeneration.status: "pending"`
- **THEN** it is detected as awaiting resume and the hook attaches through the transport

#### Scenario: Pending message followed by a status message resumes at its own index

- **WHEN** the conversation is `[user, assistant{backgroundGeneration.status: "pending"}, status(model changed)]` and the attach replays chunks
- **THEN** the chunks update the assistant message at index 1, and the status message at index 2 is unchanged

#### Scenario: Finished background message does not resume

- **WHEN** every message with `backgroundGeneration` has `status` `completed`, `stopped`, or `failed`, and the last message is not otherwise an unresolved placeholder
- **THEN** it is not awaiting resume and renders normally

#### Scenario: Messages without the field are unchanged

- **WHEN** no message in the conversation has a `backgroundGeneration` field
- **THEN** awaiting-resume detection returns the same result as before this change

#### Scenario: Replay from the beginning shows no duplicates

- **WHEN** an attach delivers a snapshot of the stored empty placeholder followed by chunks replayed from the first token
- **THEN** the displayed message equals the concatenation of the replayed chunks, with no text repeated

### Requirement: A stream that ends on a pending background message resumes

When a completion stream or an attach stream ends and the hook's reload via `transport.getConversation` returns a conversation that contains a message with `backgroundGeneration.status: "pending"`, the hook SHALL NOT settle the path as finished. It SHALL keep the path streaming and start the existing attach-then-watch resume flow for it, exactly as on page load. This covers a stream ended by the backend's max-duration detach and a final save that failed and left the message `pending`. A message without `backgroundGeneration`, or with a finished status, SHALL settle exactly as before this change.

#### Scenario: Max-duration detach resumes instead of settling

- **WHEN** the completion stream ends without a terminal event and the reloaded conversation contains a `pending` background message
- **THEN** the path stays streaming, the hook attaches through the transport, and the generating indicator stays visible

#### Scenario: Normal completion still settles

- **WHEN** the completion stream ends and the reloaded last message has `backgroundGeneration.status: "completed"` or no `backgroundGeneration`
- **THEN** the path settles and streaming state is cleared, as before this change

### Requirement: Stop is available for a resumed background generation

While the hook is resuming a conversation that contains a message with `backgroundGeneration.status: "pending"` — after a page load, a refresh, or navigation back — `canStopStreaming` SHALL be `true` for that path, and `handleStop` SHALL call `transport.stopCompletion({ generationId, path, content })` with `generationId` taken from the message's `backgroundGeneration.generationId`. The resume SHALL then settle through its existing terminal handling (the attach `stopped` event or a watch update, followed by the reload). For a resumed message without `backgroundGeneration`, Stop availability SHALL stay as before this change.

The hook SHALL only read the id from the conversation it is given; it SHALL NOT decide eligibility or call DIAL Core. **UI / i18n / RTL / a11y impact:** none new — the existing Stop control, its label, and its keyboard behavior are reused.

#### Scenario: Stop after a refresh

- **GIVEN** the page was refreshed during a background generation and the hook resumed it through attach
- **WHEN** the user activates Stop
- **THEN** `transport.stopCompletion` is called with the message's `backgroundGeneration.generationId`, and after the attach `stopped` event the reloaded stopped partial is shown and `isStreaming`/`canStopStreaming` become `false`

#### Scenario: Resumed non-background message keeps today's Stop behavior

- **WHEN** the hook resumes a conversation whose last message has no `backgroundGeneration`
- **THEN** `canStopStreaming` behaves exactly as before this change

### Requirement: A conflict on an opted-in start joins the running generation

`startStream` SHALL accept an optional trailing `options` argument of the
exported type `StartStreamOptions` (`{ resumeOnConflict?: boolean }`,
default `false`). `UseConversationStreamResult.startStream` and
`ConversationStreamStarter` SHALL declare the same optional parameter, so
every existing call site stays valid. The flag is a resolved value supplied
by the host; the hook SHALL NOT infer it from `mode`, routes, or any host
state.

State ownership: all handover state SHALL live inside
`useConversationStream`, in its existing refs `bufferedGenerationsRef`,
`resumingPathsRef`, `activeGenerationIdsRef` and `latestGenerationIdsRef`.
No context, prop, or host callback is added.

When `onError` receives a `GenerationConflictError` for a start that passed
`resumeOnConflict: true` and is not superseded, the hook SHALL NOT settle it
as failed. It SHALL instead:

1. Call `onStreamError` once with the error.
2. Keep the path in `streamingPaths` and write no `streamErrorMessage`.
3. Clear this path's stoppable state when the path's active generation is
   still this one, because the backend rejected this `generationId` and Stop
   has nothing to target.
4. Add the path to `resumingPathsRef`, so a concurrent
   `resumeIfAwaitingGeneration` does not start a second resume.
5. Re-fetch the conversation with `transport.getConversation` on the
   `RECOVERY_REFETCH_DELAYS_MS` schedule. A rejected fetch SHALL be retried,
   and so SHALL a fetched conversation in the pre-start shape: its
   `messages.length === messageIndex`, and its last message has
   `role: user`. In that shape the backend has registered the generation
   but not yet saved its start state.
6. Classify the first conversation `server` that is not pre-start, as
   `generation-stream-recovery` does:
   - **Still generating.** `server.messages.length - 1 === messageIndex`
     and `isAwaitingGenerationResume(server)` is true, or `server` has a
     pending background message. The hook SHALL hand over to the resume
     flow with `server`.
   - **Already finished.** `server.messages.length - 1 === messageIndex`,
     the last message is an assistant message, and
     `isAwaitingGenerationResume(server)` is false. The hook SHALL apply
     `server` to the displayed state and clear the buffer.
   - **Not recoverable.** Any other shape; every retry rejected; or the
     result is still pre-start when the schedule ends. The hook SHALL
     settle exactly as a conflict without the option does, writing
     `generationConflictMessage`.
7. Apply every state write only while `isPathDisplayed(path)` holds and
   the generation is not superseded.

Settlement bookkeeping (`removeStreamingPath`, clearing
`activeGenerationIdsRef`, `completeGeneration`,
`channel?.notifyGenerationSettled`, `overlay?.notifyGenerationEnd`) SHALL
run once, when the handover ends in any outcome. After a handover to the
resume flow, it runs when that flow settles. The hook SHALL NOT send
another completion request for the path as part of the handover.

`fetchConversationForRecovery` SHALL accept an optional
`isPending(conversation)` predicate. A result for which it returns `true`
is retried on the same schedule as a rejection. Without the predicate,
behaviour is unchanged.

No new i18n keys: the handover reuses the typing indicator and the
existing conflict text. No RTL or a11y impact, since no markup is added.
Not gated by `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES`. No cache is
introduced. Observability is the existing `onStreamError`; no metric is
added.

#### Scenario: Conflict in the pre-start window ends on the persisted answer
- **GIVEN** a start with `resumeOnConflict: true` for a placeholder at
  `messageIndex`
- **WHEN** `onError` receives a `GenerationConflictError`, the first
  re-fetch returns a conversation whose last message is the user message
  at `messageIndex - 1`, and a later re-fetch returns the unresolved
  placeholder at `messageIndex`
- **THEN** no `streamErrorMessage` is written, `isStreaming` stays `true`
  and `canStopStreaming` is `false`, `transport.attachToGeneration` is
  called for the path, and once attach emits `done` the displayed
  conversation equals the reloaded server copy

#### Scenario: Conflict after the other generation already finished
- **WHEN** an opted-in conflict's re-fetch returns a completed assistant
  answer at `messageIndex`
- **THEN** the displayed conversation is replaced with that copy,
  `isStreaming` becomes `false`, and no `streamErrorMessage` is written

#### Scenario: Conflict that cannot be resolved keeps today's message
- **WHEN** every re-fetch for an opted-in conflict rejects, or the result
  is still pre-start when the schedule ends
- **THEN** the placeholder's `streamErrorMessage` is the host's
  `generationConflictMessage`, and `isStreaming` / `canStopStreaming` are
  `false`

#### Scenario: No second completion is sent
- **WHEN** an opted-in conflict is handed over in any outcome
- **THEN** `transport.streamCompletion` has been called exactly once for
  the path

#### Scenario: A superseded opted-in start does not hand over
- **WHEN** a `GenerationConflictError` arrives for an opted-in start that
  a newer generation on the same path has superseded
- **THEN** no re-fetch is made and no state is written

### Requirement: The resume watch fallback re-checks once subscribed

The hook SHALL call `transport.getConversation` once after the resume
flow's fallback `transport.watchConversation` stream has opened. If that copy is no longer awaiting resume, the hook SHALL finish
the resume with it and close the watch. Otherwise it SHALL keep watching
exactly as before. A rejected check SHALL be ignored, and the watch SHALL
continue.

#### Scenario: Generation finished before the watch subscribed
- **GIVEN** attach is unavailable for an awaiting path
- **WHEN** the watch stream opens and the immediate re-check returns a
  conversation that is no longer awaiting resume
- **THEN** the resume finishes with that conversation without waiting for
  an `UPDATE` event or for `GENERATION_RESUME_WATCH_TIMEOUT_MS`

#### Scenario: Generation still running when the watch subscribed
- **WHEN** the immediate re-check still returns an awaiting conversation
- **THEN** the watch continues and resolves on a later qualifying
  `UPDATE` event, as before
