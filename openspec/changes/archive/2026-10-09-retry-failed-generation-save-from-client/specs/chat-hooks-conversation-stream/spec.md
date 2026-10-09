## ADDED Requirements

### Requirement: A credentials-rejected terminal save gets one client recovery save

`useConversationStream` SHALL own this behavior; no new context is introduced. It applies only when both of these hold:

- the generation was started by `startStream` in the mounted hook;
- its completion stream reports a `GenerationPersistenceError` whose `status` is `401`.

It SHALL NOT apply to:

- a `GenerationPersistenceError` with any other `status` or with no `status`;
- a generation joined through attach, replay, or resume;
- the reload heuristic that keeps the warning when the stored copy still shows the unsaved placeholder.

`ConversationStreamTransport` SHALL gain an optional `saveConversation(path, conversation)` method:

- `path` is the same bucket-stripped conversation path that `streamCompletion` receives.
- It resolves with the saved conversation and rejects on any failure.
- The host implements it against its own client save. The library SHALL NOT construct an endpoint path, read credentials, or import a generated client for it.
- In this repository the app adapter in `apps/chat/src/utils/conversation-stream-transport.ts` implements it with `saveConversation` from `apps/chat/src/server-api/conversations.api.ts`.

When the conditions above hold and the transport implements `saveConversation`, the hook SHALL:

1. Settle the generation as it does today: streaming and stop controls are released, and the received answer stays buffered and displayed. It SHALL NOT write the persistence warning yet.
2. Make exactly one recovery attempt for that generation:
   1. read the stored conversation through `transport.getConversation`;
   2. restore the received answer at its recorded index; when the stored conversation does not end at that index in this turn's unsaved placeholder (the same check the terminal reload uses), treat the attempt as failed without saving;
   3. save the result once through `transport.saveConversation`.
3. Then, depending on the result:
   - **On success**, release that generation's buffer and never show the persistence warning for it. While the conversation is still displayed and the generation was not superseded, it SHALL show the saved conversation.
   - **On failure** (the read or the save rejects), write the persistence warning exactly as the immediate path does today: into the buffered message, and into the displayed message while the conversation is displayed and the generation was not superseded. It SHALL NOT try again.

When the transport does not implement `saveConversation`, or the conditions above do not hold, the warning SHALL be written immediately, as today.

The recovery SHALL NOT change displayed state for a superseded generation, for a buffer that a newer generation replaced, or for a conversation that is no longer displayed. It SHALL still save the received answer when the conversation is no longer displayed.

`onStreamError` SHALL still receive the original `GenerationPersistenceError` once, when the stream reports it. The recovery outcome is not reported through it.

No new user-visible strings (no i18n keys), no UI, no RTL impact, no feature flag, no metric or analytics event, no cache, and no new memoized callback are introduced.

#### Scenario: A 401 terminal save failure is recovered without any warning

- **GIVEN** a stream started in this tab has received an answer, and the transport implements `saveConversation`
- **WHEN** the stream reports `conversation_save_failed` with `status: 401`, and the recovery read and save resolve
- **THEN** the hook makes one read and one `saveConversation` call with the received answer at its index, and the persistence warning is never shown for that message

#### Scenario: No warning is shown while the recovery is in flight

- **WHEN** the stream reports `conversation_save_failed` with `status: 401` and the recovery save has not resolved yet
- **THEN** the received answer is displayed without the persistence warning, and streaming and stop controls are already released

#### Scenario: A failed recovery shows today's warning

- **WHEN** the recovery read or save rejects
- **THEN** the displayed message shows the persistence warning, the received answer stays buffered, and no further save is attempted for that generation

#### Scenario: Any other persistence failure keeps today's behavior

- **WHEN** the stream reports `conversation_save_failed` with a `status` other than `401`, or with no `status`
- **THEN** the hook shows the persistence warning immediately and makes no recovery read or save

#### Scenario: A host without saveConversation keeps today's behavior

- **WHEN** the transport does not implement `saveConversation` and the stream reports `conversation_save_failed` with `status: 401`
- **THEN** the hook shows the persistence warning immediately and makes no recovery read or save

#### Scenario: A superseded generation never touches displayed state

- **GIVEN** a recovery is in flight
- **WHEN** the user starts a new generation on the same conversation, or navigates to another conversation, before it settles
- **THEN** the recovery result, success or failure, does not change the displayed conversation or the newer generation's buffer

#### Scenario: Attach subscribers do not save

- **WHEN** a generation joined through attach or resume ends with an `error` event whose `errorType` is `conversation_save_failed`
- **THEN** the hook keeps the replayed answer with the persistence warning and makes no recovery save

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

When the transport reports a `GenerationPersistenceError` — the backend
sent an in-band error chunk with `error.type === 'conversation_save_failed'`
(`GenerationPersistenceError.type`) — the hook SHALL write its
`generationPersistenceErrorMessage` parameter (defaulting to
`DEFAULT_GENERATION_PERSISTENCE_ERROR_MESSAGE`) to `streamErrorMessage` and
keep the received answer in the buffer, as
`backend-owned-generation-persistence` defines. The one exception is a
`GenerationPersistenceError` whose `status` is `401` on a stream started by
`startStream` when the transport implements `saveConversation`. There, the
warning is deferred until the single recovery save fails, and never written
if it succeeds, as "A credentials-rejected terminal save gets one client
recovery save" defines.

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

### Requirement: Buffered live message can be restored after navigation
The hook SHALL accumulate accepted chunks into a per-path assistant-message
snapshot, including merged `custom_content.stages`, regardless of whether the
path is displayed. It SHALL expose
`restoreBufferedGeneration(conversationId, conversation)`, which returns the
conversation unchanged when no buffer exists and otherwise restores the
buffered message at its recorded index. Completion and error callbacks SHALL
clear the buffer because the backend's terminal save is then authoritative,
except where the received answer must survive: a `GenerationPersistenceError`
(until its single recovery save succeeds, when one applies),
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
