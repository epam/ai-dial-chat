## MODIFIED Requirements

### Requirement: A generation conflict is shown as a host-supplied message
The hook SHALL show only host-supplied or upstream-supplied text in `streamErrorMessage`.
When the transport reports a `GenerationConflictError` — the backend
rejected the completion because this conversation is already generating,
typically from another browser tab of the same session — the hook SHALL
write its `generationConflictMessage` parameter (defaulting to
`DEFAULT_GENERATION_CONFLICT_MESSAGE`) to the placeholder message's
`streamErrorMessage` instead of the raw error text, and SHALL otherwise
settle the generation exactly as any other stream error does.

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
- **WHEN** `onError` receives a `GenerationConflictError`
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
