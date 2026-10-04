## MODIFIED Requirements

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
with `name === 'StreamUpstreamError'`) and `StreamInterruptedError` (an
`Error` subclass with `name === 'StreamInterruptedError'`) alongside
`GenerationConflictError`. The built-in `createChatStreamApi` transport
SHALL raise `StreamUpstreamError` for every in-band SSE error chunk, and
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

## ADDED Requirements

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
`resumingPathsRef`, `activeGenerationIdRef` and `latestGenerationIdsRef`.
No context, prop, or host callback is added.

When `onError` receives a `GenerationConflictError` for a start that passed
`resumeOnConflict: true` and is not superseded, the hook SHALL NOT settle it
as failed. It SHALL instead:

1. Call `onStreamError` once with the error.
2. Keep the path in `streamingPaths` and write no `streamErrorMessage`.
3. Clear `stoppablePath` when it still holds this generation, because the
   backend rejected this `generationId` and Stop has nothing to target.
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
`activeGenerationIdRef`, `completeGeneration`,
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
