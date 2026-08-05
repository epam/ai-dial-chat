## Context

`apps/chat-api` already instruments every request with OpenTelemetry: an inbound `traceparent`
is continued, a request with none gets a freshly generated trace, outbound calls carry the active
context, and `apps/chat-api/src/telemetry/traceparent.middleware.ts` (registered in `main.ts`
before routing, via `app.use(traceparentMiddleware)`) reflects that context back as a `traceparent`
response header on both success and error responses, using `isSpanContextValid` so no header is
ever emitted for an invalid/absent span. Exported Nest logs already carry the matching `trace_id`.

None of that context exists in the JSON body Nest sends back on an error, and nothing on the
frontend reads or displays it. `apps/chat/src/server-api/api-error.ts` only resolves a display
`message` from `message`/`error`; `apps/chat/src/context/NotificationContext.tsx`'s
`NotificationItem` has no field for a correlation ID; and
`apps/chat/src/components/Notification/NotificationContainer.tsx` renders exactly
`{ variant, title, message }` into the ui-kit `Notification`, auto-dismissing every entry after a
fixed 5-second `setTimeout` with no pause/hover handling.

The ui-kit `DialNotification`'s `message` prop is `ReactNode` (confirmed via the ui-kit MCP tool),
so a composed "message + Request ID + Copy" element can be assembled entirely at the `apps/chat`
edge without any ui-kit change.

## Goals / Non-Goals

**Goals:**
- Every JSON error response from a traced `chat-api` route carries the same `traceparent` already
  present on the response header.
- One frontend helper normalizes both generated-client (`ResponseError`) and raw `base.ts` errors
  into `{ message, traceId }`, validating the W3C shape before a value is ever returned.
- Error notifications that carry a valid trace ID show it with an accessible Copy control; every
  other notification is visually and behaviorally unchanged.
- Existing API-failure call sites adopt the shared helper instead of each parsing errors ad hoc.

**Non-Goals:**
- No change to OpenTelemetry SDK initialization, exporter selection, sampling, or metrics.
- No browser-side tracing/span creation.
- No request ID for purely client-side/validation errors that never reach the server.
- No redesign of the notification queue, stacking, or timing model beyond what trace-bearing
  errors specifically require.

## Decisions

### Backend: one global exception filter, not per-controller changes
Add a single Nest `ExceptionFilter` (`apps/chat-api/src/common/filters/traceparent.filter.ts`, catching
all exceptions via `@Catch()`) registered globally in `main.ts` alongside the existing
`traceparentMiddleware`. It delegates to Nest's default `HttpExceptionFilter`-equivalent behavior
for building the response body (so `statusCode`/`message`/`error` stay exactly as Nest/DIAL error
mapping already produce them) and then, only for JSON error responses that haven't already been
sent, adds `traceparent` by reading the same active-span check `traceparentMiddleware` uses
(`trace.getSpan(context.active())` + `isSpanContextValid`). This keeps the "one shared helper, one
truth source" property the response header already has, and guarantees the body value can never
diverge from the header value because both come from the same active span at response time.

**Alternative considered**: parse the response header set by `traceparentMiddleware` back out of
`res` inside the filter. Rejected — reading a header that middleware runs before the filter would
work today, but couples the filter's correctness to registration order instead of both reading the
same OpenTelemetry API directly.

**Alternative considered**: manually add `traceparent` in each domain service's catch blocks
(mirroring the legacy per-route pattern). Rejected — this is exactly the coverage-drift problem
the proposal exists to avoid; a global filter guarantees every route, present and future, is
covered.

### Filter scope: skip anything not a plain JSON error body
The filter must not touch: successful responses (it only runs on thrown exceptions), streaming/SSE
responses, file download responses, redirects, or any response where `res.headersSent` is already
`true`. It must preserve every existing field Nest/DIAL error mapping puts in the body (including
`statusCode`, `message`, `error`, and any domain `code`) and only add `traceparent` alongside them.

### Frontend: one normalization helper, two input shapes
Add `getApiErrorDetails(error: unknown): Promise<ApiErrorDetails>` to
`apps/chat/src/server-api/api-error.ts` (extending, not replacing, the existing
`getApiErrorMessage`/`getApiErrorStatus` exports so current callers keep working), where:

```ts
interface ApiErrorDetails {
  status?: number;
  message: string | null;
  traceId?: string;
}
```

Resolution order: parse the JSON body first (works for both the generated client's
`ResponseError.response` and the raw `base.ts` error shape, since both retain a `Response`-like
object); if the body has no valid `traceparent` (or the body can't be parsed as JSON), fall back to
the response's `traceparent` header. Validate the extracted value against the W3C 32-hex trace ID
shape (reusing/adding a small validator matching what `traceparentMiddleware` already trusts:
version `00`, 32 lowercase hex trace ID, not all zeros, 16 lowercase hex span ID, not all zeros,
2-hex flags) before returning `traceId`; a malformed value is dropped silently and only `message`
is returned. `response.clone()` is used before consuming the body via `.json()` so a later `.text()`
fallback (for non-JSON error bodies) does not throw on an already-consumed stream.

**Alternative considered**: expose two separate helpers, one per transport family. Rejected — call
sites shouldn't need to know which transport produced their error; one function accepting `unknown`
matches the existing `getApiErrorMessage(error: unknown)` signature callers already use.

### Batch/multi-operation failures: first failure wins
When a caller already collects multiple failed operations (e.g., a bulk delete), it calls
`getApiErrorDetails` on the first failed result in the existing iteration order and displays only
that trace ID; other failures' trace IDs are not concatenated or otherwise surfaced. This keeps the
notification body short and matches how the existing message text already summarizes batch
failures.

### Notification model: add `requestId`, not a new component
Extend `NotificationItem`/`ShowNotificationOptions` in `NotificationContext.tsx` with an optional
`requestId?: string`. `NotificationContainer.tsx`'s `NotificationEntry` composes the `message` it
already passes to `Notification` with an appended Request ID row (label, LTR-forced hex value,
Copy button) when `item.requestId` is set — it does not introduce a new ui-kit component or wrap
`Notification` in a new persistent element, since `message` already accepts arbitrary `ReactNode`.

### Copy control: native Clipboard API behind a small hook
Add a `useCopyToClipboard`-style helper (or inline `navigator.clipboard.writeText` call) in the
entry component, guarded by feature-detection; on success it flips a local `isCopied` boolean shown
via an `aria-live="polite"` status span (per the repository's `aria-live` pattern), separate from
the Copy button's own stable accessible name. On failure (rejected promise, API unavailable), the
error notification itself is untouched — only the copy confirmation is skipped — and the button's
`aria-label` communicates copy failed via the same live region rather than a second notification.

### Dismiss timing for trace-bearing notifications
Trace-bearing error notifications (`item.requestId` set) do not auto-dismiss on the fixed 5-second
timer; they require the existing manual close (`closable`, already wired to `onClose`/
`dismissNotification`). This is a minimal, symmetric change: `NotificationEntry`'s
`useEffect` only arms the `setTimeout` when `item.requestId` is absent. Non-trace error/other
notifications keep today's 5-second behavior unchanged.

**Alternative considered**: keep the 5-second auto-dismiss but pause on hover/focus. Rejected as
higher-risk/larger surface for this change (new pointer/focus-tracking logic on every notification,
not just trace-bearing ones); manual dismissal for the one case that needs extra reading time keeps
the timing change local to `requestId`-bearing entries.

### User-facing label: "Request ID"
The visible label is "Request ID" (not "Trace ID") to match the friendlier, support-oriented
product wording; the underlying value is still the W3C trace ID. This is purely an i18n string
choice and has no effect on the wire contract (`traceparent`).

## Risks / Trade-offs

- **[Risk]** A hand-rolled exception filter could accidentally shadow Nest/DIAL's existing
  status-code mapping if it rebuilds the response body instead of delegating to it. → Mitigation:
  the filter calls into Nest's base `HttpException`-derived response shape (via
  `exception.getResponse()`/`exception.getStatus()` for `HttpException`, generic 500 body
  otherwise) rather than re-implementing status mapping, and only appends `traceparent`.
- **[Risk]** Adding `traceparent` reads response state that may not be ready before headers are
  sent for non-`HttpException` paths (e.g., framework-level errors). → Mitigation: filter checks
  `res.headersSent` and skips silently; existing tests for `traceparentMiddleware`'s response
  header already validate the same span-validity check works for standard error paths.
- **[Risk]** Widening which call sites use `getApiErrorDetails` touches many existing
  hooks/epics-equivalent code paths, risking regressions in currently-working error messages. →
  Mitigation: `getApiErrorDetails` is additive (existing `getApiErrorMessage`/`getApiErrorStatus`
  remain and can still be used directly); call sites migrate incrementally, verified per-slice.
  Batch/streaming call sites are audited explicitly per the proposal's Impact section.
- **[Risk]** Suppressing auto-dismiss for trace-bearing notifications could let error notifications
  accumulate if a user ignores them. → Mitigation: `closable` is unaffected — one click/keypress on
  the existing close button dismisses immediately; only the *automatic* timer is skipped.

## Migration Plan

1. Backend: add the shared trace-context helper (or reuse `traceparentMiddleware`'s span-read
   logic via a small exported function) and the global exception filter; register it in `main.ts`.
   Verify via `chat-api` tests that JSON error bodies now carry `traceparent` identical to the
   response header, and that streaming/non-JSON responses are untouched.
2. Frontend: add `getApiErrorDetails` and its W3C validator to `api-error.ts`; unit-test both
   transport shapes and malformed-value rejection.
3. Frontend: extend `NotificationItem`/`ShowNotificationOptions` with `requestId`; update
   `NotificationContainer.tsx`'s entry rendering, dismiss-timer condition, and add the Copy control
   + i18n keys.
4. Frontend: migrate existing API-failure notification call sites to resolve and pass `requestId`
   via `getApiErrorDetails`, in the order listed in the proposal's Impact section, verifying each
   slice.
5. No feature flag or staged rollout is required — this only adds an optional field to an existing
   response body and an optional UI element that renders solely when that field is present; no
   existing behavior changes for responses/notifications without a trace ID.

## Open Questions

- None outstanding; the proposal's "Decisions OpenSpec must make" have been resolved above
  (label: "Request ID"; explicit Copy control: yes; dismiss behavior: manual dismissal for
  trace-bearing notifications; error contract property: `traceparent`, not a second `traceId`
  field; batch errors: first failure only; scope: global error notifications only, not inline/form
  errors; header fallback: yes).
