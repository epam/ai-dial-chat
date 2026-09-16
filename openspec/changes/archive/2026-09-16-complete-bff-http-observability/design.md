## Context

`apps/chat-api` (NestJS 11, Express adapter) currently has one HTTP metric source:
`MetricsInterceptor` (`apps/chat-api/src/common/interceptors/metrics.interceptor.ts`), registered as
a global `APP_INTERCEPTOR` in `apps/chat-api/src/app/app.module.ts:73-74`. Nest's request pipeline
runs, in order: raw Express middleware (`app.use(...)`, including `cookieParser`, the
`useBodyParser` JSON limit, `helmet`, CORS, and the static/SPA-fallback middleware from
`apps/chat-api/src/app/static-assets.ts`) → routing → guards (`canActivate`) → interceptors
(`before` phase) → pipes → the controller handler → interceptors (`after`/`tap` phase, where
`MetricsInterceptor` records). Anything that short-circuits before the interceptor's `tap()` runs
— a guard rejection, a body-parser error, an unmatched route — is invisible to
`http.server.request.duration`. `main.ts` verified live (read line-by-line for this design, not
assumed): `bootstrap()` builds the Nest app, then in this order registers `cookieParser`, a legacy-
cookie-clearing middleware, `traceparentMiddleware`, the global `TraceparentErrorFilter`,
`enableVersioning`, `useBodyParser('json', { limit: ... })`, `helmet`, a `Permissions-Policy`
middleware, the global `ValidationPipe`, `setGlobalPrefix('api')`, `enableCors`, and finally the
frontend static/SPA middleware — all via `app.use(...)`, all before `app.listen(port)`. The
Prometheus metrics scrape endpoint (`apps/chat-api/src/telemetry/otel-config.ts:84-97`,
`PrometheusExporter`) runs on a **separate** `http.createServer()` on its own port (default
`127.0.0.1:9464`), entirely outside this Express app and its middleware stack — confirmed by
reading `otel-config.ts` and `telemetry/excluded-paths.ts`'s own comment ("`/metrics` never
actually reaches `MetricsInterceptor` ... served by the Prometheus exporter's own standalone
`http.createServer()`").

`apps/chat-api/src/conversations/conversation.controller.ts` shows two different HTTP lifetime
shapes that any new instrumentation must not conflate: `POST /api/v1/conversations/completions`
(line 229, `@HttpCode(200)`) streams an SSE response whose generation is backend-owned —
`res.on('close', ...)` (lines 302-343) only marks the connection "detached"; it never aborts the
in-progress generation — while `POST /api/v1/conversations/watch` (line 470) and
`POST /api/v1/conversations/completions/attach` (line 377) are separate SSE routes with their own
setup/cleanup semantics (`apps/chat-api/src/common/utils/sse.ts`,
`telemetry`'s existing `dial.chat.sse.active` gauge in `openspec/specs/observability-telemetry/spec.md`).
This proposal's new instruments observe the **transport** (the raw HTTP request/response), which is
a materially different lifetime than the **business** generation these routes may launch — the two
must never be merged into one duration number.

`@opentelemetry/exporter-prometheus@0.221.0`'s `PrometheusSerializer`
(`node_modules/@opentelemetry/exporter-prometheus/build/src/PrometheusSerializer.js`) contains zero
occurrences of "exemplar" — verified by inspecting the built source — even though
`@opentelemetry/sdk-metrics@2.10.0` ships an `exemplar/` module (`AlignedHistogramBucketExemplarReservoir`,
filters, etc.) that this exporter never wires up. No repo code calls the exemplar APIs either. This
rules out Prometheus exemplar-based exact-request trace links for as long as this exporter version
is pinned.

No Kubernetes manifests, Helm charts, `ServiceMonitor`/`PodMonitor` CRDs, or ingress configuration
exist anywhere in this repository — verified with `find`/`grep` across the full working tree
(only application `Dockerfile`s were found, for `apps/chat-api` root and `apps/mcp-app-sandbox`).
Requirement 6 (ingress/platform availability) therefore has no in-repo ground truth to build panels
against; this design treats that entire area as external and unverified, per the proposal's
definition of done.

## Goals / Non-Goals

**Goals:**

- Instrument the complete HTTP transport lifecycle (arrival → in-flight → terminal outcome) at a
  point that precedes body parsing, guards, and routing, without changing any of those behaviors.
- Keep the existing `http.server.request.duration` histogram byte-identical in meaning and
  recording point; add new, separately-named instruments rather than redefining it.
- Produce truthful, bounded-cardinality labels; never fabricate a status code or route.
- Plan (not build) an importable "BFF Overview / HTTP" Grafana dashboard, explicitly marking any
  panel this repository cannot ground in real code or config as "requires external verification."
- Cover Requirements 1-8 of the user's P0 item exactly as scoped — general HTTP observability only.

**Non-Goals** (explicitly out of scope for this change, consistent with the proposal):

- Auth-specific analytics (login funnels, session-duration distributions).
- Upstream/DIAL-Core dependency metrics (latency or error rate of outbound calls).
- File-analytics or generation business-outcome metrics (completion success/failure semantics,
  token counts) — the existing `dial.chat.generations.active` gauge and any future generation-
  outcome metric are out of scope here; this change only touches the **HTTP transport** signal.
- Implementing or deploying the Grafana dashboard JSON against a live Prometheus/Grafana instance,
  or any Kubernetes/ingress/ServiceMonitor configuration — both are planned only, per Requirement 6.
- Changing request parsing, authentication, CORS, exception handling, response bodies, or routing.

## Decisions

### D1 — Instrumentation point: raw `http.Server` `'request'` listener, not Nest middleware or an interceptor

**Options compared:**

| Option | Sees guard/parser/auth rejections? | Depends on `app.use()` ordering? | Framework coupling |
| --- | --- | --- | --- |
| Nest interceptor (status quo, `MetricsInterceptor`'s point) | No — guards run first | N/A | Nest-specific |
| Express/Nest middleware, registered first via `app.use()` | Yes, if truly first | Yes — a future `app.use()` inserted earlier silently pre-empts it | Express-specific |
| Raw `http.Server` `'request'` event listener via `app.getHttpServer()` | Yes — fires before Express touches the request at all | No — attached directly to the server object, independent of middleware registration | Node-core, portable if the adapter ever changes |

**Chosen: the raw `http.Server` `'request'` listener.** `main.ts` calls `app.getHttpServer()`
immediately after `NestFactory.create()` and attaches the listener as the very first statement in
`bootstrap()`, before any `app.use(...)` call — mirroring the existing "must run first" pattern
already established by `otel-sdk.ts`'s import-order comment. This is provably the earliest point
Node hands the request to the application, so it cannot be pre-empted by a later change that adds
an `app.use()` call earlier in the stack. It also automatically excludes the Prometheus metrics
listener: that exporter opens its own separate `http.Server` (`otel-config.ts`'s
`PrometheusExporter`), which this code never touches, so "respect the separate metrics listener"
(Requirement 1) needs no special-case logic — it falls out of attaching to the right object.

Static/frontend traffic and OPTIONS preflight requests pass through this same server object, so
they are included in `dial.chat.http.requests.started`/`requests.active` by construction (a true
"is the BFF receiving traffic at all" signal). They fall into the same bounded `unmatched` route
fallback as any other un-routed request when the terminal histogram is recorded, because
`createFrontendMiddleware` (`apps/chat-api/src/app/static-assets.ts`) is plain Express middleware,
not a Nest controller — it never sets `req.route`. `GET /api/health` and `GET /metrics` are
excluded from all three new instruments via the same `TELEMETRY_EXCLUDED_PATHS` set
`telemetry/excluded-paths.ts` already uses for tracing and the existing histogram, so the three
exclusion points (tracing, existing histogram, new instruments) stay driven by one source of truth
instead of three that could drift apart.

**Rejected:** Nest middleware/interceptor options above, for the reasons in the table. A fourth
option — patching `HttpInstrumentation`'s own metrics (`@opentelemetry/instrumentation-http` ships
an opt-in HTTP server metrics feature) — was also considered and rejected: enabling it would create
a second, harder-to-control emitter of `http.server.*` semantics outside this app's own code,
directly conflicting with the existing "No duplicate HTTP metric sources" spec requirement's intent,
and it does not expose the fine-grained outcome/in-flight semantics Requirement 2/3 need.

### D2 — Exactly-once terminal recording: a single `settled` guard across `finish`/`close`/`error`/`aborted`

Node's `http.ServerResponse` emits `'finish'` when the response is fully sent, and separately
`'close'` when the underlying connection closes — which fires **in addition to** `'finish'` on a
normal keep-alive teardown, or **instead of** `'finish'` on a genuine client abort. `IncomingMessage`
also emits `'aborted'`/`'close'`. Per Requirement 2, ordinary `'close'` must never be read as
"response completed." Design: attach `once()` listeners for `res.on('finish')`, `res.on('close')`,
`res.on('error')`, `req.on('aborted')`, `req.on('error')` at request-entry time; the first one to
fire flips an in-closure `settled` boolean and performs the one terminal recording (decrement
in-flight, record the duration histogram with the resolved outcome); every later event on the same
request is a no-op because `settled` is already `true`. `once()` also self-removes each listener,
so no listener accumulates across the life of the process — verified by a dedicated integration
test asserting `res.listenerCount('finish')`/`('close')` returns to its pre-request baseline after
many sequential requests.

Duration is measured with `process.hrtime.bigint()` captured at the `'request'` event and again at
settle time, converted to seconds as a `Number` only at the point of recording — never
`Date.now()`, which is not monotonic across system clock adjustments.

### D3 — Outcome classification: a bounded 4-value enum, no fabricated status

`dial.chat.http.response.duration` carries an attribute `dial.chat.http.outcome` with exactly these
values:

- `completed` — `'finish'` fired.
- `aborted_before_response` — the connection closed/aborted and `res.headersSent` was still
  `false` — no status line was ever sent. `http.response.status_code` is **omitted** for this
  outcome (never a fabricated `200`, never an invented `499`).
- `aborted_during_response` — the connection closed and `res.headersSent` was `true` but `'finish'`
  never fired (covers a client disconnecting mid-SSE-stream, e.g. during
  `POST /api/v1/conversations/watch` or `.../completions`). `http.response.status_code` is included
  because the status line was committed (typically `200` for these streaming routes).
- `error` — `res`/`req` emitted `'error'` before either of the above resolved.

This distinguishes "the client left before we could answer" from "the client left mid-stream" from
"something in the transport itself failed" — three different operational stories that a single
"non-2xx" bucket would erase, and matches Requirement 3's explicit ask for both a truthful-outcome
model and an explicit non-fabricated representation for pre-header termination.

**Known, documented gap:** a request whose start line/headers Node itself rejects as malformed
never reaches the `'request'` event at all (it surfaces on the `http.Server`'s `'clientError'`
event instead, before any per-request object exists). This traffic is invisible to
`dial.chat.http.*` by construction, same as it always was to `http.server.request.duration`. It is
a smaller, adjacent gap belonging to Requirement 6's ingress/platform-availability story (a
WAF/ingress in front of this pod is the layer that would see it), not something this change's
application-level instruments can close.

### D4 — Attribute contracts per instrument (Requirement 3)

All three instruments live in `apps/chat-api/src/telemetry/http-lifecycle-metrics.ts` (new file,
next to `http-metrics.ts`), created once via `metrics.getMeter('dial-chat-api', ...)`, same pattern
`http-metrics.ts` already uses.

| Instrument | Type | Unit | Recorded at | Attributes | Exclusions |
| --- | --- | --- | --- | --- | --- |
| `dial.chat.http.requests.started` | Counter | `{request}` | Request entry (the `'request'` event) | `http.request.method` (bounded: `GET`/`HEAD`/`POST`/`PUT`/`PATCH`/`DELETE`/`OPTIONS`, else `unknown`) | `TELEMETRY_EXCLUDED_PATHS` (`/api/health`, `/metrics` — the latter is moot since this listener never sees that server, kept for symmetry with the shared predicate) |
| `dial.chat.http.requests.active` | UpDownCounter | `{request}` | `+1` at entry, `-1` at settle, **same attribute set captured once at entry and reused for the decrement** (method only — route is unknown at true arrival, so it is never part of this instrument's attribute set, unlike the terminal histogram) | `http.request.method` (same bounded set) | same |
| `dial.chat.http.response.duration` | Histogram | `s` | Settle (see D2) | `http.request.method`, `http.route` (Nest's resolved `req.route?.path` if set by settle time, else the bounded literal `unmatched` — same fallback `resolveRouteTemplate` already uses), `http.response.status_code` (int, present only when `res.headersSent`), `dial.chat.http.outcome` (D3's 4 values), `dial.chat.http.transport_kind` (`ordinary` \| `streaming` \| `unmatched` — D5) | same |

No attribute ever carries a raw URL, query string, conversation/deployment/user id, or trace id, on
any of the three instruments — satisfying Requirement 3's cardinality/PII rule directly.

### D5 — `transport_kind` and histogram bucket boundaries (Requirement 4)

The existing `http.server.request.duration` histogram uses OpenTelemetry's SDK-default bucket
boundaries, which start at `0, 5, 10` seconds — useless for typical sub-second BFF latency. Rather
than shipping two histograms (one for ordinary REST, one for long-lived routes — considered and
rejected because Requirement 2 names exactly one terminal-duration histogram, and a second name
would duplicate the "which histogram do I query" decision the dashboard already has to make via
route filtering), `dial.chat.http.response.duration` uses one explicit-boundary set spanning both
regimes: `[0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 10, 30, 60]` seconds —
fine-grained under 1s for ordinary REST, coarser but still present up to 60s for streaming routes.
A bounded `dial.chat.http.transport_kind` attribute lets the dashboard (and any PromQL author)
filter the same histogram into "ordinary" vs "streaming" views without needing two metric names.
`transport_kind` is resolved at settle time from the same `http.route` value:

- `streaming` when the resolved route template is one of a fixed, explicit list: verified against
  `conversation.controller.ts` and `client-channel.controller.ts` — `/api/v1/conversations/completions`,
  `/api/v1/conversations/completions/attach`, `/api/v1/conversations/watch`,
  `/api/v1/client-channel/subscribe`.
- `unmatched` when `http.route` is the `unmatched` fallback.
- `ordinary` for every other matched route.

This list is the corrected version of a route pattern in the local, git-ignored research notes
(`bff-observability-local/generate_dashboards.py`'s `STREAM_ROUTES`/`REST` variables), which
excludes a route literally named `.../chat/completions` — a route that does not exist in this
codebase (see proposal.md's Why section). Any dashboard/PromQL generated from that script must be
corrected to the route list above before being trusted.

**Bucket-boundary compatibility policy (Requirement 4):** this is a brand-new instrument, so there
is no prior boundary set to migrate away from. The policy going forward: once
`dial.chat.http.response.duration`'s bucket boundaries ship, changing them SHALL require a new
metric name (or an explicit version suffix), never an in-place boundary edit — Prometheus
`histogram_quantile` cannot correctly aggregate `_bucket` series with different `le` boundaries
across pods running old vs new code during a rolling deploy, and this avoids ever needing to
answer "which half of the fleet do these buckets belong to."

### D6 — Compatibility with `http.server.request.duration` (Requirement 4, modifies `observability-telemetry`)

`http.server.request.duration` (`MetricsInterceptor`) is left entirely unchanged: same name, same
recording point (post-guard, handler settlement), same attributes, same default SDK bucket
boundaries. It continues to answer "how long did the matched handler take" — still a useful,
distinct question from "what happened to the raw HTTP request", which is what the new instruments
answer. The existing `observability-telemetry` spec's "No duplicate HTTP metric sources"
requirement currently reads, unconditionally, "`MetricsInterceptor`'s histogram is the only emitter
of HTTP server request duration data points for the application" — literally true today, but it
would become false the instant any second instrument recording request duration exists, regardless
of name or purpose. The delta spec (see `specs/observability-telemetry/spec.md` in this change)
narrows this requirement's *scope* rather than deleting it: it still prohibits (a) a second emitter
of `http.server.request.duration` itself, and (b) either family double-recording internally: it
explicitly permits the new, differently-named `dial.chat.http.*` family to coexist because it
measures a different point in the lifecycle for a different purpose.

### D7 — Dashboard structure and PromQL conventions (Requirement 5)

A new, local (git-ignored, generated by an updated `bff-observability-local/generate_dashboards.py`)
`dashboards/00-bff-overview-http.json` is planned, not built, in this change (tasks.md schedules the
implementation work). It follows the existing script's own conventions exactly (same `variable()`/
`panel()`/`rate()`/`fraction()` helpers, same `datasource`/`cluster`/`namespace`/`job`/`pod`
template-variable pattern, `otel_scope_name="dial-chat-api"` base selector) with these additions:

- **Route/method variables** rebuilt from `dial_chat_http_response_duration_count` instead of
  `http_server_request_duration_count`, so they reflect the new instrument's label set.
- **Arrival RPS**: `sum by (pod) (rate(dial_chat_http_requests_started_total[$__rate_interval]))`.
- **In-flight**: `sum by (pod) (dial_chat_http_requests_active)` — a gauge, no `rate()`.
- **Completed-response rate / status distribution**: `sum by (http_response_status_code) (rate(dial_chat_http_response_duration_count{dial_chat_http_outcome="completed"}[$__rate_interval]))`.
- **4xx/5xx fraction — documented denominator**: numerator/denominator are both restricted to
  `dial_chat_http_outcome="completed"` (i.e. "of responses we actually completed, what fraction
  were 4xx/5xx"); aborted/error outcomes are shown in their own separate panel, never folded into
  this ratio's denominator, and the panel's description states this explicitly so a viewer does not
  read it as "fraction of all arrived requests."
- **Latency (mean, p50/p95/p99) for ordinary requests**: filtered to
  `dial_chat_http_transport_kind="ordinary"`; percentiles computed as
  `histogram_quantile(0.95, sum by (le) (rate(dial_chat_http_response_duration_bucket{...}[$__rate_interval])))`
  — bucket sums aggregated across pods **before** `histogram_quantile`, never a per-pod percentile
  averaged after the fact, per Requirement 4's explicit instruction.
- **Busiest / slowest / error-prone routes**: `topk(N, sum by (http_route) (rate(...)))` variants,
  reusing the existing script's `panel()` helper.
- **Generation/subscription duration**: the same histogram filtered to
  `dial_chat_http_transport_kind="streaming"`, presented as its own panel row so it is never mixed
  into the "ordinary latency" percentiles above.
- **Zero-traffic / counter-reset / duplicate-scrape handling**: every `rate()`/`increase()` call
  (never a raw counter subtraction) plus `or vector(0)` used **only** where "no traffic" is the
  correct reading (e.g. an error-rate numerator when the denominator is present but zero); panels
  whose absence should read as "no data," not "healthy zero" (e.g. the in-flight gauge, or any panel
  scoped to a `job`/`pod` combination that stopped scraping) deliberately omit `or vector(0)` so a
  gap renders as a gap. `job`/`instance` labels already present on every scraped series are relied
  on for scrape-job deduplication, consistent with the existing script.
- `01-bff-http-handlers.json` is preserved unchanged as a historical diagnostic dashboard — no
  migration is defined for it in this change, per the proposal.

### D8 — Ingress/platform availability panels (Requirement 6) — explicitly gated, unverified

No k8s/Helm/ingress/ServiceMonitor config exists in this repository (Context, above). The dashboard
plans a dedicated row with:

- A Prometheus `up{job="$job"}` panel — legitimate today because any Prometheus scraping this job
  already produces that series; label it "scrape health," not "pod availability."
- Placeholder/text panels for Kubernetes readiness/available-replica counts and any
  external/synthetic availability check, each explicitly reading **"Requires external
  verification — no ServiceMonitor/ingress/synthetic-check configuration found in this
  repository as of this change; wire these once the deploying environment's actual metric names
  and datasource are known."** These are not live queries against invented metric names — an empty
  or fabricated PromQL here would be worse than an explicit placeholder.
- A separate "requests rejected before reaching the BFF" concept (ingress-level 4xx/5xx, distinct
  from this app's own `dial_chat_http_response_duration`) is named as a future external panel only,
  never approximated from application-side data (this application literally cannot see traffic
  ingress rejected before it arrived).

Per the proposal, the P0 item's definition of done explicitly does **not** require this row to be
live — it requires the row to exist, be clearly marked, and list concrete prerequisites (metric
names, ownership, verification steps) for whoever operates the cluster to complete later.

### D9 — Trace navigation without exemplars (Requirement 7)

Given D0/Context's exemplar finding, this design does not attempt an exact-request metric→trace
link. Instead: a Grafana **data link** on the routes/latency panels, parameterized as
`${tempo_datasource}`/`${loki_datasource}` template variables (never hardcoded, since no backend
name is asserted anywhere in this repo — `OTEL_EXPORTER_OTLP_ENDPOINT` is the only configured
destination, and it is a generic OTLP collector, not necessarily Tempo/Loki), that opens an Explore
view scoped to `service.name="dial-chat-api"` (the resource attribute `otel-config.ts:44-49`
already sets) + the panel's `http_route` + the dashboard's current time range — a **search**, not a
link to one specific request's trace. The dashboard and `apps/chat-api/README.md` both state
explicitly that (a) this is a scoped search, not an exact link, because the pinned exporter has no
exemplar support, and (b) trace sampling means not every request in the searched window has a
trace at all (`OTEL_TRACES_SAMPLER` defaults to `parentbased_always_on` per the existing
`observability-telemetry` spec, but a deployment may override it). Early OTel initialization
(`otel-sdk.ts` import order), the active-span-derived `traceparent` response header, and
`TraceparentErrorFilter`'s JSON-body enrichment are all read-only inputs to this design — none of
them are modified.

## Risks / Trade-offs

- **[Double-counting from `finish`/`close`/`error` racing]** → Mitigated by D2's single `settled`
  flag; verified by an integration test asserting exactly one terminal observation per completed
  request, including a deliberately-aborted-mid-stream case.
- **[Listener leak across many requests]** → Mitigated by `once()` self-removal; verified by a test
  asserting `res.listenerCount(...)` returns to baseline after a batch of requests.
- **[A future `app.use()` call is inserted before the listener attachment]** → Not applicable: D1
  attaches directly to `app.getHttpServer()`, independent of `app.use()` ordering entirely. The
  remaining risk is someone moving the attachment call itself later in `bootstrap()` — mitigated by
  a comment analogous to `otel-sdk.ts`'s existing "must run first" comment, plus a boot-order
  assertion task in tasks.md.
- **[`transport_kind`'s streaming-route list goes stale as new streaming routes are added]** →
  Documented as a follow-up cost: any new SSE/long-lived route must be added to this fixed list or
  it silently reports as `ordinary` (still correct, still bounded, just imprecisely bucketed) —
  called out as a maintenance task, not a correctness bug.
- **[Static/frontend asset traffic inflates arrival RPS on a dashboard meant for "BFF Overview /
  HTTP"]** → Accepted trade-off: excluding it would require guessing which paths are "API" beyond
  what `API_PREFIX` already encodes, and Requirement 1 explicitly asks the scope decision to be
  stated, not hidden. The dashboard's route-scoped panels (busiest/slowest/error routes,
  percentiles) already filter to matched routes in practice since static assets land in the bounded
  `unmatched` bucket, so the impact is limited to the top-level arrival-RPS panel, which is
  documented as "all traffic reaching this server," not "API traffic."
- **[Ingress/platform-availability panels shipped as text placeholders read as an unfinished
  dashboard]** → Accepted and intentional per D8/Requirement 6 — the alternative (fabricated
  metric names) is strictly worse.
- **[Exemplar unavailability disappoints an expectation of one-click trace navigation]** →
  Mitigated by labeling the data link as "search," documented in both the dashboard panel
  description and `apps/chat-api/README.md`.

## Migration Plan

No data migration: both new instruments and the dashboard are additive. Deployment steps (detailed
per-file tasks live in tasks.md):

1. Add the three instruments and the `'request'`-listener attachment, gated the same way runtime
   gauges already are — only registered when at least one metrics exporter is enabled
   (`config.metricsExporters.length > 0`, mirroring `otel-sdk.ts:121-124`'s existing pattern) — so a
   deployment with telemetry disabled sees zero behavior change.
2. Ship the real-bootstrap integration test matrix (Requirement 8) before/alongside the
   instrumentation, so a regression in HTTP behavior (status codes, bodies, headers) is caught by
   the same commit.
3. Regenerate the local dashboards (`generate_dashboards.py`) and manually scrape `/metrics` in a
   local run to confirm the new series' names/labels/bucket boundaries match design.
4. Roll out as a normal deployment — no feature flag beyond the existing `OTEL_METRICS_EXPORTER`
   toggle, since the instrumentation is observation-only and cannot change request outcomes.

**Rollback:** revert the commit, or set `OTEL_METRICS_EXPORTER=none` (or unset — defaults still
enable `prometheus`, so an explicit `none` is required to fully disable) to stop emission without a
code change. No stored data to roll back — Prometheus/OTLP metrics are ephemeral time series;
losing a short window of the new series has no correctness impact on anything else.

## Open Questions

1. **Progressive/canary rollout mechanism** — no canary or progressive-delivery tooling was found
   in this repository. Default assumed: ship behind the existing `OTEL_METRICS_EXPORTER` toggle and
   rely on the deploying environment's normal rolling-update strategy; flagged here rather than
   invented, since this repo has no visibility into the actual deployment platform.
2. **Actual trace/log backend identity** — nothing in this repo names Tempo or Loki specifically;
   only a generic OTLP endpoint is configured. Default assumed: parameterize both as Grafana
   template variables (D9) rather than hardcoding either name, so an operator on any OTLP-compatible
   backend can bind them.
3. **Synchronous `UpDownCounter` vs an observable/async gauge for `requests.active`** — a
   synchronous `UpDownCounter`, incremented/decremented inline at entry/settle, is the default
   chosen design (D4) for immediate consistency with no callback-timing skew. Flagged only in case
   implementation surfaces an OTel JS SDK limitation with high-frequency synchronous UpDownCounter
   recording under this app's load; no such limitation is known today.
4. **Whether this environment's real Prometheus deployment already applies `job`/`pod`
   deduplication conventions beyond what `generate_dashboards.py` already encodes** — none found
   beyond the existing script's own variables; default is to reuse that pattern unchanged (D7).
