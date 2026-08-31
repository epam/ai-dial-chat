## MODIFIED Requirements

### Requirement: One normalization helper resolves message and trace ID from any API error
`@epam/ai-dial-chat-hooks` SHALL export an async `getApiErrorDetails(error: unknown)`
helper returning `{ status?: number; message: string | null; traceId?: string }`, supporting both
the generated `@epam/ai-dial-chat-api-client` `ResponseError` (which retains the original
`Response`) and a host's own raw-fetch request error, such as `ApiRequestError` from
`apps/chat/src/server-api/base.ts`.

The helper SHALL identify a response by duck-typing — any error carrying a `response` property
whose `json` is a function — rather than by importing either error class, so it supports both
shapes without the library knowing anything about the host's request layer.

The existing `getApiErrorMessage`/`getApiErrorStatus` exports SHALL continue to work unchanged for
callers that only need a message or status. Every consumer SHALL import `getApiErrorDetails`,
`getApiErrorMessage`, `getApiErrorStatus`, `isConversationNotFoundError`, and the `ApiErrorDetails`
type directly from `@epam/ai-dial-chat-hooks`. The migration this requirement previously scheduled
is complete: `apps/chat/src/server-api/api-error.ts`, which forwarded those five names during the
migration window, no longer exists, and no host module SHALL stand between the package and its
consumers.

Resolution order SHALL be: parse a `traceparent` from the JSON error body first; if the body has no
valid `traceparent` or cannot be parsed as JSON, fall back to the response's `traceparent` header.
The message SHALL continue to resolve in the existing order (`message[]` joined, then `message`,
then `error`, then `Error.message`). The `Error.message` fallback SHALL apply only when the body
parsed successfully but carried no usable message, or when the error carries no response at all: a
body that cannot be parsed as JSON SHALL yield `message: null`, matching `getApiErrorMessage`'s
existing behavior rather than diverging from it. The response body SHALL be read via
`response.clone()` (or an equivalent single-consumption-safe strategy) so no caller can trigger a
"body already used" error.

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

#### Scenario: A body that is not JSON yields no message fallback
- **WHEN** an error carries a response whose body cannot be parsed as JSON, and the error is an
  `Error` with a non-empty `message`
- **THEN** `getApiErrorDetails` returns `message: null` rather than falling back to `Error.message`

#### Scenario: Consumers import the helpers from the package
- **WHEN** any `apps/chat` module needs `getApiErrorDetails`, `getApiErrorMessage`,
  `getApiErrorStatus`, `isConversationNotFoundError`, or `ApiErrorDetails`
- **THEN** it imports the name from `@epam/ai-dial-chat-hooks`, and no
  `apps/chat/src/server-api/api-error.ts` module exists to forward it
