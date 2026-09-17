## Why

The BFF (`apps/chat-api`) currently measures HTTP traffic at one point only: `MetricsInterceptor`
(`apps/chat-api/src/common/interceptors/metrics.interceptor.ts`), which is a Nest interceptor. An
interceptor runs **after** Nest's routing, guards, and pipes have already accepted the request —
`app.module.ts:73-74` registers it as a global `APP_INTERCEPTOR`, which Nest places after guards
in the request pipeline. As a direct result, the existing `http.server.request.duration` histogram
(`apps/chat-api/src/telemetry/http-metrics.ts:14-21`) never observes:

- Auth/session rejections (`apps/chat-api/src/auth/session/session.guard.ts`), CSRF rejections
  (`apps/chat-api/src/auth/csrf/csrf.guard.ts`), or feature-flag rejections
  (`apps/chat-api/src/app-config/feature-flags/feature.guard.ts`) — guards run before the
  interceptor and can short-circuit the request before it is ever recorded.
- Rate-limiting rejections from `@nestjs/throttler` (also guard-based, same ordering problem).
- Body-parser failures — `main.ts:104-108` installs the JSON body limit via
  `app.useBodyParser('json', { limit: ... })`, ahead of the interceptor.
- Unmatched routes that never reach a controller (404s with no matched Nest route) — the
  interceptor only wraps handlers Nest actually invokes.
- Premature transport termination — the interceptor's `tap()` (metrics.interceptor.ts:38-58)
  observes `next.handle()`'s `next`/`error` notifications, not the raw `IncomingMessage`/
  `ServerResponse` socket lifecycle, so a client abort before the observable emits is invisible.

`http.server.request.duration` also uses `Date.now() - startTime` (metrics.interceptor.ts:34,41,60)
— a wall-clock, not monotonic, duration source — and is recorded once per *handler settlement*,
not once per *request arrival*, so there is no way to see requests that are currently in flight,
or to separate "the BFF received N requests/sec" from "the BFF's Nest handlers finished N
requests/sec". The two numbers already diverge for the app's own streaming routes: verified against
`apps/chat-api/src/conversations/conversation.controller.ts`, `POST /api/v1/conversations/completions`
(line 229, `@HttpCode(200)`) streams an SSE response — persisted, backend-owned, independent of the
browser connection (`res.on('close', ...)` only marks the response "detached"; it does not stop the
generation, lines 301-343) — while `POST /api/v1/conversations/watch` (line 470) and
`POST /api/v1/conversations/completions/attach` (line 377) are SSE routes with their own
handler-vs-transport lifetime split. **Correction to the locally-drafted research notes in
`bff-observability-local/bff-observability-plan.md`, which this proposal treats as unverified input,
not ground truth**: those notes assume a route literally named `/chat/completions` that is
"synchronous, not SSE" — no such route exists. The only completions route,
`/api/v1/conversations/completions`, *is* SSE-streamed, and the notes' own generated PromQL exclusion
regex (`bff-observability-local/generate_dashboards.py`, `REST` variable) filters a route pattern
(`.*/chat/completions`) that never matches any real route in this app — that filter is dead code
against the real route set and must not be reused as-is.

Finally, the installed `@opentelemetry/exporter-prometheus@0.221.0`'s `PrometheusSerializer`
(`node_modules/@opentelemetry/exporter-prometheus/build/src/PrometheusSerializer.js`) contains no
`exemplar` handling at all — verified by inspecting the built serializer source, which has zero
occurrences of the word "exemplar" even though `@opentelemetry/sdk-metrics@2.10.0` ships an
`exemplar/` subsystem (reservoirs, filters) that this exporter never calls into. Grafana
"exact-request" metric-to-trace links (Prometheus exemplars) are therefore not available with the
currently pinned exporter version, contradicting an implicit assumption in the local plan's framing
of "navigation to relevant traces."

Today, none of this can be fixed by looking at a dashboard alone, because the dashboard can only
ever be as truthful as the underlying instrumentation — and the underlying instrumentation
currently answers "how fast did Nest handlers that got that far finish", not "what is happening to
HTTP traffic reaching this BFF." This proposal closes that gap for the P0 "BFF Overview / HTTP"
item only.

## What Changes

- Add three new OpenTelemetry HTTP instruments, recorded at a point that precedes body parsing,
  guards, and routing (exact mechanism compared and chosen in design.md), so they observe the
  complete HTTP transport lifecycle rather than only Nest handler settlement:
  - `dial.chat.http.requests.started` (counter) — one increment per request entering the
    monitored scope.
  - `dial.chat.http.requests.active` (up/down counter or async gauge) — in-flight request count.
  - `dial.chat.http.response.duration` (histogram, seconds, monotonic clock) — terminal duration,
    recorded exactly once per request, with subsecond-appropriate bucket boundaries (the existing
    `http.server.request.duration` histogram's default boundaries start at 0/5/10s, which is
    unusable for ordinary sub-second BFF latency).
- Keep `http.server.request.duration` (`MetricsInterceptor`) unchanged in name, meaning, and
  recording point. It continues to answer "how long did the matched Nest handler take", a
  different and still-useful question; the new instruments answer "what happened to the raw HTTP
  request." Both coexist — this is a compatibility requirement, not a redefinition.
- **BREAKING** (spec-level only, not runtime): loosens the existing `observability-telemetry`
  requirement "No duplicate HTTP metric sources", which today reads as "`MetricsInterceptor`'s
  histogram is the only emitter of HTTP server request duration data points for the application."
  That statement becomes false the moment a second, differently-scoped instrument family exists.
  The delta spec narrows the requirement to what it actually protects — no second instrument
  double-counting or renaming the *existing* histogram — rather than removing the requirement.
- Add explicit outcome/exclusion semantics to the new instruments: bounded route/method fallbacks
  (`unmatched`/`unknown`) for the arrival/in-flight instruments (route isn't known yet at true
  arrival), the real normalized route only at the terminal observation, an explicit representation
  for "connection closed before headers were sent" that is neither a fabricated `200` nor `499`,
  and no raw URLs/query strings/identifiers as attribute values anywhere.
- Plan (design + task list only, not implemented in this change) an importable "BFF Overview / HTTP"
  Grafana dashboard covering arrival RPS, completed-response rate and status distribution, 4xx/5xx
  fractions with documented denominators, in-flight requests, latency percentiles for ordinary
  requests computed via `histogram_quantile(... sum by (le) ...)` (never per-pod percentile
  averaging), busiest/slowest/error routes, and separate generation/subscription duration panels —
  while preserving the existing `01-bff-http-handlers.json` as a historical diagnostic dashboard.
- Plan (design + task list only) how the dashboard represents platform/ingress availability signals
  that this application's own Prometheus instance cannot itself observe (no k8s/Helm/ingress
  manifests were found anywhere in this repository — verified by search, see Impact) — those panels
  are explicitly marked "requires external verification / not yet available" and are an accepted gap
  in this change's definition of done, not a delivered capability.
- Plan (design + task list only) a route/service/time-scoped trace-search Grafana data link (Tempo/
  Loki filtered by `service.name` + `http.route` + time range), given the exemplar-support finding
  above rules out an exact-request metric-to-trace link with the currently pinned exporter version.
- Add integration tests that boot the real Nest app (`@nestjs/testing` + `supertest`, the actual
  `main.ts` bootstrap ordering) instead of relying on unit tests with mocked pipeline stages, to
  prove: exactly one arrival and one terminal observation per completed request; net-zero in-flight
  after each request; bounded attribute values; unchanged HTTP/business behavior (status codes,
  bodies, headers) after instrumentation is added.

## Capabilities

### New Capabilities

- `bff-http-lifecycle-metrics`: the three new instruments — their exact instrumentation point,
  recording boundaries, attribute contracts, exclusion rules, and the completed-vs-transport-failure
  distinction — covering Requirements 1-4 of the P0 item.
- `bff-overview-dashboard`: the importable Grafana "BFF Overview / HTTP" dashboard's panel
  contracts, template variables, zero-traffic/no-data handling, the trace-search data link design,
  and the explicit "requires external verification" markers for ingress/platform-availability
  panels — covering Requirements 5-7 of the P0 item.

### Modified Capabilities

- `observability-telemetry`: narrows the existing "No duplicate HTTP metric sources" requirement
  so that a second, differently-named, differently-scoped HTTP instrument family (this change's
  `dial.chat.http.*` instruments) is explicitly permitted alongside the existing
  `http.server.request.duration` histogram, while still prohibiting a second emitter of the *same*
  histogram or double-recording within either family.

## Impact

- **Code**: `apps/chat-api/src/main.ts` (new instrumentation registered ahead of body parsers/
  guards/routing — exact mechanism decided in design.md), `apps/chat-api/src/telemetry/` (new
  metric-instrument module, likely alongside `http-metrics.ts`), a new interceptor/middleware file
  under `apps/chat-api/src/common/`, and co-located `*.spec.ts` integration tests. No changes to
  request parsing, authentication, CORS, exception handling, response bodies, or routing.
- **Docs**: `apps/chat-api/README.md` (Observability section), `docs/architecture.md` (if the
  bootstrap-ordering summary there needs the new instrumentation point noted), and this repo's
  `openspec/specs/observability-telemetry/spec.md` after archive.
- **Local, git-ignored artifacts** (not tracked deliverables, tracked only as tasks):
  `bff-observability-local/bff-observability-plan.md`, `generate_dashboards.py`, and
  `dashboards/01-bff-http-handlers.json` (preserved, not replaced) plus a new
  `dashboards/00-bff-overview-http.json`. Confirmed via `git status --ignored` and
  `.git/info/exclude` (`/bff-observability-local/`) that this folder is excluded there, not via
  `.gitignore` — `.gitignore` is not touched by this change, and the folder is never force-added.
- **Infrastructure**: none found in-repo (no k8s manifests, Helm charts, `ServiceMonitor`/
  `PodMonitor` CRDs, or ingress config anywhere in this repository — verified by
  `find`/`grep` across the working tree). Requirement 6's ingress/platform-availability piece is
  therefore design-only in this change, gated on external verification.
- **Definition of done for the P0 item**: (a) the three new instruments exist, are recorded exactly
  once per request lifecycle with net-zero in-flight cleanup, and pass the real-bootstrap
  integration test matrix; (b) `http.server.request.duration` is unchanged and both instrument
  families coexist without double-counting; (c) the importable dashboard JSON is valid and every
  panel backed by an application-owned metric renders correctly against a real scrape; (d) the
  ingress/platform-availability panels are explicitly marked "requires external verification" in
  the dashboard and in `apps/chat-api/README.md`. **The P0 item cannot be marked fully complete
  while (d) remains unverified against a real cluster** — this change delivers (a)-(c) and the
  design/prerequisites for (d), not (d) itself.
