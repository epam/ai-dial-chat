# api-error-trace-correlation Specification

## Purpose

A single helper that normalizes any API error into a message and trace ID, so a failure the user sees can be correlated with a backend trace.

## ADDED Requirements

### Requirement: One normalization helper resolves message and trace ID from any API error
`apps/chat/src/server-api/api-error.ts` SHALL export an async `getApiErrorDetails(error: unknown)`
helper returning `{ status?: number; message: string | null; traceId?: string }`, supporting both
the generated `@epam/chat-api-client` `ResponseError` (which retains the original `Response`) and
the raw `apps/chat/src/server-api/base.ts` request error shape. The existing
`getApiErrorMessage`/`getApiErrorStatus` exports SHALL continue to work unchanged for callers that
only need a message or status.

Resolution order SHALL be: parse a `traceparent` from the JSON error body first; if the body has no
valid `traceparent` or cannot be parsed as JSON, fall back to the response's `traceparent` header.
The message SHALL continue to resolve in the existing order (`message[]` joined, then `message`,
then `error`, then `Error.message`). The response body SHALL be read via `response.clone()` (or an
equivalent single-consumption-safe strategy) so no caller can trigger a "body already used" error.

#### Scenario: Trace ID resolved from a JSON error body
- **WHEN** an API call fails and the response JSON body includes a valid `traceparent`
- **THEN** `getApiErrorDetails` returns that value's 32-hex trace ID as `traceId`, alongside the
  resolved `message`

#### Scenario: Trace ID falls back to the response header
- **WHEN** an API call fails with a response whose body is not JSON or has no `traceparent`
  property, but the response has a valid `traceparent` header
- **THEN** `getApiErrorDetails` returns the trace ID extracted from the header

#### Scenario: Raw base.ts request errors are supported the same way
- **WHEN** a request made through `apps/chat/src/server-api/base.ts` fails with a response carrying
  a `traceparent` (body or header)
- **THEN** `getApiErrorDetails` resolves `traceId` identically to a generated-client `ResponseError`

#### Scenario: Message resolves the same way regardless of trace ID presence
- **WHEN** a response has no valid trace context anywhere
- **THEN** `getApiErrorDetails` still returns the resolved `message` (and `status` when available),
  with `traceId` left `undefined`

### Requirement: Malformed or absent trace data is never surfaced
`getApiErrorDetails` SHALL validate any candidate `traceparent` against the W3C Trace Context shape
(version `00`, 32 lowercase-hex trace ID not all zero, 16 lowercase-hex span ID not all zero, 2-hex
flags) before returning a `traceId`. A value that fails this check SHALL be dropped silently — the
helper SHALL NOT throw and SHALL still return the resolved `message`.

#### Scenario: All-zero trace ID is rejected
- **WHEN** a response's `traceparent` has a syntactically valid shape but an all-zero trace ID
  (`00000000000000000000000000000000`)
- **THEN** `getApiErrorDetails` returns `traceId: undefined`

#### Scenario: Truncated or malformed value is rejected
- **WHEN** a response's `traceparent` value is truncated, uses uppercase hex, or has the wrong
  number of dash-separated segments
- **THEN** `getApiErrorDetails` returns `traceId: undefined` without throwing

### Requirement: Batch failures surface exactly one trace ID
When a caller aggregates results from multiple operations and one representative failure must be
shown, the caller SHALL call `getApiErrorDetails` on the first failing operation in the existing
iteration order and use only that result's `traceId`. Trace IDs from other failed operations in the
same batch SHALL NOT be concatenated or otherwise included in the same notification.

#### Scenario: Multiple failures in one batch show only the first trace ID
- **WHEN** a bulk operation fails for three of five items, each with a different valid `traceparent`
- **THEN** the resulting error notification carries only the first failing item's trace ID
