# chat-hooks-api-transport Specification

## Purpose

Host-agnostic factories for CSRF/unauthorized generated-client middleware, a
files-API wrapper, upload-with-progress, and streamed-completion transport,
plus the already host-agnostic API error/trace parsing helpers, all published
from `@epam/ai-dial-chat-hooks` so any DIAL-Core-backed client can depend on
the package instead of hand-copying `apps/chat/src/server-api/*.ts`.

## Requirements

### Requirement: CSRF and unauthorized generated-client middleware are host-configurable factories

`@epam/ai-dial-chat-hooks` SHALL export `createCsrfMiddleware(deps: { getCsrfToken: () => string | null; setCsrfToken: (token: string | null) => void }): Middleware` and `createUnauthorizedMiddleware(deps: { notifyUnauthorized: (url: string) => void; refreshCsrfToken: () => Promise<CsrfRefreshResult>; refreshUnauthorizedUrl: string; isInvalidCsrfErrorBody: (body: string) => boolean }): Middleware`, each returning a `@epam/chat-api-client`-compatible `Middleware` object whose observable behavior is identical to `apps/chat/src/server-api/api-client.ts`'s current inline `csrfMiddleware`/`unauthorizedMiddleware`. Neither factory SHALL construct a `Configuration`, read `apps/chat`'s CSRF token directly, or import `apps/chat/src/server-api/base.ts`.

#### Scenario: CSRF token injected on non-GET requests
- **WHEN** `deps.getCsrfToken()` returns a non-null token
- **AND** a POST/PUT/DELETE request is made through a generated API class configured with the middleware `createCsrfMiddleware(deps)` returns
- **THEN** the request carries an `X-CSRF-Token` header equal to that token

#### Scenario: CSRF token never injected on GET
- **WHEN** a GET request is made through a generated API class configured with the middleware `createCsrfMiddleware(deps)` returns, regardless of `deps.getCsrfToken()`'s value
- **THEN** no `X-CSRF-Token` header is added

#### Scenario: Rotated token is captured via the injected setter
- **WHEN** a response carries a rotated `X-CSRF-Token` response header
- **THEN** `createCsrfMiddleware(deps)`'s middleware calls `deps.setCsrfToken` with the rotated value

#### Scenario: 401 response notifies and throws through injected dependencies
- **WHEN** a response has status 401
- **THEN** the middleware `createUnauthorizedMiddleware(deps)` returns calls `deps.notifyUnauthorized(url)` and throws `UnauthorizedError`

#### Scenario: Invalid-CSRF response refreshes and retries exactly once
- **WHEN** a response is classified invalid-CSRF by `deps.isInvalidCsrfErrorBody`
- **THEN** the middleware calls `deps.refreshCsrfToken()`, retries the original request exactly once with any newly-set token, and surfaces that retry's outcome (success, a second invalid-CSRF/401 response, or a non-CSRF error) exactly as `apps/chat/src/server-api/api-client.ts`'s current implementation does today

#### Scenario: Unauthorized CSRF refresh reports the refresh endpoint
- **WHEN** `deps.refreshCsrfToken()` returns an unauthorized outcome
- **THEN** the middleware calls `deps.notifyUnauthorized(deps.refreshUnauthorizedUrl)` and creates the unauthorized error with `deps.refreshUnauthorizedUrl`

#### Scenario: Concurrent requests reuse an in-flight refresh
- **WHEN** two requests concurrently trigger an invalid-CSRF retry
- **THEN** `deps.refreshCsrfToken()` is not invoked a second time while the first refresh is still in flight, and both requests retry using the token that refresh resolves to

### Requirement: Files API wrapper is a factory over an injected configured `FilesApi` and upload function

`@epam/ai-dial-chat-hooks` SHALL export `createFilesApiClient(filesApi: FilesApi, uploadFileWithProgress: UploadFileWithProgressFn)`, returning an object reproducing every one of `apps/chat/src/server-api/files.api.ts`'s 16 current exports (`listPublicFiles`, `listSharedFiles`, `listFiles`, `uploadFile`, `uploadArchive`, `getFileMetadata`, `downloadFile`, `createFolder`, `deleteFiles`, `renameFiles`, `copyFiles`, `moveFiles`, `downloadArchive`, `revokeAccess`, `discardShared`, `listSharedByMe`) with identical signatures and behavior, including binary downloads returning the raw `Response` via the generated client's `Raw` methods.

#### Scenario: Non-progress upload delegates to the generated client
- **WHEN** the returned object's `uploadFile` is called without `onProgress`
- **THEN** it delegates to `filesApi`'s generated upload method, matching `files.api.ts`'s current behavior

#### Scenario: Progress upload delegates to the injected upload function
- **WHEN** the returned object's `uploadFile` is called with `onProgress` set
- **THEN** it delegates to the injected `uploadFileWithProgress` function instead of the generated client

#### Scenario: Binary download returns the raw Response
- **WHEN** the returned object's `downloadFile` or `downloadArchive` is called
- **THEN** it returns the raw `Response` obtained via the generated client's `Raw` method, unconsumed

#### Scenario: `apps/chat` composes the factory with its own singleton
- **WHEN** `apps/chat/src/server-api/files.api.ts` is inspected after this change
- **THEN** it calls `createFilesApiClient` with the app's configured `filesApi` singleton and its own `uploadFileWithProgress`, and re-exports the returned functions under their existing names so `dial-files-api.adapter.ts` and `usePublishFolders.ts` require no changes

### Requirement: Upload-with-progress is a factory over an injected XHR factory and host capabilities

`@epam/ai-dial-chat-hooks` SHALL export `createUploadFileWithProgress(deps: { getCsrfToken: () => string | null; setCsrfToken: (token: string | null) => void; notifyUnauthorized: (url: string) => void; uploadUrl: string; xhrFactory?: () => XMLHttpRequest })`, returning a function reproducing `apps/chat/src/server-api/upload-file-with-progress.ts`'s current `uploadFileWithProgress` signature and behavior: progress reporting, abort via `AbortSignal`, `overwrite`/`create-only` upload mode, JSON response parsing, CSRF header attachment and rotation, and unauthorized (401) handling. `xhrFactory` SHALL default to `() => new XMLHttpRequest()` when omitted.

#### Scenario: Progress events are reported during upload
- **WHEN** the returned function is called with an `onProgress` callback and the injected (or default) XHR reports upload progress events
- **THEN** `onProgress` is called with the same percentage values the pre-move implementation would report

#### Scenario: Abort signal aborts the underlying XHR
- **WHEN** the caller's `AbortSignal` is aborted while the upload is in flight
- **THEN** the underlying XHR request is aborted and the returned promise rejects, matching the pre-move behavior

#### Scenario: CSRF header is attached and rotation is captured
- **WHEN** `deps.getCsrfToken()` returns a token before the request is sent, and the response carries a rotated token
- **THEN** the request carries that token as a header and `deps.setCsrfToken` is called with the rotated value

#### Scenario: 401 response calls the injected unauthorized callback
- **WHEN** the upload response has status 401
- **THEN** `deps.notifyUnauthorized` is called and the returned promise rejects with `UnauthorizedError`

#### Scenario: A custom `xhrFactory` is honored in tests
- **WHEN** `deps.xhrFactory` is supplied
- **THEN** the returned function uses the XHR instance that factory produces instead of constructing a global `XMLHttpRequest` directly

### Requirement: Chat-stream completion transport is a factory over an injected fetch and host capabilities

`@epam/ai-dial-chat-hooks` SHALL export `createChatStreamApi(deps: { getCsrfToken: () => string | null; setCsrfToken: (token: string | null) => void; completionsBasePath: string; getTimezone?: () => string | undefined; fetchImpl?: typeof fetch })`, returning `{ streamCompletion, stopCompletion }` reproducing `apps/chat/src/server-api/chat-stream.api.ts`'s current signatures and behavior: streamed completion parsing across partial chunks, comments/blank lines, `[DONE]`, malformed events, backend error chunks, aborts, missing bodies, non-2xx responses (including 401 — the pre-move implementation reports a non-2xx status generically through `onChunk`'s error path/`stopCompletion`'s thrown error, with no distinct unauthorized handling), the `X-Timezone` header (present only when `deps.getTimezone` resolves a non-empty value), CSRF header attachment/rotation, and `clientChannelId` inclusion in the request body only when provided. `parseSSELine`'s decoding logic SHALL remain internal to this factory's module, not a separate public export.

#### Scenario: Partial SSE chunks are buffered and parsed correctly
- **WHEN** the response body delivers an SSE event split across multiple `fetch` stream reads
- **THEN** `onChunk` is invoked with the same parsed values it would receive if the event had arrived in one read

#### Scenario: Comments, blank lines, and `[DONE]` are handled without invoking `onChunk` incorrectly
- **WHEN** the stream includes SSE comment lines, blank lines, or a terminal `[DONE]` line
- **THEN** `onComplete` is invoked at `[DONE]` and no spurious `onChunk` call is made for the comment/blank lines

#### Scenario: Malformed events and backend error chunks surface through `onError`
- **WHEN** the stream includes a malformed SSE event or a backend-emitted error chunk
- **THEN** `onError` is invoked with the same error shape the pre-move implementation would produce, and streaming stops

#### Scenario: Abort during streaming stops processing without invoking `onComplete`
- **WHEN** the caller's `AbortSignal` is aborted mid-stream
- **THEN** processing stops and `onComplete` is not invoked

#### Scenario: Non-2xx response and missing body are reported as errors
- **WHEN** the completion `fetch` resolves with a non-2xx status, or resolves with no readable body
- **THEN** `onError` is invoked and no chunk callbacks fire

#### Scenario: Timezone header is present only when a timezone resolves
- **WHEN** `deps.getTimezone` is omitted or returns an empty value
- **THEN** the completion request omits the `X-Timezone` header entirely, matching the pre-move behavior

#### Scenario: `stopCompletion` posts to the configured base path
- **WHEN** `stopCompletion({ generationId, path })` is called
- **THEN** it sends a request to `${deps.completionsBasePath}/completions/stop` with the same body shape as the pre-move implementation, and throws when the response is not OK

### Requirement: API error and trace parsing are host-agnostic public exports

`@epam/ai-dial-chat-hooks` SHALL export `isConversationNotFoundError`, `getApiErrorStatus`, `getApiErrorMessage`, and `getApiErrorDetails`, reproducing `apps/chat/src/server-api/api-error.ts`'s current behavior exactly: resolving status/message/trace ID from both a generated-client `ResponseError` and a raw `base.ts`-shaped error without consuming the original response body twice, validating any candidate `traceparent` against the W3C Trace Context shape before returning a `traceId`.

#### Scenario: Message and trace ID resolve from a generated-client error
- **WHEN** `getApiErrorDetails` is called with a `@epam/chat-api-client` `ResponseError`-shaped error whose body includes a valid `traceparent`
- **THEN** it returns that trace ID and the resolved message without throwing

#### Scenario: Message and trace ID resolve from a raw `base.ts`-shaped error identically
- **WHEN** `getApiErrorDetails` is called with an error shaped like `apps/chat/src/server-api/base.ts`'s `ApiRequestError`
- **THEN** it resolves `traceId` and `message` using the same logic and outcome as for the generated-client error shape

#### Scenario: Invalid trace context is dropped without throwing
- **WHEN** a candidate `traceparent` is malformed, truncated, uses uppercase hex, or has an all-zero trace ID
- **THEN** `getApiErrorDetails` returns `traceId: undefined` and still resolves `message`, without throwing

#### Scenario: Response body is never consumed twice
- **WHEN** `getApiErrorDetails` reads a response body to resolve `traceparent` and message
- **THEN** no caller that later inspects the same response encounters a "body already used" error
