## ADDED Requirements

### Requirement: Generation attach/replay transport is a factory-provided capability

`@epam/ai-dial-chat-hooks`'s chat-stream transport factory SHALL additionally expose `attachToGeneration(path: string, signal: AbortSignal): Promise<ReadableStream<Uint8Array>>`, mirroring the existing `watchConversation` shape (a raw stream the hook itself parses) rather than a callback-based API, and SHALL NOT hardcode an `/api` path, CSRF handling, or import an app `server-api` module — the concrete REST wiring is supplied by the host app's transport implementation, consistent with every other transport capability.

#### Scenario: Attach delegates to the injected transport

- **WHEN** `attachToGeneration(path, signal)` is called
- **THEN** the only network-shaped call made is the transport's own request against the host-configured attach endpoint, with the caller-supplied path and abort signal

#### Scenario: Abort signal aborts the underlying request

- **WHEN** the caller's `AbortSignal` is aborted while the attach stream is open
- **THEN** the underlying request/reader is aborted and no further events are delivered to the caller

#### Scenario: Non-2xx response surfaces as a rejected promise

- **WHEN** the attach request resolves with a non-2xx status (including `404` for "no active generation")
- **THEN** the returned promise rejects, allowing the caller (`resumeIfAwaitingGeneration`) to fall back to `watchConversation`

#### Scenario: `apps/chat` composes the concrete transport

- **WHEN** `apps/chat/src/utils/conversation-stream-transport.ts` is inspected after this change
- **THEN** it supplies `attachToGeneration` backed by `apps/chat/src/server-api/chat-stream.api.ts`'s implementation, which issues a raw `fetch POST` against the app's configured completions-attach endpoint with `credentials: 'include'` and the current CSRF token, matching the existing `streamCompletion`/`watchConversation` implementation pattern in that module
