# Design

## Context

See `proposal.md` (Why, Problem) for motivation and `specs/request-latency-attribution/spec.md`
for the required behaviour. Current mechanics that the approach builds on:

- `RequestTimingState` (`apps/chat-api/src/telemetry/request-timing-state.ts`) holds one active
  counter, one start timestamp and one millisecond accumulator for Core. `startCoreCall()`
  returns an idempotent end callback, and `settle()` freezes a snapshot at the first terminal event.
  The instance lives in `requestTimingStorage` (AsyncLocalStorage), which
  `createRequestTimingMiddleware` (`request-timing.ts`) opens for each monitored request.
- `core-request-timing.ts` keeps a second AsyncLocalStorage (`coreRequestStorage`) that
  `withCoreRequestTiming` enters around the Core transport. Its undici `request:create`
  subscriber starts an interval for any request created inside that context and stores the end
  callback in a `WeakMap` keyed by the undici request object. The `request:trailers` and
  `request:error` subscribers end it. `otel-sdk.ts` calls `stopCoreRequestTiming()` on shutdown.
- `DialAnalyticsClientService.fetchAnalytics` (`apps/chat-api/src/dial/dial-analytics-client.service.ts`)
  is the only ADAS transport. The SDK's `getEntitySchema`, `executeQuery` and CSV calls all go
  through it. On a non-2xx response it calls `response.body?.cancel()` and returns a new
  bodiless `Response`.
- `UsageHistoryService` starts schema discovery and then runs two queries with
  `Promise.all`, so ADAS calls overlap within one request.
- Probe on Node 24.14 (the Docker base is `node:24.22.2`), with `fetch(..., { redirect: 'manual' })`
  against a local server:
  - an error body already received in full emits `request:trailers` before the cancel;
  - cancelling a 100 kB error body that is still streaming emits `request:error` synchronously
    with `cancel()`;
  - a 302 emits `request:trailers`.

  The existing channels therefore close every ADAS outcome, the failure path included, with no
  explicit end call.

## Goals / Non-Goals

**Goals:**

- One accumulator design for N upstreams that keeps constant space per request and the existing
  single-pass, idempotent semantics.
- Mark ADAS at the single transport choke point, so `usage-history` and future ADAS consumers
  need no telemetry code.
- Keep every existing Core observation numerically identical.

**Non-Goals:**

- Changing how Core is marked, or which traffic counts as Core.
- Per-ADAS-operation metrics: there is already one log line per call with status and elapsed ms.
- A generic, configurable upstream registry. An enum is enough until a third upstream exists.

## Decisions

### D1 — Upstream enum alongside the phase enum

Add `RequestTimingPhase.Analytics = 'analytics'` and a new internal enum
`RequestTimingUpstream { Core = 'core', Analytics = 'analytics' }` whose values equal the matching
phase values. `RequestTimingSnapshot` stays `Record<RequestTimingPhase, number>`, so the
middleware's `Object.values(RequestTimingPhase)` loop emits the fourth observation with no
special case.

_Alternative:_ reuse `RequestTimingPhase` as the upstream key. Rejected: `total` and `chat`
would become valid arguments to "start an upstream call", which the types should rule out.

### D2 — Per-upstream unions plus an "any upstream" union, constant space

`RequestTimingState` keeps one `{ active, startedAt, milliseconds }` record per
`RequestTimingUpstream`, plus one more record for "any upstream active".
`startUpstreamCall(upstream)` increments both the upstream's counter and the any-upstream
counter. Whichever counter goes from 0 to 1 records its start. The returned end callback is
idempotent and ignored after `settle()`, as today. It decrements both counters, and each counter
that reaches 0 adds its elapsed time. At `settle()`:

- each upstream phase = `min(total, milliseconds + open interval)`;
- `union` = the same expression for the any-upstream record;
- `chat = max(0, total − union)`.

Because every upstream interval is a subset of the any-upstream interval, `upstream ≤ union ≤ total`
holds by construction. The clamps only guard clock edge cases. Memory is O(number of upstreams),
fixed at 2 here, and there is still no interval list.

`startCoreCall()` is replaced by `startUpstreamCall(RequestTimingUpstream.Core)`. Its only caller
is the observer.

_Alternative:_ store the intervals and compute an exact sweep at settlement. Rejected: it
breaks the constant-space requirement and adds nothing, because counters already give exact
unions for intervals marked on one monotonic clock.

### D3 — One observer for every upstream: `upstream-request-timing.ts`

Rename `core-request-timing.ts` to `upstream-request-timing.ts` with `git mv`. The marker
AsyncLocalStorage then stores `{ timing, upstream }` instead of a bare `RequestTimingState`.
`onRequestCreated` calls `timing.startUpstreamCall(upstream)`. The end handling, the `WeakMap`,
the "already registered" guard and the malformed-message handling do not change. Exports:

- `initializeUpstreamRequestTiming()` / `stopUpstreamRequestTiming()`, which replace the `Core`
  names in `request-timing.ts`, `otel-sdk.ts` and the tests;
- `withCoreRequestTiming(cb)`: same name, same behaviour, still used by `DialClientService`;
- `withAnalyticsRequestTiming(cb)`: new.

Both delegate to one private `withUpstreamRequestTiming(upstream, cb)`. That function still
returns `callback()` unchanged when the observer is not subscribed or no request timing is
active. AsyncLocalStorage `run` nests, so the innermost marker wins. A Core call made from
inside an ADAS marker, or the other way round, which never happens today, would count only
toward the inner upstream. The file comment changes from "Core-fetch context" to "marked
upstream transports", and still lists themes, OIDC and other native fetches as excluded.

_Alternative:_ keep the `core-request-timing.ts` file name. Rejected: the module would then
time two upstreams under a Core-only name. The rename touches 9 files, all of them in
`apps/chat-api` and `docs/observability.md` (whose relative link `npm run validate:docs`
checks). No spec cites the path.

### D4 — Mark inside `fetchAnalytics`, around the `globalThis.fetch` call only

```ts
const response = await withAnalyticsRequestTiming(() =>
  globalThis.fetch(input, { ...init, headers, redirect: 'manual', signal }),
);
```

Header construction, the timeout signal and `startedAt` stay before this call. The log line and
the error-body cancel stay after it. None of them moves. The interval starts at undici
`request:create`, not at `fetchAnalytics` entry, and ends at `trailers` or `error`, so
it covers the same span as Core: queueing and connection, the upload, and the body until the SDK
finishes reading it, or until `cancel()` / timeout / caller abort ends it. The wrapper observes
diagnostics channels only. It never touches `Response.body`, and the bodiless `Response` that
`fetchAnalytics` returns on failure is never observed.

_Alternative:_ mark around SDK calls in `UsageHistoryService`. Rejected: every new ADAS consumer
would have to repeat it, and a call that bypassed it would silently land in `chat`. This mirrors
`DialClientService.withCoreHeaders`, which marks at the transport.

### D5 — Emission

- Metric: `dial.chat.http.request.phase.duration` keeps its name, unit, buckets and labels. The
  `analytics` value comes from the enum loop (D1). The description reads "...split into total,
  the union of Core wire intervals, the union of DIAL Analytics wire intervals, and time outside
  both".
- Span: add `'dial.chat.http.duration.analytics': durations.analytics` to the `setAttributes`
  call. No header is added. `Server-Timing` is out of scope (proposal, Non-goals).
- `analytics` is recorded on every monitored request, with zero for routes that never call ADAS,
  the same as `core` today. Dashboard means therefore divide by the same count across phases, and
  a missing series still means "no observation" rather than "zero" (see Risks for cardinality).

### D6 — Dashboard 08 edits (`docs/examples/dashboards/08-bff-request-latency.json`)

- "All endpoints — Core and outside-Core attribution" table: add target `E` (mean
  `phase="analytics"`), copying target `B` with only the phase changed. Rename the columns to
  "Mean Core", "Mean Analytics", "Mean outside Core and Analytics", "Core time share". Keep the
  existing refIds so the organize/override mapping changes as little as possible. Update the
  description to say that overlap counts in both Core and Analytics.
- "Top 10 slowest endpoints — mean time components" bar chart: add an Analytics series (target
  `D`, mirroring `A`). Stack the bars as Core, Analytics, Outside. The description states that
  the stack can exceed the mean total when Core and Analytics overlap.
- "Slow request instances" Tempo table: add `span.dial.chat.http.duration.analytics` to the
  `select(...)` and to the `convertFieldType` / `organize` transforms, as an "Analytics"
  column after "Core".
- "Core share of request time" stat and every `phase="total"` query: unchanged.
- Rename the panel title "Core and outside-Core attribution" to "Upstream and outside-upstream
  attribution", and change the table row in `docs/observability.md` to match.

### D7 — Tests

Unit tests run with an injected clock and observer tests with synthetic diagnostics messages,
as today. The integration tests use real undici and the existing fake servers:

- `request-timing-state.spec.ts`: Analytics only; Core only (numbers unchanged); overlapping
  Core + Analytics (`chat = total − union`, shared time in both phases); overlapping Analytics
  calls; an unfinished Analytics call clipped at settlement; idempotent end; and "end called
  before settlement on the failure path stops accruing", which models the cancelled body
  (the real cancel is covered below).
- `upstream-request-timing.spec.ts` (renamed): the existing cases, plus that an ADAS-marked
  request attributes to `analytics` only, nested markers attribute to the inner upstream, and
  `request:error` ends an ADAS interval.
- `dial-analytics-client.service.spec.ts`: replace `does not count an ADAS call as DIAL Core
  time` with "counts an ADAS call as Analytics and not Core". Add three cases against
  `fake-analytics.server.ts`:
  - a 500 with a large `stallBody` response whose cancelled body stops accruing (wait after the
    call, then `analytics` stays well below the elapsed time);
  - a `hang` call aborted by a short `ANALYTICS_TIMEOUT_MS` ends at the abort;
  - a 302 under `redirect: 'manual'` closes the interval.
- `request-timing.integration.spec.ts`: `expectCompletePhases` expects four phases and checks
  `core + analytics + chat ≈ total` for the non-overlapping routes. Add one route that runs a
  Core call and an ADAS call concurrently and asserts `chat ≈ total − union`, with
  `core + analytics > total − chat`.
- New `apps/chat-api/src/usage-history/tests/user-usage-history.timing.integration.spec.ts`:
  a Nest app with `createRequestTimingMiddleware` and `UserUsageHistoryController`, with a
  stubbed guard as in `user-usage-history.controller.integration.spec.ts`, against
  `startFakeAnalytics` with delayed answers. It asserts four phases on route
  `/api/v1/user/usage/history` (the resolved template format that
  `request-timing.integration.spec.ts` already asserts), `core = 0`,
  `analytics ≥` the injected delay, and `chat ≈ total − analytics`. It sets the global
  `MeterProvider` before dynamically importing `request-timing`, as the existing integration
  test does, because the meter is created at module load.

## Risks / Trade-offs

- [The phase histogram gets one more series group per existing label set, about +33% of its
  series, even on routes that never call ADAS] → This matches how `core` is recorded and keeps
  per-phase means on one denominator. The rejected alternative (record `analytics` only when
  non-zero) would save series but give a different count per phase and break the "four
  observations" invariant. Revisit if the histogram's cardinality becomes a problem.
- [`chat` gets smaller for usage-history, which reads as an improvement on long-term graphs]
  → Note in the release text and `docs/observability.md` that the meaning narrowed on this
  version.
- [External dashboards or alerts may sum phases, or assume `total = core + chat`] → No such
  consumer exists in the repo. Existing label values are untouched. The release note names the
  new value and the narrowed `chat`.
- [Core and ADAS overlap makes the stacked bar exceed the mean total] → Document it in the panel
  description. Today usage-history makes no Core call, so this is rare.
- [Undici's diagnostics semantics could change in a future Node major] → The same dependency
  exists for Core. The new client-spec cases (cancelled body, timeout, redirect) fail loudly if
  `trailers`/`error` stop firing.
- [Nested markers attribute to the inner upstream only] → No current code nests them. This is
  documented in the observer comment and covered by an observer test.

## Migration Plan

1. Ship as one PR: code, tests, dashboard JSON, docs and the spec delta.
2. Operators re-import dashboard 08. The old JSON keeps working, because its queries select
   explicit phases; it just doesn't show Analytics.
3. During a rolling deploy, old pods emit no `analytics` series. Queries leave it absent rather
   than zero, as the spec's rolling-deploy scenario requires.
4. Rollback: revert the PR. `analytics` series stop and `chat` includes ADAS again. No data or
   config migration is needed. There is no env var or feature flag.
