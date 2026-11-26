# Tasks

Slicing strategy: **risk-first, then vertical**. Group 1 proves the arithmetic in isolation
(union across upstreams, `chat` never negative), and existing Core numbers stay identical.
Group 2 generalises the observer without any behaviour change. Group 3 delivers the one
user-visible path, ADAS → `analytics` phase → metric/span, end to end with its tests. Group 4
updates the operator-facing dashboard and docs. Group 5 runs the integration gates. Every group
ships its own tests and doc updates. Follow `apps/chat-api/AGENTS.md` (tests under `tests/`
next to the source concern, extensionless relative imports).

## 1. Timing state: per-upstream unions (risk-first)

- [x] 1.1 In `apps/chat-api/src/telemetry/request-timing-state.ts`:
  - add `RequestTimingPhase.Analytics = 'analytics'` and the
    `RequestTimingUpstream { Core = 'core', Analytics = 'analytics' }` enum;
  - replace the single Core accumulator with one `{ active, startedAt, milliseconds }` record
    per upstream plus an "any upstream" record (design D2);
  - replace `startCoreCall()` with `startUpstreamCall(upstream)`, keeping the idempotent end
    callback and the post-settle no-op;
  - compute each upstream phase as `min(total, …)` and `chat = max(0, total − union)`;
  - update the class comment;
  - change the one existing caller in `apps/chat-api/src/telemetry/core-request-timing.ts` to
    `startUpstreamCall(RequestTimingUpstream.Core)`, so the slice compiles on its own.

  Verification: `npm exec nx run chat-api:typecheck` passes.
- [x] 1.2 Update `apps/chat-api/src/telemetry/tests/request-timing-state.spec.ts`. Existing
  cases get `analytics: 0` in their expected snapshots, with Core numbers unchanged. Add:
  - Analytics only;
  - overlapping Core + Analytics: shared time in both phases, `chat = total − union`;
  - overlapping Analytics calls count once;
  - an unfinished Analytics call is clipped at settlement and a later end changes nothing;
  - an Analytics call ended early on the failure path stops accruing;
  - `chat` is never negative and no phase exceeds `total`.

  Verification: `npm run test:file -- apps/chat-api/src/telemetry/tests/request-timing-state.spec.ts`.

## 2. Observer: one module for all marked upstreams (no behaviour change)

- [x] 2.1 `git mv apps/chat-api/src/telemetry/core-request-timing.ts apps/chat-api/src/telemetry/upstream-request-timing.ts`.
  Then:
  - make the marker storage hold `{ timing, upstream }`;
  - call `timing.startUpstreamCall(upstream)` from `onRequestCreated`;
  - rename `initializeCoreRequestTiming` / `stopCoreRequestTiming` to
    `initializeUpstreamRequestTiming` / `stopUpstreamRequestTiming`;
  - keep `withCoreRequestTiming`, add `withAnalyticsRequestTiming`, both delegating to a
    private `withUpstreamRequestTiming` (design D3);
  - update the module comment, which must still name themes, OIDC and other native fetches as
    excluded.

  Update the imports in `apps/chat-api/src/telemetry/request-timing.ts`,
  `apps/chat-api/src/telemetry/otel-sdk.ts` and `apps/chat-api/src/dial/dial-client.service.ts`.
  Verification: `npm exec nx lint chat-api` and `npm exec nx build chat-api` pass.
- [x] 2.2 `git mv apps/chat-api/src/telemetry/tests/core-request-timing.spec.ts apps/chat-api/src/telemetry/tests/upstream-request-timing.spec.ts`.
  Keep the existing cases. Add:
  - an Analytics-marked request attributes only to `analytics`;
  - nested markers attribute to the inner upstream;
  - `request:error` ends an Analytics interval.

  Update the imports in `apps/chat-api/src/telemetry/tests/request-timing.spec.ts`,
  `apps/chat-api/src/telemetry/tests/trace-propagation.spec.ts`,
  `apps/chat-api/src/telemetry/tests/request-timing.integration.spec.ts` and
  `apps/chat-api/src/dial/tests/dial-analytics-client.service.spec.ts`.
  Verification: `npm run test:file -- apps/chat-api/src/telemetry/tests/upstream-request-timing.spec.ts`
  and the same command for `apps/chat-api/src/telemetry/tests/request-timing.spec.ts` and
  `apps/chat-api/src/telemetry/tests/trace-propagation.spec.ts`.
- [x] 2.3 Fix the relative link to the renamed observer in `docs/observability.md`
  ("Request timing attribution"). Verification: `npm run validate:docs` passes.

## 3. ADAS → `analytics` phase, end to end

- [x] 3.1 In `apps/chat-api/src/dial/dial-analytics-client.service.ts`, wrap only the
  `globalThis.fetch(...)` call inside `fetchAnalytics` with `withAnalyticsRequestTiming` (design
  D4). The headers, timeout signal, `startedAt`, log line and error-body cancel keep their
  position. Add one sentence to the class JSDoc saying ADAS wire time is recorded as the
  `analytics` request-timing phase. Verification: the existing
  `npm run test:file -- apps/chat-api/src/dial/tests/dial-analytics-client.service.spec.ts`
  cases for redirect, timeout, User-Agent and the unread error body still pass unchanged.
- [x] 3.2 In `apps/chat-api/src/telemetry/request-timing.ts`, update the histogram description
  and add the `dial.chat.http.duration.analytics` span attribute (design D5). Extend
  `apps/chat-api/src/telemetry/tests/request-timing.spec.ts` to assert four recorded phases and
  the new span attribute. Verification:
  `npm run test:file -- apps/chat-api/src/telemetry/tests/request-timing.spec.ts`.
- [x] 3.3 In `apps/chat-api/src/dial/tests/dial-analytics-client.service.spec.ts`, replace
  `does not count an ADAS call as DIAL Core time` with a case where an ADAS call counts as
  Analytics and not as Core. Add these cases against
  `apps/chat-api/src/dial/tests/fake-analytics.server.ts`:
  - a failed call with a large `stallBody` error body stops accruing once the body is
    cancelled;
  - a `hang` call aborted by a short `ANALYTICS_TIMEOUT_MS` ends at the abort;
  - a 302 under `redirect: 'manual'` closes its interval.

  Verification:
  `npm run test:file -- apps/chat-api/src/dial/tests/dial-analytics-client.service.spec.ts`.
- [x] 3.4 In `apps/chat-api/src/telemetry/tests/request-timing.integration.spec.ts`:
  - make `expectCompletePhases` expect `['analytics', 'chat', 'core', 'total']` and
    `core + analytics + chat ≈ total` for the non-overlapping routes;
  - add a route that runs a Core call and an ADAS call (via the fake analytics server)
    concurrently, and assert that `chat ≈ total − union` while `core + analytics` exceeds
    `total − chat`;
  - keep the "untagged outbound fetch" case asserting `analytics = 0` too.

  Verification:
  `npm run test:file -- apps/chat-api/src/telemetry/tests/request-timing.integration.spec.ts`.
- [x] 3.5 Add a supertest integration test,
  `apps/chat-api/src/usage-history/tests/user-usage-history.timing.integration.spec.ts`, that
  mounts `UserUsageHistoryController` with `createRequestTimingMiddleware` and a stubbed guard
  (as `user-usage-history.controller.integration.spec.ts` does), against `startFakeAnalytics`
  with delayed schema and query answers. Set the global `MeterProvider` before dynamically
  importing `request-timing`. For `GET /api/v1/user/usage/history`, assert:
  - four phases on route `/api/v1/user/usage/history`;
  - `core = 0`;
  - `analytics ≥` the injected delay;
  - `chat ≈ total − analytics`.

  Verification:
  `npm run test:file -- apps/chat-api/src/usage-history/tests/user-usage-history.timing.integration.spec.ts`.
- [x] 3.6 Run `npm run verify:changed` once for the completed slice (groups 1–3).

## 4. Operator surfaces: dashboard 08 and docs

- [x] 4.1 Edit `docs/examples/dashboards/08-bff-request-latency.json` per design D6:
  - attribution table: add target `E` (mean Analytics) and rename the columns;
  - mean-time-components bar chart: add an Analytics series and update its description;
  - Tempo table: add `span.dial.chat.http.duration.analytics` to `select` and to the
    transforms;
  - rename the panel title to "Upstream and outside-upstream attribution";
  - leave every `phase="total"` / Core-share query unchanged.

  Verification: the file parses (`python3 -I -m json.tool docs/examples/dashboards/08-bff-request-latency.json > /dev/null`),
  and a grep shows that every new target copies its sibling with only `dial_chat_http_phase="analytics"`
  changed.
- [x] 4.2 Update `docs/observability.md`:
  - the "Request timing attribution" table: phase values `total`, `core`, `analytics`, `chat`;
  - replace the invariant `total = core + chat` with
    `chat = total − (Core ∪ Analytics)` and note the overlap;
  - describe the Analytics observer next to the Core one, and change "Other upstream fetches
    are excluded" to name themes/OIDC/other native fetches;
  - span attributes `.analytics`;
  - the "Investigate slow requests over a day" paragraph (Core / Analytics / outside upstream);
  - the dashboard-08 table row.

  Verification: `npm run validate:docs`.
- [x] 4.3 Update the request-timing passages in `apps/chat-api/README.md` (Traces and Metrics
  bullets: "Core-active, Analytics-active and outside-upstream") and in `docs/architecture.md`
  (observability paragraph: "the union of overlapping Core and DIAL Analytics request
  intervals"). Verification: `npm run validate:docs`.

## 5. Integration gates

- [x] 5.1 `npm exec nx run-many -t build,test,lint -p chat-api` passes.
- [x] 5.2 `npm run validate:specs` passes (the delta cites
  `apps/chat-api/src/dial/dial-analytics-client.service.ts`).
  `npm run spec:impact` lists no unexpected spec besides `request-latency-attribution`, whose
  delta is in this change.
- [x] 5.3 `openspec validate measure-analytics-request-timing --strict` passes.
- [x] 5.4 Run `npm run verify:full` once to close the change.

## Workflow follow-up

- While archiving, update the `## Purpose` of `openspec/specs/request-latency-attribution/spec.md`
  to say "total, Core-active, Analytics-active and outside-upstream duration". The delta cannot
  carry Purpose edits.
- Release note: a new `dial_chat_http_phase="analytics"` value; `chat` now excludes DIAL Analytics
  wait time; re-import dashboard 08.
- Archive with `/opsx:archive` after review and merge.
