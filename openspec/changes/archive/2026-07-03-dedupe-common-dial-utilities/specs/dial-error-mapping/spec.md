## ADDED Requirements

### Requirement: Single DIAL error mapper for all chat-api domains
The system SHALL expose one module (`apps/chat-api/src/common/dial/dial-error.mapper.ts`) that all `chat-api` domain services use to translate a DIAL Core error into a NestJS `HttpException`, regardless of whether the error originated from `@epam/ai-dial-typescript-sdk` (SDK-shaped, `{ status }`) or from a raw `fetch` call (`Response`-shaped, `AbortError`, network `TypeError`).

#### Scenario: SDK-shaped error is mapped through the shared status mapper
- **WHEN** a service calls `handleDialSdkError(error, context, logger?)` with an SDK error carrying `status` 400, 401, 403, 404, 409, 413, 429, or a 5xx value
- **THEN** the function throws the same NestJS `HttpException` subtype that the pre-consolidation `handleDialError` threw for that status code

#### Scenario: Fetch-shaped error is mapped through the shared status mapper
- **WHEN** a service calls `handleDialFetchError(err, context, logger, timeoutMs?)` with a `Response`-shaped error, an `AbortError`, or a network `TypeError`
- **THEN** the function throws the same NestJS `HttpException` subtype (including timeout/service-unavailable handling) that the pre-consolidation `handleDialFetchError` threw for that input

#### Scenario: Existing HttpException instances are re-thrown unchanged
- **WHEN** either `handleDialSdkError` or `handleDialFetchError` receives an error that is already an instance of `HttpException`
- **THEN** the function re-throws that exact exception without re-mapping it, its status code, or its response body

#### Scenario: Optional logger records the error before mapping
- **WHEN** a caller passes a `logger` argument to `handleDialSdkError`, `handleDialFetchError`, or `mapDialHttpStatus`
- **THEN** the mapper logs the error with the provided `context` before throwing the mapped exception, and omitting `logger` SHALL NOT change which exception is thrown
