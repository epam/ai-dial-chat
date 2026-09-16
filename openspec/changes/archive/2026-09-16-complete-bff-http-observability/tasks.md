Slicing strategy: **risk-first, then vertical.** The riskiest unknown is whether a raw
`http.Server` `'request'` listener attached ahead of Express/Nest actually behaves as design.md's
D1/D2 predict (exactly-once terminal recording across finish/close/error races, no listener leak,
no interference with existing behavior) against the *real* bootstrap. Section 2 proves that first,
against a throwaway harness, before Section 3 wires the real instruments into `main.ts`. Sections
4-6 (dashboard, docs, infra) are independent verticals that only need Section 3's metric names to
exist on paper (already fixed in design.md), so they can proceed in parallel with Section 3's
later slices once Section 2's mechanism is proven.

Each numbered task is independently verifiable. Run `npm run verify:changed` once per completed
group (not per task), and close the change with exactly one `npm run verify:full`.

## 1. Baseline verification (no code changes)

- [x] 1.1 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` once before any edit, to
  have a clean baseline to diff test/lint output against for the rest of this change.

## 2. Prove the instrumentation mechanism (risk-first slice)

- [x] 2.1 Add `apps/chat-api/src/telemetry/http-lifecycle-metrics.ts`: the three instrument
  definitions only (`dial.chat.http.requests.started`, `dial.chat.http.requests.active`,
  `dial.chat.http.response.duration` with the explicit bucket boundaries from design.md D5), no
  wiring yet — same `meter.createCounter`/`createUpDownCounter`/`createHistogram` pattern as
  `telemetry/http-metrics.ts`.
  - Verification: `npm run test:file -- apps/chat-api/src/telemetry/http-lifecycle-metrics.spec.ts`
    (new spec asserting instrument names/units/unit strings match design.md D4 exactly).
- [x] 2.2 Add `apps/chat-api/src/telemetry/http-lifecycle-listener.ts` exporting
  `attachHttpLifecycleListener(server: http.Server): void`, implementing design.md D1/D2/D3: the
  `'request'` handler capturing `process.hrtime.bigint()` and the bounded method attribute,
  incrementing `requests.started`/`requests.active`, then attaching `once()` listeners for
  `res.on('finish')`, `res.on('close')`, `res.on('error')`, `req.on('aborted')`, `req.on('error')`
  behind a single `settled` guard that performs exactly one terminal recording (decrement
  in-flight with the entry-time attribute set; record the duration histogram with the resolved
  `http.route`/`http.response.status_code`/`dial.chat.http.outcome`/`dial.chat.http.transport_kind`
  per design.md D3-D5). Exclude `TELEMETRY_EXCLUDED_PATHS` paths (raw `req.url` check, same
  predicate `telemetry/excluded-paths.ts` already exports). Only attach when
  `metricsExporters.length > 0` (mirror `otel-sdk.ts:121-124`).
  - Verification: `npm run test:file -- apps/chat-api/src/telemetry/http-lifecycle-listener.spec.ts`
    using a bare `http.createServer()` (no Nest) with fake handlers that finish normally, throw,
    abort before headers, and abort mid-stream, asserting: exactly one terminal recording per
    case, correct `outcome`, `requests.active` net-zero after each case, and
    `res.listenerCount('close')`/`('finish')` returns to baseline after each case.
- [x] 2.3 Write a supertest-against-real-`main.ts`-bootstrap integration test
  (`apps/chat-api/src/telemetry/tests/http-lifecycle.integration.spec.ts` — renamed from the
  `.e2e-spec.ts` suffix originally specified here: that suffix doesn't match this repo's vitest
  `include` glob (`*.spec.ts` only) or the `.claude/rules/spec.md` naming convention, so the file
  would never run; `.integration.spec.ts` mirrors the existing
  `attach-generation.integration.spec.ts` convention, using `@nestjs/testing`'s
  `Test.createTestingModule` bootstrapped the same way `main.ts` does — helmet, `ValidationPipe`,
  versioning, global prefix — per Requirement 8) proving the mechanism against the *actual*
  pipeline before touching `main.ts` itself: instantiate a standalone `http.Server` wrapping the
  test app's handler, call `attachHttpLifecycleListener`, and assert scenarios from
  `specs/bff-http-lifecycle-metrics/spec.md`'s "Instrumentation point precedes parsing, guards,
  and routing" requirement (guard rejection observed, oversized body observed, unmatched route
  observed) without yet wiring it into the shipped `main.ts`.
  - Verification:
    `npm run test:file -- apps/chat-api/src/telemetry/tests/http-lifecycle.integration.spec.ts`.

## 3. Wire into main.ts and finish the metric contract

- [x] 3.1 In `apps/chat-api/src/main.ts`, call
  `attachHttpLifecycleListener(app.getHttpServer())` as the first statement inside `bootstrap()`
  after `NestFactory.create(...)` and before `app.enableShutdownHooks()`/any `app.use(...)` call,
  with a block comment analogous to `otel-sdk.ts`'s existing "must run first" comment explaining
  why (design.md D1, Risks: "future `app.use()` inserted earlier").
- [x] 3.2 Confirm the `http.route`/`transport_kind` resolution at settle time correctly reads
  Nest's `req.route?.path` (reuse `telemetry/http-metrics.ts`'s `resolveRouteTemplate` and the
  fixed streaming-route list from design.md D5:
  `/api/v1/conversations/completions`, `/api/v1/conversations/completions/attach`,
  `/api/v1/conversations/watch`, `/api/v1/client-channel/subscribe`) — add this resolution as a
  small pure helper in `http-lifecycle-metrics.ts` (`resolveTransportKind(route: string): 'ordinary'
  | 'streaming' | 'unmatched'`) so it is unit-testable without booting an HTTP server.
  - Verification: extend `http-lifecycle-metrics.spec.ts` with cases for each of the four
    streaming routes, one ordinary route, and the `unmatched` fallback.
- [x] 3.3 Extend the Section 2.3 integration test file to cover the remaining Requirement 8
  scenarios against the real bootstrap: successful requests and redirects; validation and
  controller/service exceptions; disconnects before headers and during an SSE stream
  (`POST /api/v1/conversations/watch` is the reference streaming route — simulate client abort
  via destroying the test socket mid-response); errors after headers are committed; duplicate
  terminal events (assert no double-counting when both `'finish'` and a later `'close'` fire);
  telemetry-exclusion paths (`/api/health`); a custom `API_PREFIX` value; and both
  `OTEL_SDK_DISABLED=true` and an exporter-failure mode (point `OTEL_EXPORTER_OTLP_ENDPOINT` at an
  unreachable host and assert requests still complete normally).
  - Verification:
    `npm run test:file -- apps/chat-api/src/telemetry/tests/http-lifecycle.integration.spec.ts`.
- [x] 3.4 Add an assertion-only test scraping `/metrics` from a real, standalone-built process
  (mirroring the existing README "Production smoke test" recipe) to verify the exported Prometheus
  series names/units/labels/bucket boundaries match design.md D4/D5 exactly
  (`dial_chat_http_requests_started_total`, `dial_chat_http_requests_active`,
  `dial_chat_http_response_duration_bucket` with the 15 documented `le` values).
  - Verification: run the documented `curl http://localhost:9464/metrics` smoke test manually and
    record the observed series/label names in this task's PR description; this is local/manual
    validation, not a CI-gated automated test (Requirement 8's split between automated and
    deployment evidence).
  - Done: ran `npm exec nx build chat-api` then the README's exact "Production smoke test" recipe
    (`node apps/chat-api/dist/main.js` with `OTEL_SDK_DISABLED=false`,
    `OTEL_METRICS_EXPORTER=prometheus`), hit `GET /api/health`, `GET /api/v1/does-not-exist`,
    `GET /`, then scraped `http://localhost:9464/metrics`. Confirmed exactly:
    `dial_chat_http_requests_started_total{http_request_method="GET",...} 2` (health excluded, so
    only the other two GETs counted), `dial_chat_http_requests_active{...} 0` (net-zero after
    settling), and `dial_chat_http_response_duration_bucket`/`_count`/`_sum` series carrying
    `http_request_method`, `http_route` (`"unmatched"` for both non-matched paths),
    `dial_chat_http_outcome="completed"`, `dial_chat_http_transport_kind="unmatched"`, and
    `http_response_status_code` (`404`/`200`), with all 15 documented `le` boundaries
    (`0.005`...`60`) plus `+Inf` present on every bucket series. Process exited cleanly on
    `SIGTERM`.
- [x] 3.5 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` for the whole
  `telemetry`/`common` change surface; diff against the Section 1.1 baseline to confirm no
  pre-existing test regressed.

**Application acceptance criteria for Sections 2-3**: exactly one arrival and one terminal
observation per completed request lifecycle (proven in 2.2/2.3/3.3); net-zero in-flight after each
request; no unbounded/raw-path attribute value ever recorded; response status codes, bodies, and
headers are byte-identical to the pre-change behavior for every scenario in
`specs/bff-http-lifecycle-metrics/spec.md`; `http.server.request.duration` is unchanged (no test
in `metrics.interceptor.spec.ts` needs to change).

## 4. Dashboard (local, git-ignored — tracked here as tasks, not as repo deliverables)

- [x] 4.1 In `bff-observability-local/generate_dashboards.py`, add a `00-bff-overview-http.json`
  generator function reusing the existing `variable()`/`panel()`/`rate()`/`mean()`/`fraction()`
  helpers, rebuilding the `route`/`method` template variables from
  `dial_chat_http_response_duration_count` instead of `http_server_request_duration_count`.
- [x] 4.2 Add panels per design.md D7: arrival RPS, in-flight gauge, completed-response rate/status
  distribution, documented-denominator 4xx/5xx fraction, ordinary p50/p95/p99 via
  `histogram_quantile(..., sum by (le) (rate(...)))`, busiest/slowest/error routes, and a separate
  generation/subscription duration panel filtered to `dial_chat_http_transport_kind="streaming"`.
  Use `or vector(0)` only where design.md D7 says it is correct (never on the in-flight or per-pod
  latency panels).
- [x] 4.3 Add the availability row per design.md D8: a live `up{job="$job"}` panel labeled as
  scrape health, plus explicit text/placeholder panels reading "Requires external verification — no
  ServiceMonitor/ingress/synthetic-check configuration found in this repository as of this
  change," with no query against an invented metric name.
- [x] 4.4 Add the trace-navigation data link per design.md D9: a Grafana data link parameterized by
  `${tempo_datasource}`/`${loki_datasource}` template variables, `service.name`, `http_route`, and
  the dashboard's time range, labeled as a scoped search (not an exact-request link), on the
  routes/latency panels.
- [x] 4.5 Run `python3 bff-observability-local/generate_dashboards.py` to emit
  `bff-observability-local/dashboards/00-bff-overview-http.json`; confirm
  `dashboards/01-bff-http-handlers.json` is byte-unchanged.
  - Verification: validate the emitted JSON parses and, if a local Grafana instance is available,
    import it and confirm no schema errors (manual/local — not CI-gated).
  - Done: ran the generator; `01-bff-http-handlers.json`, `02-bff-conversation-generations.json`,
    and `03-bff-routing-streaming.json` are all byte-unchanged (`diff` clean, identical md5 before
    and after). `00-bff-overview-http.json` parses as valid JSON, has 14 unique panel IDs, no grid
    overlaps, and its route/method template variables query
    `dial_chat_http_response_duration_count` (not `http_server_request_duration_count`). No local
    Grafana instance was available to perform a live import.
- [x] 4.6 Update `bff-observability-local/bff-observability-plan.md` to record: the corrected
  streaming-route list (replacing the stale `.*/chat/completions` pattern), the new instrument
  contracts, and which panels remain "requires external verification."

**Dashboard acceptance criteria**: `00-bff-overview-http.json` is valid, importable JSON for the
target Grafana version; every panel backed by an application-owned metric renders against a real
`/metrics` scrape (Section 3.4's series); `01-bff-http-handlers.json` is unmodified; no panel query
references a metric name, label, or datasource UID that does not exist in this repository's own
instrumentation or in a template variable.

## 5. Documentation (same-change updates per AGENTS.md docs rule)

- [x] 5.1 Update `apps/chat-api/README.md`'s Observability section: document the three new
  instruments (name/type/unit/attributes/recording boundary/exclusions), the coexistence with
  `http.server.request.duration`, the bucket-boundary compatibility policy (design.md D5), and a
  short note pointing at the new dashboard's "requires external verification" panels so a reader
  does not assume they are live.
- [x] 5.2 Update `docs/architecture.md` if its telemetry/observability summary enumerates specific
  metric instruments; if it only summarizes the mechanism (OTel bootstrap, Prometheus listener)
  without naming individual metrics, confirm no change is needed and note that check in the PR
  description instead of editing speculatively.
  - Checked: `docs/architecture.md`'s Backend section (around line 314) describes the OTel
    bootstrap mechanism and names collected metric *categories* in prose ("process memory,
    outstanding SSE operations, and generation registry size") but no literal dotted OTel
    instrument name (e.g. `dial.chat.process.memory`) and, notably, it never named the pre-existing
    `http.server.request.duration` histogram either — it was already not an exhaustive instrument
    list before this change. No edit made; this satisfies the task's own "no change needed"
    criterion.
- [x] 5.3 Run `npm run validate:docs` after 5.1/5.2.

**Infrastructure/external acceptance criteria carried by docs**: `apps/chat-api/README.md`
explicitly states that ingress/platform-availability panels are unverified and lists the concrete
prerequisites (ServiceMonitor/ingress config, ownership) an operator needs to complete them — this
is the artifact this change actually delivers for Requirement 6, not a working integration.

## 6. Infrastructure / external tasks (explicitly gated — not completable in this repository)

- [ ] 6.1 (External, manual gate) Confirm with the team operating the deployment whether a
  `ServiceMonitor`/`PodMonitor` or equivalent scrape config exists outside this repository for
  `apps/chat-api`; if so, record its real job/label names and update the dashboard's availability
  row from placeholder to live panels in a follow-up change — do not attempt this from inside this
  repository, since no such config was found here.
- [ ] 6.2 (External, manual gate) Confirm the actual trace/log backend (Tempo, Loki, or otherwise)
  and its Grafana datasource UID in the target environment; bind `${tempo_datasource}`/
  `${loki_datasource}` to real values when importing the dashboard there.
- [ ] 6.3 (External, manual gate) Deploy to a real cluster and verify: the dashboard renders live
  data end-to-end; the p95/p99 panels show sane values under real traffic; the availability row's
  placeholder panels are either wired to real platform metrics or intentionally left as
  documentation.

**Infrastructure acceptance criteria**: none of Section 6 is required for this change's own
completion (per proposal.md's definition of done) — these are recorded so the P0 item is not
mistakenly marked fully complete until 6.1-6.3 are actually done against a real cluster, per
Requirement 6.
