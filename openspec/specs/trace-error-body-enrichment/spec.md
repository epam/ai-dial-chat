# trace-error-body-enrichment Specification

## Purpose

Carrying the active trace context in JSON error responses, without fabricating or duplicating it.

## Requirements

### Requirement: JSON error responses carry the active trace context
When a traced `chat-api` route throws and the response is serialized as a JSON error body, the
system SHALL add a `traceparent` property to that body whenever a valid active OpenTelemetry span
exists at response time, using the same validity check (`isSpanContextValid` on
`trace.getSpan(context.active())`) already used to set the `traceparent` response header. The
value SHALL be byte-identical to the value set on the response header for the same response. All
fields Nest/DIAL error mapping already produces (`statusCode`, `message`, `error`, and any domain
`code`) SHALL remain present and unchanged.

This is implemented as a single global exception filter (not per-controller error handling), so
every current and future traced route is covered without additional per-endpoint changes.

#### Scenario: Mapped HttpException gains traceparent in its JSON body
- **WHEN** a controller throws a Nest `HttpException` (e.g. `NotFoundException`) while a valid
  trace context is active
- **THEN** the JSON error response contains the exception's normal `statusCode`/`message`/`error`
  fields plus a `traceparent` field equal to the response's `traceparent` header

#### Scenario: Unmapped error becomes a 500 with traceparent
- **WHEN** a controller/service throws an error that is not an `HttpException` and not otherwise
  mapped by `common/dial/dial-error.mapper.ts`
- **THEN** the response is a `500` JSON body with a generic safe message
- **AND** it includes `traceparent` when a valid trace context is active

#### Scenario: DIAL Core-mapped errors keep their mapped status and gain traceparent
- **WHEN** a service throws an exception produced by `handleDialSdkError`/`handleDialFetchError`
  (e.g. a `BadGatewayException` for an upstream 502)
- **THEN** the response keeps that mapped status code and message
- **AND** its JSON body includes the same `traceparent` as the response header

#### Scenario: Validation, auth, and rate-limit failures also gain traceparent
- **WHEN** a request fails `ValidationPipe` validation, an auth/CSRF guard, or the global
  rate limiter
- **THEN** the resulting JSON error body includes `traceparent` under the same validity rule as
  any other traced error response

### Requirement: No fabricated or duplicated trace context
The system SHALL NOT add a `traceparent` property to a JSON error body when no valid active trace
context exists (telemetry disabled, `OTEL_TRACES_EXPORTER=none`, or a route excluded from tracing),
and SHALL NOT modify successful response bodies, streaming/SSE responses, file downloads,
redirects, or any response for which headers have already been sent.

#### Scenario: Excluded/untraced route produces no traceparent property
- **WHEN** a request to a route excluded from tracing (e.g. `/api/health`, the metrics scrape
  endpoint) or made while tracing is disabled produces a JSON error response
- **THEN** the body contains no `traceparent` property

#### Scenario: Successful responses are never modified
- **WHEN** a traced route returns a successful (2xx) response
- **THEN** the response body is unchanged by the exception filter (the filter only runs for thrown
  exceptions)

#### Scenario: Streaming and non-JSON responses are left untouched
- **WHEN** an exception occurs after a streaming/SSE response has already started sending data, or
  the response is a file download/redirect
- **THEN** the exception filter does not attempt to add `traceparent` to that response
