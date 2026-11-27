# Proposal

## Why

Request timing in `apps/chat-api` splits each request into `total`, `core` (wall time with a DIAL
Core call in flight) and `chat` (`total − core`). DIAL Analytics (ADAS) calls are not marked, so
waiting on ADAS shows up as `chat` (BFF) time. `GET /api/v1/user/usage/history` makes three to
four ADAS calls, some of them concurrent, and almost no Core calls. Its whole latency therefore
reads as BFF work in dashboard 08, and operators chasing a slow usage page look in the wrong
component. #10025 added `DialAnalyticsClientService` as the one ADAS transport and left this
gap as an explicit non-goal (`openspec/changes/archive/2026-11-26-integrate-dial-analytics-sdk/design.md`,
Non-Goals).

## Problem

- `RequestTimingState` knows only one upstream: `RequestTimingPhase` is `total | core | chat`
  (`apps/chat-api/src/telemetry/request-timing-state.ts:3`), and `settle()` derives
  `chat = total − core` (`request-timing-state.ts:59`).
- Only `withCoreRequestTiming` (`apps/chat-api/src/telemetry/core-request-timing.ts:56`) marks
  outgoing traffic, and only `DialClientService` uses it
  (`apps/chat-api/src/dial/dial-client.service.ts:55`). `fetchAnalytics`
  (`apps/chat-api/src/dial/dial-analytics-client.service.ts:65`) calls `globalThis.fetch`
  unmarked, and the test `does not count an ADAS call as DIAL Core time`
  (`apps/chat-api/src/dial/tests/dial-analytics-client.service.spec.ts:360`) pins that.
- Dashboard 08, `docs/observability.md` ("`total = core + chat`", "Other upstream fetches are
  excluded") and the `request-latency-attribution` spec all say "outside Core" for the
  remainder, which today includes ADAS.

## Solution

- Add one phase value, `analytics`, to the existing histogram
  `dial.chat.http.request.phase.duration` (label `dial.chat.http.phase`), and the span attribute
  `dial.chat.http.duration.analytics` on the `request.timing` span. Metric name, buckets and
  other labels stay unchanged.
- `analytics` is the union of the request's ADAS wire intervals, the same way `core` is today.
  `core` keeps its exact meaning. `chat` becomes `total` minus the union of **all** upstream
  intervals (Core ∪ Analytics), clipped at zero and at `total`. When Core and ADAS overlap, the
  shared wall time appears in both `core` and `analytics` but is subtracted from `chat` only once.
  So `core + analytics + chat ≥ total`, and the sum equals `total` when the two never overlap.
- Generalise the state and the undici observer to keep intervals per upstream enum value. The
  space per incoming request stays constant. Mark ADAS traffic by wrapping only the
  `globalThis.fetch` call inside `fetchAnalytics`. The User-Agent, `redirect: 'manual'`, the
  `ANALYTICS_TIMEOUT_MS` signal, the log line and the error-body cancel do not change.
  Intervals close on the same undici `request:trailers` / `request:error` channels as Core. A
  probe on Node 24 confirmed that a cancelled error body closes its interval (`error`, or
  `trailers` when the body was already complete).
- Update dashboard 08 (attribution table, "mean time components" stack, Tempo table), the
  `request-latency-attribution` spec, `docs/observability.md`, `apps/chat-api/README.md` and
  `docs/architecture.md`.

Model: follow the existing Core path (`core-request-timing.ts`, `DialClientService.withCoreHeaders`).
No new pattern.

## Alternatives considered

- **Generic `upstream` phase + `dial.chat.http.upstream` label.** Rejected (user decision): it
  breaks every `phase="core"` query in dashboard 08 and in any external dashboard, for no gain
  while ADAS is the only second upstream. Internally the state is still keyed by an upstream
  enum, so a third upstream later costs one enum value.
- **Mutually exclusive phases (priority when Core and ADAS overlap) so the sum stays exact.**
  Rejected (user decision): `core` would stop meaning "Core in flight" and would shift for
  existing routes.
- **Conservative baseline — leave ADAS in `chat` and only document it.** Rejected: the usage
  page stays misattributed, which is the problem this change solves.
- **A `Server-Timing` response header.** Not added (user decision): no such header exists
  today, and exposing per-upstream timings to browsers is a new public contract.

## What Changes

- `request-timing-state.ts`: `RequestTimingPhase.Analytics = 'analytics'`; per-upstream interval
  accumulation plus a combined "any upstream active" interval; `chat = total − union`.
- `core-request-timing.ts` → `upstream-request-timing.ts`: one observer for all upstreams;
  `withCoreRequestTiming` keeps its name and behaviour, `withAnalyticsRequestTiming` is new.
- `dial-analytics-client.service.ts`: wraps the `globalThis.fetch` call in
  `withAnalyticsRequestTiming`.
- `request-timing.ts`: metric description and the new span attribute.
- Dashboard 08, docs, and the `request-latency-attribution` spec as listed above.
- Not breaking for metric consumers: there is one new label value, and existing values keep
  their names. `chat` gets smaller for routes that call ADAS, which is the intended fix.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `request-latency-attribution`: four phases instead of three; overlap-safe attribution
  generalised from Core to Core and Analytics with `chat = total − union`; the timing span gains
  the analytics duration; dashboard 08 shows mean Analytics time.

`dial-core-client` stays as is: its rule that ADAS does not use the Core transport or Core
request timing still holds, because ADAS gets its own phase. `user-usage-history` stays as is:
the route's behaviour and contract do not change.

## Non-goals

- A `Server-Timing` header or any change to response headers or bodies.
- Timing other native-fetch traffic: themes, OIDC/IdP, MCP and other non-Core, non-ADAS
  fetches stay outside every upstream phase and count as `chat`.
- Measuring processing inside ADAS (that needs ADAS-side traces), retries, or new
  `usage-history` behaviour.
- Updating dashboards or alerts outside this repository. The release note tells operators about
  the new label value.

## Acceptance criteria

- Every monitored request records exactly four observations (`total`, `core`, `analytics`,
  `chat`) at its first terminal event; a request with no upstream calls has `core = analytics = 0`
  and `chat = total`.
- `GET /api/v1/user/usage/history` against the fake ADAS server reports `analytics > 0`,
  `core = 0`, and `chat ≈ total − analytics`. ADAS time no longer appears as `chat`.
- Overlapping ADAS calls count once; overlapping Core and ADAS reduce `chat` once; `chat` is
  never negative and no phase exceeds `total`; an unfinished call is clipped at settlement.
- A failed ADAS call whose body was cancelled closes its interval at the cancel. The
  instrumentation never reads, clones or replaces `Response.body`.
- Unmarked native fetches (for example, a test route that fetches the same origin without a
  marker) still add nothing to `core` or `analytics`.
- `npm exec nx run-many -t build,test,lint -p chat-api`, `npm run validate:docs`,
  `npm run validate:specs` pass.

## Impact

- Code: `apps/chat-api/src/telemetry/` (state, observer, middleware), `apps/chat-api/src/dial/`
  (`DialClientService` import path, `DialAnalyticsClientService`), and their tests. No shared
  libs and no global providers. No `libs/*` changes.
- APIs: none. No endpoint, DTO, OpenAPI or generated-client change.
- Observability: a new `dial_chat_http_phase="analytics"` series and a new span attribute. The
  meaning of `chat` narrows to "outside Core and Analytics". Dashboard 08 is updated.
- i18n: no user-visible strings. The dashboard labels are operator-facing Grafana JSON, not
  product translations.
- Rollback: revert the change. The series stops; `chat` goes back to including ADAS. No data
  migration. During a rolling deploy, pods on the old version emit no `analytics` series, and
  dashboard 08 shows it as missing, not as zero.
