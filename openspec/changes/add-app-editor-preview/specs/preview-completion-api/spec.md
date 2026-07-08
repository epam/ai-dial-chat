## ADDED Requirements

### Requirement: Stateless preview completion endpoint
The backend SHALL expose `POST /api/v1/conversations/preview-completions`, a URI-versioned business endpoint in the existing `apps/chat-api/src/conversations/` domain, that streams a chat completion for a client-supplied message history without reading or writing any persisted conversation resource in DIAL Core storage, and without registering the generation in `ConversationGenerationService`.

Request body (`PreviewCompletionDto`):
```json
{
  "model": "applications/my-custom-app",
  "messages": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi, how can I help?" },
    { "role": "user", "content": "What can you do?" }
  ],
  "generationId": "b3b6c1b0-3e9f-4b8a-9b1a-2f6b8a2b6a11"
}
```

Response: `200 OK`, `Content-Type: text/event-stream`, same SSE chunk shape already produced by `/conversations/completions` (`StreamChunk` — reused, not redefined) so the frontend can reuse `parseSSELine`/`applyChunkToMessages`.

Error responses:
- `400 Bad Request` — invalid body (e.g. empty `messages`, `model` missing, a message exceeding max length, or more than the maximum allowed messages).
- `401 Unauthorized` — no authenticated session.
- `429 Too Many Requests` — rate limit exceeded.
- `502 Bad Gateway` — DIAL Core / model provider error.
- `503 Service Unavailable` — DIAL Core unreachable.

Unlike `/conversations/completions`, this endpoint has no `404` (no conversation to not-find) and no `409` (no single-active-generation constraint, since nothing is persisted to conflict over).

#### Scenario: Successful streamed preview completion
- **WHEN** an authenticated user POSTs a valid `PreviewCompletionDto` with a reachable `model`
- **THEN** the response streams `StreamChunk` SSE events representing the model's reply
- **AND** no conversation record is created, read, or updated in DIAL Core storage as a result

#### Scenario: Unauthenticated request rejected
- **WHEN** the request has no valid session
- **THEN** the endpoint responds `401 Unauthorized` before contacting DIAL Core

#### Scenario: Invalid body rejected
- **WHEN** `messages` is empty, `model` is missing, or a message's `content` exceeds the configured max length
- **THEN** the endpoint responds `400 Bad Request` with validation error details, and no request is made to DIAL Core

#### Scenario: Downstream model error mapped
- **WHEN** DIAL Core / the model provider returns an error while streaming
- **THEN** the endpoint responds/ends the stream with a `502 Bad Gateway`-equivalent error chunk, mirroring how `/conversations/completions` surfaces upstream errors

#### Scenario: Rate limit enforced
- **WHEN** a single session exceeds the configured request rate for this endpoint
- **THEN** subsequent requests within the window respond `429 Too Many Requests`

### Requirement: Preview completion request validation
`PreviewCompletionDto` SHALL be validated with `class-validator`: `model` is a required, non-empty string bounded by `@MaxLength` (mirroring `SendCompletionDto.model`); `messages` is a required array validated with `@ValidateNested({ each: true })` and `@ArrayMaxSize` to bound payload/context size, where each `PreviewMessageDto` has `role` (`@IsEnum(MessageRole)`, restricted to `user`/`assistant`/`system`) and `content` (`@IsString`, `@MaxLength(4000)`, matching the existing per-message limit used by `SendCompletionDto.message`); `generationId` is optional (`@IsOptional`, `@IsUUID('4')`), used only for log correlation.

#### Scenario: Oversized transcript rejected
- **WHEN** `messages` contains more entries than the configured `@ArrayMaxSize` limit
- **THEN** the endpoint responds `400 Bad Request` without contacting DIAL Core

#### Scenario: Oversized single message rejected
- **WHEN** any message's `content` exceeds `@MaxLength(4000)`
- **THEN** the endpoint responds `400 Bad Request`

### Requirement: Stop is client-side abort only
Because no partial state is persisted server-side for a preview generation, stopping mid-stream SHALL be achieved by the client aborting its HTTP request (`AbortController`/`fetch` `signal`); the NestJS handler SHALL forward that abort into the underlying `sendChatCompletionRequest` call so the upstream model request is also cancelled. No `/conversations/preview-completions/stop` endpoint or server-side generation registry entry is introduced for this capability.

#### Scenario: Client aborts mid-stream
- **WHEN** the client aborts the fetch to `/conversations/preview-completions` while a response is streaming
- **THEN** the backend stops relaying further chunks and releases the upstream connection
- **AND** no separate stop request is required or supported

### Requirement: Shared core logic with existing completions endpoint
The message/body-assembly logic and the SSE-relay loop used by `/conversations/completions` SHALL be extracted into shared, reusable private method(s) on `ConversationService` (or a shared util) and called by both `streamCompletion` (existing, persisted) and the new preview completion method, so the two endpoints do not maintain duplicate SSE-parsing/model-invocation code.

#### Scenario: Shared relay logic
- **WHEN** either `/conversations/completions` or `/conversations/preview-completions` streams a response
- **THEN** both use the same underlying chunk-relay implementation, differing only in whether persistence (`getConversation`/`saveConversation`/`finalize`/`ConversationGenerationService`) runs around it

### Requirement: Rate limiting stricter than persisted completions
`/conversations/preview-completions` SHALL apply a `@Throttle` limit stricter than the existing `/conversations/completions` (`{ limit: 100, ttl: 60000 }`), e.g. `{ limit: 30, ttl: 60000 }`, since preview calls have no natural pacing from a single-active-generation, persisted-conversation constraint.

#### Scenario: Preview throttle applies independently
- **WHEN** a session sends preview-completion requests faster than the preview-specific limit but within the persisted-completions limit
- **THEN** preview requests are throttled with `429` while normal `/conversations/completions` calls from the same session are unaffected

### Requirement: Generated API client and OpenAPI coverage
The endpoint SHALL be documented with `@ApiOperation` and `@ApiResponse` for every status code listed above, included in `npm run openapi` generation, and verified with `npm run openapi:check`. The regenerated `@epam/chat-api-client` SHALL expose a method (operationId, e.g. `streamPreviewCompletion`) that the frontend's thin `server-api/preview-completion.api.ts` wrapper calls using the client's raw/streaming variant (matching how `chat-stream.api.ts` already handles the non-generated streaming fetch for `/conversations/completions`, since SSE streaming responses are not modeled by the standard generated client methods).

#### Scenario: OpenAPI contract stays in sync
- **WHEN** the `PreviewCompletionDto`/controller method changes
- **THEN** `npm run openapi` regenerates `libs/chat-api-client` and `npm run openapi:check` passes with no diff against the committed generated client
