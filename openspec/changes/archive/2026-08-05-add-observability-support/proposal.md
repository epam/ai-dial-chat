## Why

`apps/chat-api` currently has no distributed tracing, no exported application logs, and no real
metrics: `MetricsInterceptor` only writes a log line per request and carries two TODOs for "real"
monitoring integration (`apps/chat-api/src/common/interceptors/metrics.interceptor.ts:37-51`).
Operators cannot correlate a failing request across DIAL Core and `chat-api`, cannot scrape
request-rate/latency/error metrics, and cannot ship structured logs to a central store. Other DIAL
services (DIAL Core, `ai-dial-admin-backend`) already standardize on OpenTelemetry for
traces/log-correlation and expose Prometheus-compatible metrics; `chat-api` needs the same
centralized-observability story so it can be monitored the same way.

## What Changes

- Add an OpenTelemetry Node SDK bootstrap that initializes before Nest, Express, and outbound
  HTTP/fetch/Undici clients are used, honors `OTEL_SDK_DISABLED`, per-signal exporter selection
  (`OTEL_TRACES_EXPORTER` / `OTEL_METRICS_EXPORTER` / `OTEL_LOGS_EXPORTER`, including `none`), and
  resolves `service.name`/`service.version` from `OTEL_SERVICE_NAME` / `package.json` /
  `OTEL_RESOURCE_ATTRIBUTES` with documented precedence.
- Add OpenTelemetry **traces**: automatic HTTP server spans for inbound requests, W3C trace-context
  propagation into outbound calls to DIAL Core and other upstreams, health/metrics scrape
  exclusion, and (decided in design) a `traceparent` response header on success and error
  responses, following the `ai-dial-admin-backend` convention.
- Add OpenTelemetry **logs**: bridge NestJS `Logger` output into the OpenTelemetry Logs API
  (mapped severities, trace/span correlation, structured stack traces) while preserving existing
  console output and `LOG_LEVEL` behavior — without duplicating records or looping SDK diagnostics
  back into the same logger.
- Add OpenTelemetry **metrics**: replace the two TODOs in `MetricsInterceptor` with real
  request-count and request-duration instruments, attributed by HTTP method, normalized route
  template, and status/status class, without double-counting against any automatic HTTP
  instrumentation and without high-cardinality labels (no raw URLs, IDs, or query strings).
- Add a **Prometheus-compatible metrics endpoint** (exact binding — dedicated port vs. same-port
  Nest route vs. both — decided in design.md) documenting content type, host/port/path, and scrape
  expectations.
- Document all supported `OTEL_*` environment variables (SDK-consumed and application-consumed)
  with explicit defaults, and make the feature backward compatible by default: no configured
  collector must not produce startup failures, request-blocking behavior, or noisy connection-error
  loops.
- Update `apps/chat-api/README.md` with the observability architecture, environment variables,
  collector/Prometheus examples, and local verification steps.

## Capabilities

### New Capabilities

- `observability-telemetry`: OpenTelemetry SDK lifecycle (init order, resource identity, exporter
  selection incl. `none`/disabled, graceful shutdown), traces (HTTP server spans, W3C propagation,
  `traceparent` response header), application log export with severity mapping and trace
  correlation, and request metrics instruments (count + duration) wired into `MetricsInterceptor`.
- `prometheus-metrics-endpoint`: the Prometheus-scrape-compatible metrics surface — its bind
  host/port/path, content type, and how it coexists with (or replaces) OTLP metric export.

### Modified Capabilities

_(none — no existing spec currently documents `MetricsInterceptor` or logging/tracing behavior;
this change only adds new, previously-unspecified backend behavior.)_

## Impact

- **Code**: `apps/chat-api/src/main.ts` (SDK init as first statement, graceful shutdown hook),
  new `apps/chat-api/src/telemetry/` (or similar) module for SDK bootstrap, logger bridge, and
  metric instruments; `apps/chat-api/src/common/interceptors/metrics.interceptor.ts` (real
  instruments replacing TODOs); `apps/chat-api/src/config/environment.config.ts` (application-owned
  observability env vars only); `apps/chat-api/src/health/health.controller.ts` and/or a new
  metrics controller (only if the same-port option is chosen).
- **Dependencies**: adds `@opentelemetry/*` packages (SDK, OTLP HTTP exporters for
  logs/traces/metrics, Prometheus exporter, HTTP/Undici instrumentation, resources, semantic
  conventions) to `apps/chat-api/package.json` (or root, depending on Nx dependency resolution for
  the pruned Docker build).
- **Build/Docker**: no change to the `node apps/chat-api/dist/main.js` entrypoint is required if
  SDK init happens as the first import inside `main.ts`; the design must confirm this is safe given
  `apps/chat-api/webpack.config.js`'s `optimization: false` and the externalized-dependency pruning
  in the root `Dockerfile`.
- **Docs**: `apps/chat-api/README.md` gets an Observability section; `docs/architecture.md` gets a
  short update only if the chosen design changes a documented runtime boundary (e.g., a new
  dedicated metrics port).
- **Deployment (follow-up, not part of this change)**: `C:\dial_projects\ai-dial-chat-ng\values.yaml`
  will need new `OTEL_*` env entries and, if the dedicated `:9464/metrics` listener is chosen,
  a container/service port and scrape annotation — called out in design.md as coordinated
  follow-up work, not edited here.
- **No impact**: frontend (`apps/chat`), i18n/RTL/accessibility, generated OpenAPI client
  (`libs/chat-api-client`), and business API contracts — unless the design introduces a same-port
  Nest metrics endpoint, in which case that one new unversioned infrastructure route is documented
  in design.md.
