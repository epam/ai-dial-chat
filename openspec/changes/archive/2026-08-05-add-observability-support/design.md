## Context

`apps/chat-api` (NestJS 11, bundled by webpack, run as `node apps/chat-api/dist/main.js` per the
root `Dockerfile`) has no distributed tracing, no exported logs, and no real metrics.
`MetricsInterceptor` (`apps/chat-api/src/common/interceptors/metrics.interceptor.ts`) only logs a
line per request and carries two TODOs for "real" monitoring. `HealthController` exists and is
already unversioned per `apps/chat-api/AGENTS.md` §2. Other DIAL services set a precedent:

- `ai-dial-admin-backend` defaults `OTEL_SDK_DISABLED=true` and, when enabled, defaults
  `OTEL_TRACES_EXPORTER` / `OTEL_METRICS_EXPORTER` / `OTEL_LOGS_EXPORTER` to `otlp`, requires
  `OTEL_EXPORTER_OTLP_ENDPOINT`/`OTEL_EXPORTER_OTLP_PROTOCOL` only when enabled, and attaches its
  own application logger to OpenTelemetry rather than piping SDK-internal diagnostics back in.
  It also returns a `traceparent` header on every response and embeds it in error bodies.
- `ai-dial-core`'s Dockerfile hard-disables all three signals by default
  (`OTEL_*_EXPORTER=none`), confirming DIAL services treat "off by default, explicit opt-in" as
  the safe default.

The previous Next.js-based Chat implementation (a different, now-superseded codebase, not part of
this repository) used a `NodeSDK` bootstrap with OTLP HTTP exporters for traces/logs, a
metrics-reader chosen by `OTEL_METRICS_EXPORTER` (default: a Prometheus exporter on `:9464/metrics`;
`otlp` selects a periodic OTLP reader instead), and HTTP/fetch/Undici/Pino instrumentation. That
implementation is evidence of a working pattern, not a template to copy: it ran on Pino (this app
uses NestJS `Logger`), always started a Prometheus listener regardless of any opt-in flag, and used
`SimpleSpanProcessor` (synchronous-ish, not ideal for production load).

`apps/chat-api/webpack.config.js` bundles with `optimization: false` (no tree-shaking/module
concatenation reordering) and the Nx webpack app plugin treats `node_modules` as externals for this
`target: 'node'` build — confirmed by the root `Dockerfile`'s `nx run chat-api:prune` step, which
generates a pruned `package.json`/lockfile and runs `npm ci --omit=dev` against real `node_modules`
in the runner stage. So OpenTelemetry packages are never inlined into the bundle; only their
*import order inside `main.ts`* determines whether `http`/`undici` get patched before Nest, Express,
and DIAL Core clients first touch them.

## Goals / Non-Goals

**Goals:**

- OpenTelemetry traces, logs, and metrics for `apps/chat-api`, off by default, safely and fully
  enabled via standard `OTEL_*` environment variables.
- A Prometheus-compatible scrape endpoint.
- Zero behavior change and zero new listening ports for deployments that set no `OTEL_*` vars.
- Real request-count/duration metrics replacing the two TODOs in `MetricsInterceptor`.
- Every NestJS `Logger` call (debug/log/warn/error/verbose/fatal) exported through OpenTelemetry
  Logs when enabled, correlated to the active trace/span, without duplicating console output or
  looping SDK diagnostics back into the same logger.

**Non-Goals:**

- Browser-side/frontend OpenTelemetry instrumentation (`apps/chat`).
- Product analytics, business dashboards, alerts, or SLOs.
- Capturing prompts, responses, file contents, tokens, cookies, or other user payloads in spans,
  logs, or metric attributes.
- Migrating the backend to Pino.
- Editing `C:\dial_projects\ai-dial-chat-ng\values.yaml` (deployment follow-up only, see Migration
  Plan).
- Referencing or reusing code from the old, now-superseded Next.js Chat implementation as anything
  other than background evidence already summarized above.

## Decisions

### 1. SDK lifecycle and resource identity

- **New module `apps/chat-api/src/telemetry/`** (cross-cutting concern, alongside
  `common/`, not a `{domain}/` folder — it has no controller):
  - `otel-config.ts` — pure, dependency-free functions that parse `OTEL_*` values from a
    `NodeJS.ProcessEnv`-shaped object into typed exporter-selection results (comma-separated lists,
    `none` handling, defaults). Pure functions so exporter-selection logic is unit-testable without
    touching the network or the real SDK.
  - `otel-sdk.ts` — builds and owns the singleton `NodeSDK` instance from `@opentelemetry/sdk-node`
    using `otel-config.ts`'s parsed selection; exports `initializeOpenTelemetry()` and
    `shutdownOpenTelemetry(timeoutMs?)`.
  - `nestjs-otel-logger.ts` — the `Logger` bridge (see §3).
  - `telemetry-shutdown.service.ts` — `@Injectable() TelemetryShutdownService implements
    OnApplicationShutdown`, calls `shutdownOpenTelemetry()`; registered as a provider in
    `AppModule` so Nest's own shutdown-hook lifecycle (not a hand-rolled `SIGTERM` listener) drives
    it.
  - `traceparent.middleware.ts` — response header (see §2).
  - `http-metrics.ts` — the shared `Meter`/histogram instrument used by `MetricsInterceptor` (see
    §4).
  - `tests/` — mirrors each file above.
- **Import order**: `apps/chat-api/src/main.ts`'s first import becomes
  `import './telemetry/otel-sdk';` (a bare side-effect import, before `reflect-metadata`,
  `@nestjs/common`, `cookie-parser`, `helmet`, and `./app/app.module`). `otel-sdk.ts` calls
  `initializeOpenTelemetry()` at module scope, mirroring how the evidence codebase called
  `sdk.start()` at module scope. Because dependencies are externals (not webpack-inlined) and
  `optimization: false` prevents import reordering, this guarantees `HttpInstrumentation` and
  `UndiciInstrumentation` patch Node's `http`/`https`/`undici` modules before any later import
  (Express, the DIAL SDK's HTTP client, etc.) triggers `require('http')` for the first time — the
  same ordering guarantee Node gives any CommonJS program, unaffected by webpack bundling once
  dependencies stay external. **Risk called out below** if `optimization` is ever flipped on.
- **Resource identity**: `service.name` resolves as `process.env.OTEL_SERVICE_NAME ||
  pkg.name || 'chat-api'`; `service.version` resolves from `pkg.version`. These are passed as an
  explicit `resource: resourceFromAttributes({...})` to `NodeSDK`. `NodeSDK`'s own resource
  detection also reads `OTEL_RESOURCE_ATTRIBUTES` and merges it with our explicit resource;
  **for keys we set ourselves (`service.name`, `service.version`), our value wins over
  `OTEL_RESOURCE_ATTRIBUTES`** (mitigated for `service.name` by checking `OTEL_SERVICE_NAME`
  first; `service.version` always comes from `package.json` and cannot be overridden via
  `OTEL_RESOURCE_ATTRIBUTES` — documented as an explicit, intentional limitation). Any *other*
  key in `OTEL_RESOURCE_ATTRIBUTES` (e.g. `deployment.environment`) passes through untouched.
- **`OTEL_SDK_DISABLED`**: default `true` (matches `ai-dial-admin-backend`, deliberately
  stricter than the evidence codebase which always opened a Prometheus listener). When `true`,
  `initializeOpenTelemetry()` returns immediately without constructing exporters, readers, span
  processors, or the Prometheus HTTP listener — no new ports, no outbound calls, byte-identical
  behavior to today.
- **Per-signal exporter selection incl. `none`**: `OTEL_TRACES_EXPORTER` / `OTEL_LOGS_EXPORTER`
  default `otlp` (spec default) when the SDK is enabled; each also accepts `none` (produces a
  no-op processor for that signal only — the other two signals stay active). `OTEL_METRICS_EXPORTER`
  accepts a **comma-separated list** (`otlp`, `prometheus`, `none`; e.g. `"otlp,prometheus"`
  enables both simultaneously by registering multiple `MetricReader`s on the same `NodeSDK` —
  metrics are recorded once via the Metrics API and fanned out to every registered reader, so
  supporting both is "free": no double-instrumentation code, just multiple export sinks). Default
  when enabled and unset: `prometheus` only (see §5 rationale — this is the one deliberate,
  documented deviation from the OTel spec's `otlp` default, and only applies once
  `OTEL_SDK_DISABLED=false`).
- **Graceful shutdown**: `main.ts` calls `app.enableShutdownHooks()` (not currently called).
  `TelemetryShutdownService.onApplicationShutdown()` calls `shutdownOpenTelemetry()`, which races
  `sdk.shutdown()` against a bounded internal timeout (default 5s) using `Promise.race`, so a hung
  exporter/collector cannot block container termination past the Kubernetes grace period.
- **Exporter/collector unavailable**: OTLP HTTP exporters use the SDK's built-in async batching
  with retry/backoff and never throw synchronously into request-handling code; a misconfigured or
  unreachable collector produces exporter-level warnings in logs, not request failures or process
  crashes. This is the existing behavior of `@opentelemetry/exporter-*-otlp-http`, not new code we
  write — documented here as the explicit answer to "what happens when the collector is down."

### 2. OpenTelemetry traces

- `HttpInstrumentation` (patches Node core `http`/`https`, producing inbound server spans and
  outbound client spans for any library built on them) **and** `UndiciInstrumentation` (patches
  Node's built-in `fetch`/undici, used by `@epam/ai-dial-typescript-sdk` and the app's own raw
  `fetch` calls, e.g. `ThemeService`) are both registered — matching the evidence codebase's
  choice of covering both HTTP stacks. **`@opentelemetry/instrumentation-fetch` is deliberately
  excluded**: it instruments `window.fetch` in a browser realm and is a no-op under Node; the
  evidence codebase's inclusion of it is a case of "don't copy blindly."
- `ignoreIncomingRequestHook: (req) => req.url === '/api/health' || req.url === '/metrics'`
  excludes health checks and Prometheus scrapes from span creation. `/metrics` is safe to match
  unconditionally because Nest's own routes are either versioned (`/api/v{N}/...`) or under
  `/api/...`; a bare `/metrics` path only ever exists on the Prometheus exporter's own internal
  `http.createServer()` (see §5) — which is also patched by the same global `HttpInstrumentation`
  and would otherwise generate a self-referential span per scrape.
- Outbound propagation is automatic once `HttpInstrumentation`/`UndiciInstrumentation` are
  registered: the active inbound server span's context is picked up by Node's `AsyncLocalStorage`-based
  context manager, and both instrumentations inject the resulting W3C `traceparent` header into
  outbound requests without any call-site changes in `AppService`/`ThemeService`/etc.
- **Span processor**: `BatchSpanProcessor` (not the evidence codebase's `SimpleSpanProcessor`) —
  batches and exports spans off the request path, reducing collector load under real traffic. This
  is a deliberate improvement, not a compatibility requirement.
- **`traceparent` response header — accepted**, matching `ai-dial-admin-backend`. Implemented as
  a single `app.use(...)` Express middleware registered in `main.ts` immediately after
  `cookieParser()` (before routing), so it runs inside the same active span context Node's `http`
  instrumentation already establishes for the request, and applies uniformly to success and error
  responses (Nest's exception filters write to the same underlying `res`, so a header set this
  early survives). The middleware sets `res.setHeader('traceparent', value)` only when a value is
  available (i.e., skipped for `/api/health` and `/metrics`, which have no active span by design).
  `main.ts`'s `app.enableCors({...})` gains `'traceparent'` in `exposedHeaders` alongside the
  existing `X-CSRF-Token` / `X-DIAL-CLIENT-CHANNEL-ID` entries so `apps/chat` can read it from
  browser `fetch` responses for error-report correlation.
- **OTLP protocol**: fixed to `http/protobuf` via the `*-otlp-http` exporter packages (same choice
  as the evidence codebase). `OTEL_EXPORTER_OTLP_PROTOCOL` / `OTEL_EXPORTER_OTLP_TRACES_PROTOCOL`
  are **not read** — this app does not dynamically switch exporter transport. Documented explicitly
  so the README never implies unsupported protocol switching.

### 3. OpenTelemetry logs

**Alternatives considered:**

1. **Custom Nest `LoggerService` bridge (`ConsoleLogger` subclass) that also emits via the
   OpenTelemetry Logs API — chosen.** Zero migration of existing `logger.debug/log/warn/error()`
   call sites (NestJS `Logger`/`ConsoleLogger` stays the app-wide logger); console output and
   `LOG_LEVEL` gating (`resolveLogLevels()`) are unchanged because the bridge subclasses
   `ConsoleLogger` and calls `super.*()` for the console side; the OTel side is additive.
2. **Migrate the backend to Pino + `pino-opentelemetry-transport`.** Rejected: this repurposes the
   pattern from the old, now-superseded Chat implementation, but `apps/chat-api/AGENTS.md` §10 and
   §12 mandate NestJS `Logger` — migrating away from it is broad logging churn across every
   service/controller for no functional gain over option 1.
3. **An established OpenTelemetry Nest-logger-compatible instrumentation/appender package.**
   Rejected for now: no first-party `@opentelemetry/instrumentation-nestjs-*` package targets the
   `Logger`/`ConsoleLogger` surface specifically (the one first-party Nest package,
   `@opentelemetry/instrumentation-nestjs-core`, instruments guards/interceptors/pipes for extra
   span detail — it does not touch logging — and is out of scope here). Third-party community
   packages exist but are not part of the DIAL-approved dependency set and would need separate
   vetting; revisit only if option 1 proves insufficient.

**Chosen design**: `NestOtelLogger extends ConsoleLogger`, constructed with the same
`resolveLogLevels(...)` array already computed in `main.ts` (so gating behavior is byte-identical
to today), passed to `NestFactory.create(AppModule, { logger: new NestOtelLogger(...) })`. On every
`log/error/warn/debug/verbose/fatal` call, after the inherited `ConsoleLogger` behavior runs, the
bridge additionally calls `logs.getLogger('chat-api', pkg.version).emit({...})` from
`@opentelemetry/api-logs`, with:
- `severityNumber` / `severityText` mapped via `SeverityNumber`: `verbose→TRACE(1)`,
  `debug→DEBUG(5)`, `log→INFO(9)`, `warn→WARN(13)`, `error→ERROR(17)`, `fatal→FATAL(21)`.
- `context: context.active()` — lets the Logs SDK derive `trace_id`/`span_id` from whatever span
  is active at emit time, giving automatic trace correlation with no manual ID plumbing.
- `attributes['logger.name']` — the Nest logger `context` string (e.g. `ThemeService`), preserving
  today's per-class log context as a structured field instead of only a formatted string prefix.
- For `error` calls with a stack argument: `attributes['exception.type']`,
  `['exception.message']`, `['exception.stacktrace']` (OpenTelemetry exception semantic
  conventions), instead of collapsing the stack into the log body string.
- **No duplication / no feedback loop**: this is the *only* code path that calls
  `logs.getLogger().emit()` — the OTel SDK's own internal diagnostics (`diag`) are never wired to
  `NestOtelLogger` (we never call `diag.setLogger(new NestOtelLogger(...))`); `diag` stays on its
  default no-op unless a developer temporarily enables `DiagConsoleLogger` for local debugging.
- **No branching needed for disabled/`none` state**: `@opentelemetry/api-logs`'s global logger
  provider defaults to a no-op implementation until `otel-sdk.ts` calls
  `logs.setGlobalLoggerProvider(...)` (only when `OTEL_SDK_DISABLED=false` and
  `OTEL_LOGS_EXPORTER` ≠ `none`). `NestOtelLogger` can therefore call `.emit()` unconditionally;
  it becomes a zero-cost no-op automatically when telemetry is off, exactly like the metrics path
  in §4.
- **Sensitive data**: the bridge only forwards the message string and stack fields NestJS already
  received; it must not inspect or serialize arbitrary object arguments some call sites might pass.
  Call sites remain responsible for not logging secrets (already required by
  `apps/chat-api/AGENTS.md` §6/§9); this change does not add any new sensitive-data surface, but
  the bridge's log record body/attributes are covered by the tasks' review pass to confirm no
  request bodies, tokens, cookies, or headers are captured.

### 4. OpenTelemetry metrics

- `apps/chat-api/src/telemetry/http-metrics.ts` exports a shared `Meter` (`metrics.getMeter('dial-chat-api', pkg.version)` from `@opentelemetry/api`) and **one** instrument:
  `http.server.request.duration` — a `Histogram<{unit: 's'}>` per the current stable OpenTelemetry
  HTTP server semantic conventions, recorded with attributes `http.request.method` (bounded: GET,
  POST, PUT, PATCH, DELETE, ...), `http.route` (the matched Express/Nest route template, e.g.
  `/api/v1/themes/:id` — never the raw URL), and `http.response.status_code` (bounded: ~60 known
  HTTP status codes).
- **Request count is not a separate instrument.** A histogram's implicit `count` (available via
  any backend's `count_over_time`/`histogram_count` aggregation) already answers "how many
  requests" per the same attribute set; adding a second `Counter` with identical attributes would
  double the cardinality of maintained instruments for no new information and risks the two
  instruments drifting out of sync. This single histogram satisfies "record request count and
  request duration" from the proposal.
- **No separate `status_class` attribute.** `http.response.status_code` is already low-cardinality
  and status class (2xx/4xx/5xx) is a trivial range query over it in any dashboard/alerting
  backend; adding a redundant derived attribute is unnecessary label cardinality for no query
  benefit.
- **Errors recorded exactly once**: `MetricsInterceptor`'s `tap({next, error})` already has exactly
  one terminal branch per request (RxJS `tap` guarantees `next` XOR `error` fires, never both) —
  the histogram `.record()` call happens once per branch, using the real thrown status
  (`getErrorDetails(error).statusCode`) in the error branch and the response's actual
  `statusCode` in the success branch. No change to that control-flow shape is needed, only
  replacing the TODO comments with the `.record()` calls.
- **Route template, not raw URL**: `context.switchToHttp().getRequest()` exposes Express's matched
  `request.route?.path` once routing has resolved (available inside `MetricsInterceptor`, which
  runs after route matching per Nest's execution order). For requests that never match a route
  (404s before routing resolves, malformed paths), attribute value falls back to the bounded
  literal `"unmatched"` — never the raw incoming path — so cardinality stays bounded regardless of
  what a client sends.
- **No double-counting against automatic HTTP instrumentation**: `HttpInstrumentation` in this
  design is configured for **tracing only** (see §2); this app does not enable
  `@opentelemetry/instrumentation-http`'s optional experimental HTTP server metrics feature, so the
  interceptor's histogram is the *only* source of `http.server.request.duration` data — no
  reconciliation needed between two producers of the same metric.
- **Custom metrics namespace**: not needed for the minimum bar in this change (one standard-semconv
  histogram covers count+duration+method+route+status). If a future change needs a DIAL
  Chat-specific metric, it must use a `dial_chat.*` namespace and be documented with name, type,
  unit, description, and attributes per the proposal's requirement — noted here for future authors,
  not implemented now.
- **Health check excluded from the histogram too, not just from tracing** (added after review):
  `§2`'s `ignoreIncomingRequestHook` only ever excluded `/api/health`/`/metrics` from *span*
  creation — `MetricsInterceptor` is a separate mechanism with no knowledge of that hook, so it
  kept recording a data point for every health-check probe. Since `/metrics` never reaches
  `MetricsInterceptor` at all (served entirely by the Prometheus exporter's own standalone
  `http.createServer()`, outside Nest/Express — see §5), only `/api/health` was actually affected
  in practice, but both paths are excluded via one shared predicate,
  `telemetry/excluded-paths.ts`'s `isExcludedFromTelemetry(path)`, consumed by both
  `otel-sdk.ts`'s hook (against the raw request URL, pre-routing) and `MetricsInterceptor`
  (against the resolved route template, post-routing) — a single source of truth instead of two
  independently inlined checks that could silently drift apart. The health check is still logged
  as before; only the histogram `.record()` call is skipped.

### 5. Prometheus endpoint

**Alternatives considered:**

1. **Dedicated exporter listener on `:9464/metrics` (legacy-compatible) — chosen.**
   `@opentelemetry/exporter-prometheus`'s `PrometheusExporter` class is both a `MetricReader` (fed
   into `NodeSDK`'s `metricReaders`) *and* its own plain `http.createServer()` bound to a
   configurable host/port, entirely independent of Nest/Express. No Nest controller, no new
   business-port route, no interaction with `helmet`/CORS/versioning/throttling — the "no UI,
   business API impact" claim in the proposal stays literally true. Keeps scrape traffic off the
   application port, matching Kubernetes network-policy patterns already used for other DIAL
   services' metrics ports.
2. **Unversioned Nest endpoint `/api/metrics` on the application port.** Rejected as the default:
   would require a `MetricsController` returning the Prometheus SDK's own text serialization,
   competing with `helmet`'s CSP/security headers and the global `ThrottlerGuard` for a
   high-frequency scrape path, and mixing infra traffic with the business port's TLS/ingress
   config. Left undocumented as a future option; not built in this change.
3. **Both, or configurable selection.** Rejected for the initial change: doubles the surface to
   test and document for no requirement driving it. Revisit only if a deployment environment
   cannot open a second container port (tracked as an open question below).
- **Content type**: `text/plain` — verified against the installed
  `@opentelemetry/exporter-prometheus@0.221.0` source (`PrometheusExporter.js`'s
  `_exportMetrics`, which sets this header unconditionally). Older versions of this package
  emitted the fuller Prometheus exposition format string `text/plain; version=0.0.4;
  charset=utf-8`; the currently pinned version does not — the response body itself is still the
  same Prometheus text exposition format.
- **Host/port config**: the JS `PrometheusExporter` class does **not** itself read
  `OTEL_EXPORTER_PROMETHEUS_HOST`/`OTEL_EXPORTER_PROMETHEUS_PORT` from the environment (unlike the
  OTLP HTTP exporters, which do read `OTEL_EXPORTER_OTLP_*` automatically) — `otel-sdk.ts` reads
  these two vars itself and passes them as explicit `{host, port}` constructor options. Documented
  here so the README never claims automatic env support the package doesn't provide. Defaults:
  host `0.0.0.0` (so a Kubernetes scraper reaching the pod IP works out of the box), port `9464`
  (legacy-compatible, matches the Prometheus default port convention).
- **Authentication**: none — matching the evidence codebase and standard Prometheus scrape
  conventions (network-policy-gated, not app-authenticated). Documented explicitly as a decision,
  not an oversight.
- **Simultaneous Prometheus + OTLP metrics**: supported (see §1) via multiple `MetricReader`s on
  one `NodeSDK`; `OTEL_METRICS_EXPORTER=otlp,prometheus` is the documented way to run both.
- **Deployment follow-up (not part of this change)**: `C:\dial_projects\ai-dial-chat-ng\values.yaml`
  needs a container port (`9464`) exposed on the pod, a matching `Service` port, and (if the
  cluster uses the Prometheus Operator) a `ServiceMonitor`/scrape annotation — called out in
  Migration Plan, not edited here.

### 6. Configuration and compatibility — full variable table

| Variable | Consumed by | Default | Notes |
|---|---|---|---|
| `OTEL_SDK_DISABLED` | our bootstrap (`otel-config.ts`) | `true` | Deliberately stricter than the evidence codebase; matches `ai-dial-admin-backend`. |
| `OTEL_SERVICE_NAME` | our bootstrap, checked before `pkg.name` | unset → `pkg.name` → `'chat-api'` | See §1 resource precedence. |
| `OTEL_RESOURCE_ATTRIBUTES` | `NodeSDK`'s built-in env resource detector | unset | Merged under our explicit `service.name`/`service.version` — see §1 limitation. |
| `OTEL_TRACES_EXPORTER` | our bootstrap | `otlp` (when enabled) | Accepts `otlp` \| `none`. |
| `OTEL_METRICS_EXPORTER` | our bootstrap | `prometheus` (when enabled) | Accepts a comma-separated subset of `otlp`, `prometheus`, `none`. Deliberate deviation from the OTel spec's `otlp` default — see §5. |
| `OTEL_LOGS_EXPORTER` | our bootstrap | `otlp` (when enabled) | Accepts `otlp` \| `none`. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `@opentelemetry/exporter-*-otlp-http` packages natively | unset (exporter falls back to its own `http://localhost:4318` default) | We do not re-implement this parsing. |
| `OTEL_EXPORTER_OTLP_{TRACES,METRICS,LOGS}_ENDPOINT` | same exporter packages, natively | unset | Signal-specific override of the endpoint above; supported "for free" by the exporter packages. |
| `OTEL_EXPORTER_OTLP_HEADERS` | same exporter packages, natively | unset | Never read or logged by our code; may carry collector auth secrets — application logs must never include this value. |
| `OTEL_EXPORTER_OTLP_PROTOCOL` / per-signal variants | **not read** | n/a | Protocol is fixed to `http/protobuf` in code via the `*-otlp-http` packages — see §2. |
| `OTEL_EXPORTER_PROMETHEUS_HOST` | our bootstrap, passed to `PrometheusExporter` | `0.0.0.0` | Not auto-read by the exporter package itself — see §5. |
| `OTEL_EXPORTER_PROMETHEUS_PORT` | our bootstrap, passed to `PrometheusExporter` | `9464` | Same as above. |
| Batch/interval/timeout vars (`OTEL_BSP_*`, `OTEL_BLRP_*`, `OTEL_METRIC_EXPORT_INTERVAL`, `OTEL_METRIC_EXPORT_TIMEOUT`) | `BatchSpanProcessor` / `BatchLogRecordProcessor` / `PeriodicExportingMetricReader`, natively | SDK defaults | These JS SDK classes already read their respective standard env vars when constructed with no explicit override; we do not duplicate that parsing. Exact supported set must be reverified against the pinned SDK version during implementation (task item) before README claims any specific one. |
| Sampling (`OTEL_TRACES_SAMPLER`, `OTEL_TRACES_SAMPLER_ARG`) | `NodeSDK`, natively when no explicit `sampler` option is passed | SDK default (`parentbased_always_on`) | We do not override the sampler in code, so these standard vars work unmodified. |

**None of the above are added to `EnvironmentVariables` / `environment.config.ts`.** This is a
narrow, explicit exception to `apps/chat-api/AGENTS.md` §7 ("all env vars MUST be declared on
`EnvironmentVariables`"): these are standard OpenTelemetry variables consumed directly by SDK/exporter
packages, read in `telemetry/otel-config.ts` *before* Nest's `ConfigModule`/DI container exists
(`initializeOpenTelemetry()` runs at the top of `main.ts`, ahead of `NestFactory.create()`). Adding
class-validator rules for them would (a) be redundant with validation the exporter packages already
perform internally, (b) risk rejecting valid SDK-recognized values our validators don't know about,
and (c) contradict the "must not crash on misconfiguration" requirement — a malformed OTLP endpoint
should degrade to logged export warnings, not fail Nest's boot-time `validate()`. No new
**application-owned** observability environment variable is introduced by this change — every
variable above is a standard `OTEL_*` name, so this exception does not set precedent for inventing
new unvalidated app config.

**Backward compatibility / rollback**: with zero `OTEL_*` variables set, `OTEL_SDK_DISABLED`
defaults to `true`, `initializeOpenTelemetry()` is a no-op, no port 9464 opens, no OTLP HTTP calls
are attempted, `NestOtelLogger`'s `.emit()` calls hit the API's no-op logger provider, and
`MetricsInterceptor`'s histogram `.record()` calls hit a no-op meter — behavior and performance are
unchanged from today. Rollback is therefore always available by setting/restoring
`OTEL_SDK_DISABLED=true` (or simply never setting it), with no code rollback required. This also
directly answers "would the evidence codebase's default OTLP exporters generate connection errors
against localhost": yes, if instantiated unconditionally like that codebase did — which is exactly
why this design gates all exporter construction behind the disabled-by-default flag instead.

### 7. Tests and verification

- `telemetry/tests/otel-config.spec.ts` — pure unit tests over exporter-selection parsing:
  disabled flag, per-signal `none`, comma-separated metrics list (`otlp`, `prometheus`,
  `otlp,prometheus`), and default resolution — no SDK construction, no network.
- `telemetry/tests/nestjs-otel-logger.spec.ts` — constructs a `NestOtelLogger` against an in-memory
  `LoggerProvider`/exporter (or a minimal hand-written fake `LogRecordExporter` if the pinned
  `@opentelemetry/sdk-logs` version doesn't ship an in-memory one — verify at implementation time),
  asserts: level→severity mapping table, `trace_id`/`span_id` populated when emitted inside an
  active span (using `@opentelemetry/sdk-trace-base`'s `InMemorySpanExporter` + a manually started
  span), absent when no span is active, console output still occurs (spy on
  `console.log`/`process.stdout`), and that `LOG_LEVEL` gating still suppresses the same levels as
  today.
- `telemetry/tests/http-metrics.spec.ts` — uses `@opentelemetry/sdk-metrics`'s in-memory metric
  reader/exporter to assert: one histogram data point per request, correct
  `http.request.method`/`http.route`/`http.response.status_code` attributes, the `"unmatched"`
  fallback for unrouted paths, and exactly one recorded data point for a request whose handler
  throws (no duplicate recording between the `next`/`error` branches).
- `common/interceptors/tests/metrics.interceptor.spec.ts` (existing file, extended) — asserts the
  interceptor calls the shared histogram exactly once per request/response cycle, covering both
  success and thrown-exception paths.
- `telemetry/tests/traceparent.middleware.spec.ts` — asserts header presence/format for a request
  with an active span, and absence for `/api/health`/`/metrics`.
- `telemetry/tests/otel-sdk.spec.ts` (or a `supertest`-based integration test) — inbound
  `traceparent` propagation: send a request carrying a `traceparent` header, assert the response's
  `traceparent` shares the same trace-id, and assert a local stand-in "upstream" HTTP server
  (started in-test, not real DIAL Core) receives the propagated header on an outbound call the
  handler triggers.
- `telemetry/tests/prometheus-endpoint.spec.ts` — starts `PrometheusExporter` on an OS-assigned
  ephemeral port (`port: 0`) in-process, records a metric via the shared meter, issues a loopback
  HTTP GET to the exporter's own `/metrics` path, and asserts the response `content-type` and body
  contain the expected metric family name — fully local, no live collector.
- `telemetry/tests/otel-sdk-shutdown.spec.ts` — asserts `shutdownOpenTelemetry()` resolves within
  its bounded timeout using a deliberately slow fake exporter, and resolves normally with fast
  fakes.
- **All tests use in-memory/fake exporters and loopback servers only — never a live OTLP
  collector,** per the proposal's constraint.
- Verification commands per slice: `npm exec nx test chat-api`, `npm exec nx lint chat-api`,
  `npm exec nx build chat-api` (build affected once `main.ts`/webpack-adjacent files change).
- **Production smoke test** (task-level, scripted, not a vitest spec): build via
  `npm exec nx build chat-api`, run `node apps/chat-api/dist/main.js` with
  `OTEL_SDK_DISABLED=false`, `OTEL_TRACES_EXPORTER=none`, `OTEL_LOGS_EXPORTER=none`,
  `OTEL_METRICS_EXPORTER=prometheus` (self-contained — no outbound OTLP calls, only the local
  Prometheus listener) plus the app's existing required env vars stubbed to safe local values;
  curl `GET /api/health` (200) and `GET http://localhost:9464/metrics` (200,
  `text/plain` content type, containing at least default process metrics); send `SIGTERM`;
  assert the process exits within a bounded window (e.g. 10s) without needing `SIGKILL`.

### 8. Documentation and deployment handoff

- `apps/chat-api/README.md` gains an **Observability** section: architecture summary (this
  design's §1 in prose), the full variable table from §6, a minimal `docker run`/collector example,
  a `curl localhost:9464/metrics` example, and the local verification commands from §7.
- `docs/architecture.md` §"apps/chat-api — Backend": add one short bullet noting the optional
  `:9464` Prometheus port and the `traceparent` response header, since both are new runtime-facing
  behaviors of the documented backend boundary. No other architecture doc changes are needed since
  no documented boundary (auth flow, domain structure, module rules) changes.
- **Deployment follow-up, explicitly out of scope for this change**: `ai-dial-chat-ng`'s
  `values.yaml` needs (a) new `env` entries for the desired `OTEL_*` variables (left unset = fully
  backward compatible, matching today), (b) if the Prometheus listener is enabled, a container port
  `9464` + a matching `Service` port, and (c) a scrape annotation or `ServiceMonitor` depending on
  the cluster's Prometheus setup. This work is not performed as part of this source change.

## Risks / Trade-offs

- **[Risk] If `apps/chat-api/webpack.config.js`'s `optimization: false` is ever changed (enabling
  tree-shaking/module concatenation), the "import order = execution order" guarantee for
  `./telemetry/otel-sdk` as `main.ts`'s first import could be broken by webpack reordering
  side-effect imports.** → Mitigation: the production smoke test (§7) exercises the actual built
  bundle and would catch a regression where `HttpInstrumentation` fails to patch in time (visible
  as missing outbound propagation headers in that test); also add a one-line comment at the top of
  `main.ts` documenting the invariant so a future webpack config change is less likely to violate
  it silently.
- **[Risk] `NodeSDK`'s resource-merge precedence means `OTEL_RESOURCE_ATTRIBUTES` cannot override
  our `service.version` (always from `package.json`).** → Mitigation: documented explicitly in §1
  and the README; `service.name` (the more commonly overridden field) is already correctly
  precedence-checked against `OTEL_SERVICE_NAME`.
- **[Risk] Enabling OpenTelemetry with a misconfigured/unreachable OTLP endpoint produces noisy
  warning-level log spam from the exporter's retry logic.** → Mitigation: this is upstream SDK
  behavior, not introduced by us; documented in the README so operators know to set
  `OTEL_TRACES_EXPORTER=none`/`OTEL_LOGS_EXPORTER=none` (or leave `OTEL_SDK_DISABLED=true`) rather
  than half-enabling telemetry without a collector.
- **[Risk] Adding `@opentelemetry/*` dependencies to `apps/chat-api/package.json` increases the
  pruned production `node_modules` size and Docker build time.** → Mitigation: pin to the same
  package family/major versions already proven to work together in the evidence codebase; verify
  final image size delta during implementation as part of the Docker/pruned-dependency
  verification task.
- **[Trade-off] Choosing the dedicated `:9464` listener (§5) means a deployment that cannot open a
  second container port cannot scrape metrics without a follow-up change** (adding the `/api/metrics`
  Nest-route alternative later). Accepted because it matches existing DIAL conventions and keeps
  this change's blast radius on the business port at zero.

## Migration Plan

1. Land `apps/chat-api/src/telemetry/**` and the `main.ts`/`app.module.ts` wiring behind the
   `OTEL_SDK_DISABLED=true` default — mergeable with no deployment coordination, since default
   behavior is unchanged.
2. Add `@opentelemetry/*` dependencies to `apps/chat-api/package.json`; verify
   `npm exec nx build chat-api` and the pruned Docker image still build and boot.
3. Update `apps/chat-api/README.md` and `docs/architecture.md` (§8 above) in the same change.
4. **Separate, coordinated follow-up** (not this change): update
   `C:\dial_projects\ai-dial-chat-ng\values.yaml` to set the desired `OTEL_*` variables for the
   target environment and, if the Prometheus listener is wanted, add the container/service port and
   scrape annotation.
5. **Rollback**: set/restore `OTEL_SDK_DISABLED=true` (or omit all `OTEL_*` vars) in the
   deployment's environment — no code revert required, since the disabled path is the default and
   fully inert.

## Open Questions

- Should a follow-up change add the same-port `/api/metrics` Nest route as a fallback for
  environments that cannot open a second container port (§5, option 2)? Not needed for this change;
  revisit if such an environment is identified.
- Should `NestOtelLogger` also attach the authenticated user id (already available on
  `request.user` in authenticated routes) as a log attribute for correlation? Left out of this
  change's minimum bar to avoid any risk of accidentally widening PII surface in logs; would need
  explicit sign-off given `apps/chat-api/AGENTS.md` §9's "never log tokens/PII" stance.
- Exact `@opentelemetry/*` package versions to pin are deferred to the implementation tasks (verify
  current versions compatible with Node 24 / NestJS 11 at that time rather than hardcoding versions
  in this design that may already be stale by the time tasks run).
