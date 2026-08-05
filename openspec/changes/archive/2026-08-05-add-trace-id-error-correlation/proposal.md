## Why

`chat-api` already extracts or generates a W3C trace for every request and exposes it as a
`traceparent` response header (via `apps/chat-api/src/telemetry/traceparent.middleware.ts`), and
exported logs carry the matching `trace_id`. None of that context reaches the user or the JSON
error body: Nest's default error responses only carry `statusCode`/`message`/`error`, and every
frontend error notification shows just a message, with no way to correlate a failure a user reports
with the corresponding server trace and logs. Support and on-call currently have no identifier to
search for when a user reports "saving failed" — they can only guess at timing.

## What Changes

- Add a global Nest exception filter that enriches JSON error responses with the active request's
  `traceparent`, matching the value already set on the response header, while leaving Nest's
  existing `statusCode`/`message`/`error` fields, streaming/SSE responses, file downloads, and
  redirects untouched. No `traceparent` is added when no valid trace context exists.
- Add a frontend API error normalization helper that resolves a safe display message and, when
  present, a validated 32-hex trace ID from either the generated `@epam/chat-api-client`
  `ResponseError` body/headers or the raw `server-api/base.ts` request path, with one deterministic
  precedence order (body over header) and no double-consumption of the response stream.
- Extend the app-owned notification model with an optional request ID and render it as a labeled,
  LTR-forced, keyboard-accessible "Request ID" line with a Copy control under error notifications
  that have one, with accessible copied/failed feedback. Notifications without a valid trace
  (client-only/validation errors) are unchanged.
- Route the app's existing API-failure notification call sites (REST calls, streaming/completion
  errors, upload/import/export flows, and other batch/multi-operation failures) through the shared
  normalization helper so the request ID appears consistently instead of being added ad hoc per
  call site. For batch failures, only the first failing operation's trace ID is shown.
- Add the "Request ID" i18n keys (label, Copy action, copied/failed feedback) to
  `apps/chat/src/i18n/locales/en.json`.

## Capabilities

### New Capabilities

- `trace-error-body-enrichment`: the backend contract for exposing the active OpenTelemetry trace
  context as a `traceparent` property on JSON error responses, mirroring the existing response
  header, without altering non-JSON or non-error responses.
- `api-error-trace-correlation`: the frontend contract for normalizing API errors from both the
  generated client and raw request helpers into one `{ message, traceId }` shape, validating the
  W3C trace ID before it is ever surfaced.
- `notification-request-id`: the user-facing "Request ID" line and Copy control on error
  notifications, including when it appears, what it copies, and its accessibility/RTL behavior.

### Modified Capabilities

_(none — this change adds new, previously unspecified error-correlation behavior; it does not
change requirements in any existing spec.)_

## Impact

- **Code**: a new global exception filter under `apps/chat-api/src/common/filters/` (or
  equivalent), registered in `apps/chat-api/src/main.ts`; a new/extended error-normalization helper
  in `apps/chat/src/server-api/`; `apps/chat/src/context/NotificationContext.tsx` (notification
  model); the notification renderer under `apps/chat/src/components/Notification/`; i18n locale
  files; call sites across `apps/chat` that currently raise API-failure notifications directly.
- **Dependencies**: builds on the trace generation, propagation, and response-header behavior
  already implemented for `chat-api` request tracing; does not add or change any telemetry SDK,
  exporter, or metrics configuration.
- **APIs**: JSON error response bodies for `chat-api` gain an optional `traceparent` field; no
  existing response field is removed or renamed.
