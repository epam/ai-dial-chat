## MODIFIED Requirements

### Requirement: Chat-stream completion transport is a factory over an injected fetch and host capabilities

`@epam/ai-dial-chat-hooks` SHALL export `createChatStreamApi(deps: CreateChatStreamApiDeps)` (`libs/chat-hooks/src/conversation/create-chat-stream-api.ts`; `deps: { getCsrfToken: () => string | null; setCsrfToken: (token: string | null) => void; completionsBasePath: string; getTimezone?: () => string | undefined; fetchImpl?: typeof fetch; idleTimeoutMs?: number }`), returning `ChatStreamApi { streamCompletion, stopCompletion }`, which `apps/chat/src/server-api/chat-stream.api.ts` composes with `completionsBasePath: ApiEndpoints.CONVERSATIONS` and `getTimezone: getBrowserTimezone`. Behavior: streamed completion parsing across partial chunks, comments/blank lines, `[DONE]`, malformed events (skipped), backend error chunks (a `conversation_save_failed` chunk's optional numeric `error.status` is exposed as `GenerationPersistenceError.status`, and is `undefined` when absent or not a number), aborts, missing bodies, non-2xx responses (including 401, reported generically with no distinct unauthorized handling; `409` is reported as `GenerationConflictError`), a rejected `fetch`, a failed read, or a stream silent past `idleTimeoutMs` (default `DEFAULT_STREAM_IDLE_TIMEOUT_MS = 45_000`) reported as `StreamInterruptedError`, the `X-Timezone` header (present only when `deps.getTimezone` resolves a non-empty value), CSRF header attachment/rotation, and `clientChannelId` inclusion in the request body only when provided. `parseSSELine`'s decoding logic SHALL remain internal to this factory's module, not a separate public export.

#### Scenario: Partial SSE chunks are buffered and parsed correctly
- **WHEN** the response body delivers an SSE event split across multiple `fetch` stream reads
- **THEN** `onChunk` is invoked with the same parsed values it would receive if the event had arrived in one read

#### Scenario: Comments, blank lines, and `[DONE]` are handled without invoking `onChunk` incorrectly
- **WHEN** the stream includes SSE comment lines, blank lines, or a terminal `[DONE]` line
- **THEN** none of them produces an `onChunk` call, and `onComplete` is invoked once the response body is fully read (not at the `[DONE]` line itself), unless an error was already reported

#### Scenario: Backend error chunks surface through `onError`; malformed events are skipped
- **WHEN** the stream includes a malformed SSE event or a backend-emitted error chunk
- **THEN** a malformed event (unparseable JSON) is skipped silently, while a backend error chunk invokes `onError` once — with `GenerationPersistenceError` for `error.type === 'conversation_save_failed'` (carrying `error.status` when it is a number), otherwise `StreamUpstreamError(error.message)` — and `onComplete` is then not invoked

#### Scenario: Abort during streaming stops processing without invoking `onComplete`
- **WHEN** the caller's `AbortSignal` is aborted mid-stream
- **THEN** processing stops and `onComplete` is not invoked

#### Scenario: Non-2xx response and missing body are reported as errors
- **WHEN** the completion `fetch` resolves with a non-2xx status, or resolves with no readable body
- **THEN** `onError` is invoked and no chunk callbacks fire

#### Scenario: A 409 is reported as a distinguishable generation conflict
- **WHEN** the completion `fetch` resolves with `409` — the conversation already has an active generation, typically started by another browser tab of the same session
- **THEN** `onError` is invoked with a `GenerationConflictError` (defaulting to `DEFAULT_GENERATION_CONFLICT_MESSAGE`) rather than the generic `Stream request failed with status …` error, so callers can present it as an expected state

#### Scenario: Timezone header is present only when a timezone resolves
- **WHEN** `deps.getTimezone` is omitted or returns an empty value
- **THEN** the completion request omits the `X-Timezone` header entirely, matching the pre-move behavior

#### Scenario: `stopCompletion` posts to the configured base path
- **WHEN** `stopCompletion({ generationId, path })` is called
- **THEN** it sends a request to `${deps.completionsBasePath}/completions/stop` with the same body shape as the pre-move implementation, and throws when the response is not OK

#### Scenario: A persistence error chunk exposes the rejected write's status
- **WHEN** the stream includes `{"error": {"type": "conversation_save_failed", "message": "…", "status": 401}}`
- **THEN** `onError` receives a `GenerationPersistenceError` whose `status` is `401`; the same chunk without `status`, or with a non-numeric `status`, yields a `GenerationPersistenceError` whose `status` is `undefined`
