## ADDED Requirements

### Requirement: Single DIAL error mapper for all chat-api domains
The system SHALL expose one module (`apps/chat-api/src/common/dial/dial-error.mapper.ts`) that all `chat-api` domain services use to translate a DIAL Core error into a NestJS `HttpException`, regardless of whether the error originated from `@epam/ai-dial-typescript-sdk` (SDK-shaped, `{ status }`) or from a raw `fetch` call (`Response`-shaped, `AbortError`, network `TypeError`).

#### Scenario: SDK-shaped error is mapped through the shared status mapper
- **WHEN** a service calls `handleDialSdkError(error, context, logger?, response?)` with an SDK error carrying `status` 400, 401, 403, 404, 409, 413, 429, or a 5xx value
- **THEN** the function throws the same NestJS `HttpException` subtype that the pre-consolidation `handleDialError` threw for that status code

#### Scenario: An optional response argument's status always wins over the error body
- **WHEN** a caller passes a 4th `response: { status: number }` argument to `handleDialSdkError` alongside an `error` argument
- **THEN** the function merges `response.status` into the error body before mapping, so `response.status` is used for exception selection even if the error body already carries its own (possibly stale or absent) `status` field, and omitting `response` falls back to using `error.status` (or a generic `BadGatewayException` if neither carries a usable status)

#### Scenario: Fetch-shaped error is mapped through the shared status mapper
- **WHEN** a service calls `handleDialFetchError(err, context, logger, timeoutMs?)` with a `Response`-shaped error, an `AbortError`, or a network `TypeError`
- **THEN** the function throws the same NestJS `HttpException` subtype (including timeout/service-unavailable handling) that the pre-consolidation `handleDialFetchError` threw for that input

#### Scenario: Existing HttpException instances are re-thrown unchanged
- **WHEN** either `handleDialSdkError` or `handleDialFetchError` receives an error that is already an instance of `HttpException`
- **THEN** the function re-throws that exact exception without re-mapping it, its status code, or its response body

#### Scenario: Optional logger records the error before mapping
- **WHEN** a caller passes a `logger` argument to `handleDialSdkError`, `handleDialFetchError`, or `mapDialHttpStatus`
- **THEN** the mapper logs the error with the provided `context` before throwing the mapped exception, and omitting `logger` SHALL NOT change which exception is thrown

### Requirement: SDK-shaped error paths propagate the real upstream HTTP status
Every `chat-api` service method that calls `handleDialSdkError` after receiving an SDK-shaped `{ data, error, response }` result SHALL pass the raw `response` (or a `{ status }` value derived from it) as the 4th argument, not rely on the parsed error body alone, so `mapDialHttpStatus` throws the exception matching DIAL Core's actual response.

#### Scenario: deleteConversation surfaces 404 for an already-deleted conversation
- **WHEN** `ConversationService.deleteConversation` calls the DIAL SDK and DIAL Core responds with HTTP 404 and an error body with no `status` field
- **THEN** the method throws `NotFoundException`, not `BadGatewayException`

#### Scenario: getStoredConversation-derived reads surface the real status
- **WHEN** `getConversation`, `duplicateConversation`, or `renameConversation` triggers `getStoredConversation` and DIAL Core responds with a non-2xx status
- **THEN** the caller receives the NestJS exception matching that real status code (e.g. 404 → `NotFoundException`), not a generic `BadGatewayException` from an un-shaped thrown error

#### Scenario: getUserBucket surfaces the real status
- **WHEN** `BucketService.getUserBucket` calls the DIAL SDK and DIAL Core responds with a non-2xx status
- **THEN** `handleDialSdkError` receives that real status (via the `response` argument) and throws the matching exception

#### Scenario: every SDK-shaped service passes the response through to the mapper
- **WHEN** any of `conversation.service.ts`, `bucket.service.ts`, `files.service.ts`, `user-config.service.ts`, `chat.service.ts`, or `transcription.service.ts` handles an SDK-shaped result on a path where a `response` is available
- **THEN** it passes that `response` (or a `{ status }` object derived from it) as the 4th argument to `handleDialSdkError`, so no SDK-path service can silently lose the upstream status; `rate.service.ts` is out of scope for this requirement because it is fetch-based, not SDK-shaped
