## MODIFIED Requirements

### Requirement: Single DIAL error mapper for all chat-api domains
The system SHALL expose one module (`apps/chat-api/src/common/dial/dial-error.mapper.ts`) that all `chat-api` domain services use to translate a DIAL Core or DIAL Analytics error into a NestJS `HttpException`, regardless of whether the error originated from `@epam/ai-dial-typescript-sdk` (SDK-shaped, `{ status }`) or from a raw `fetch` call (`Response`-shaped, `AbortError`, network `TypeError`). Every log line and exception message SHALL name the upstream that failed, and the DIAL Core texts SHALL stay exactly as they are.

#### Scenario: SDK-shaped error is mapped through the shared status mapper
- **WHEN** a service calls `handleDialSdkError(error, context, logger?, response?)` with an SDK error carrying `status` 400, 401, 403, 404, 409, 413, 429, or a 5xx value
- **THEN** the function throws the same NestJS `HttpException` subtype that the pre-consolidation `handleDialError` threw for that status code

#### Scenario: An optional response argument's status always wins over the error body
- **WHEN** a caller passes a 4th `response: { status: number }` argument to `handleDialSdkError` alongside an `error` argument
- **THEN** the function merges `response.status` into the error body before mapping, so `response.status` is used for exception selection even if the error body already carries its own (possibly stale or absent) `status` field, and omitting `response` falls back to using `error.status` (or a generic `BadGatewayException` if neither carries a usable status)

#### Scenario: Fetch-shaped error is mapped by the fetch handler
- **WHEN** a service calls `handleDialFetchError(err, context, logger?, timeoutMs?)` from the catch block of a raw `fetch` call
- **THEN** an `AbortError` throws `ServiceUnavailableException('DIAL Core request timed out')` and any other non-`HttpException` error throws `ServiceUnavailableException('DIAL Core is currently unavailable')`; a non-ok `Response` is not handled here — callers pass its status to `mapDialHttpStatus` directly

#### Scenario: Fetch handler can swallow follow-up failures
- **WHEN** a caller passes a 5th `{ swallow: true }` argument to `handleDialFetchError`
- **THEN** the error is logged with the same messages as the throwing path and the call returns instead of throwing

#### Scenario: Existing HttpException instances are re-thrown unchanged
- **WHEN** either `handleDialSdkError` or `handleDialFetchError` receives an error that is already an instance of `HttpException`
- **THEN** the function re-throws that exact exception without re-mapping it, its status code, or its response body

#### Scenario: Optional logger records the error before mapping
- **WHEN** a caller passes a `logger` argument to `handleDialSdkError`, `handleDialFetchError`, or `mapDialHttpStatus`
- **THEN** the mapper logs the error with the provided `context` before throwing the mapped exception (an already-`HttpException` error is re-thrown without logging, except on the `swallow` path), and omitting `logger` SHALL NOT change which exception is thrown

#### Scenario: Upstream message replaces generic text except for 401/403/404
- **WHEN** a caller invokes `mapDialHttpStatus(status, context, logger?, errorBody?, upstreamMessage?)` with an `upstreamMessage`
- **THEN** that message replaces the generic exception text for 400, 405, 409, 412, 413, 422, 429, and 5xx, while 401, 403, and 404 keep their generic text; `isUpstreamTextExposable(status)` exposes the same rule to other domains, and `errorBody`, when given, is only logged

#### Scenario: A DIAL Analytics failure names DIAL Analytics
- **WHEN** a DIAL Analytics (ADAS) call answers a non-ok status, times out, cannot connect, or returns an unparseable body
- **THEN** the mapper throws the same `HttpException` subtype it throws for that outcome from DIAL Core, and neither the exception message nor any log line it writes contains "DIAL Core"; a timeout throws `ServiceUnavailableException('DIAL Analytics request timed out')` and any other transport failure throws `ServiceUnavailableException('DIAL Analytics is currently unavailable')`

#### Scenario: The DIAL Analytics error body is never logged or exposed
- **GIVEN** ADAS answers a non-ok status with an error body
- **WHEN** the failure is mapped
- **THEN** the body may be read, but it never appears in a log line or in the exception message, at any status

#### Scenario: DIAL Core texts are unchanged
- **WHEN** any DIAL Core caller of `mapDialHttpStatus`, `handleDialSdkError` or `handleDialFetchError` hits any status or failure
- **THEN** it receives exactly the exception subtype, message and log lines it received before DIAL Analytics was added, verified by the pre-existing `dial-error.mapper.spec.ts` suite passing unmodified
