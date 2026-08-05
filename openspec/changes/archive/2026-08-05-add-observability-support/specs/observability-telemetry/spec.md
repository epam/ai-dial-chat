## ADDED Requirements

### Requirement: OpenTelemetry SDK disabled by default
The application SHALL treat OpenTelemetry as fully disabled unless explicitly enabled, so that a
deployment which sets no `OTEL_*` environment variable observes byte-identical behavior to a build
without OpenTelemetry support.

#### Scenario: No OTEL_* variables set
- **WHEN** the application starts with no `OTEL_*` environment variable set
- **THEN** `OTEL_SDK_DISABLED` is treated as `true`
- **AND** no trace/metric/log exporter, span/log processor, or Prometheus HTTP listener is
  constructed
- **AND** no outbound network connection is attempted for telemetry purposes

#### Scenario: Explicit opt-in
- **WHEN** the application starts with `OTEL_SDK_DISABLED=false`
- **THEN** the OpenTelemetry Node SDK is initialized before the Nest application is created

### Requirement: Telemetry initialization order
The OpenTelemetry SDK bootstrap SHALL execute before any Nest, Express, or outbound HTTP/fetch
client module is loaded, so that HTTP and Undici instrumentation can patch Node's core modules
before they are first used.

#### Scenario: Bootstrap import position
- **WHEN** `apps/chat-api/src/main.ts` is loaded
- **THEN** the telemetry bootstrap module is the first import in the file, preceding
  `reflect-metadata`, `@nestjs/common`, `cookie-parser`, `helmet`, and the application module

#### Scenario: Outbound propagation available on first request
- **WHEN** the SDK is enabled and the application handles its first inbound HTTP request that
  triggers an outbound HTTP or fetch call
- **THEN** the outbound call carries a W3C `traceparent` header derived from the inbound request's
  trace context

### Requirement: Resource identity precedence
The application SHALL resolve `service.name` from `OTEL_SERVICE_NAME` when set, falling back to
the package name, and SHALL resolve `service.version` from the package version, while
`OTEL_RESOURCE_ATTRIBUTES` SHALL be honored for any resource attribute key not explicitly set by
the application.

#### Scenario: OTEL_SERVICE_NAME overrides the package name
- **WHEN** `OTEL_SERVICE_NAME=custom-service-name` is set
- **THEN** the resource's `service.name` attribute is `custom-service-name`

#### Scenario: No OTEL_SERVICE_NAME set
- **WHEN** `OTEL_SERVICE_NAME` is unset
- **THEN** the resource's `service.name` attribute falls back to the application package name

#### Scenario: Custom resource attribute passthrough
- **WHEN** `OTEL_RESOURCE_ATTRIBUTES=deployment.environment=staging` is set
- **THEN** the resource carries a `deployment.environment` attribute with value `staging`
- **AND** the `service.name`/`service.version` attributes are unaffected by that variable

### Requirement: Per-signal exporter selection
The application SHALL allow each telemetry signal (traces, metrics, logs) to be independently
enabled, disabled (`none`), or exporter-selected via `OTEL_TRACES_EXPORTER`,
`OTEL_METRICS_EXPORTER`, and `OTEL_LOGS_EXPORTER`, with `OTEL_METRICS_EXPORTER` accepting a
comma-separated list of exporters.

#### Scenario: One signal disabled, others active
- **WHEN** the SDK is enabled with `OTEL_LOGS_EXPORTER=none`
- **THEN** no log records are exported
- **AND** traces and metrics continue to export per their own configuration

#### Scenario: Comma-separated metrics exporters
- **WHEN** the SDK is enabled with `OTEL_METRICS_EXPORTER=otlp,prometheus`
- **THEN** metrics recorded through the application's meter are delivered to both an OTLP metric
  reader and a Prometheus-compatible reader

#### Scenario: Default metrics exporter when enabled
- **WHEN** the SDK is enabled and `OTEL_METRICS_EXPORTER` is unset
- **THEN** the metrics exporter defaults to `prometheus`

### Requirement: Graceful shutdown of telemetry processors
The application SHALL flush and shut down trace, metric, and log processors when the Nest
application receives a shutdown signal, bounded by an internal timeout so a hung exporter cannot
block process termination.

#### Scenario: Normal shutdown
- **WHEN** the Nest application shuts down (e.g. on `SIGTERM`)
- **THEN** the telemetry shutdown routine is invoked via Nest's `OnApplicationShutdown` lifecycle
- **AND** it resolves before the process exits

#### Scenario: Slow exporter during shutdown
- **WHEN** a configured exporter takes longer than the internal shutdown timeout to flush
- **THEN** the shutdown routine resolves once the timeout elapses instead of waiting indefinitely

### Requirement: Telemetry does not affect request handling on exporter failure
The application SHALL NOT crash, throw into the request-handling path, or block a response when a
configured telemetry exporter or collector is unavailable.

#### Scenario: Unreachable OTLP collector
- **WHEN** the SDK is enabled with an `OTEL_EXPORTER_OTLP_ENDPOINT` that points to an unreachable
  host
- **THEN** in-flight and subsequent HTTP requests to the application complete normally
- **AND** the failure surfaces only as exporter-level log output, not as a request error

### Requirement: HTTP server tracing and outbound propagation
The application SHALL produce a server span for each incoming HTTP request when tracing is
enabled and SHALL propagate the active W3C trace context into outbound HTTP and fetch/Undici
calls made while handling that request.

#### Scenario: Inbound request produces a server span
- **WHEN** tracing is enabled and a client sends a request to any `/api/*` route
- **THEN** a server span is created for that request

#### Scenario: Outbound call propagates trace context
- **WHEN** tracing is enabled and a request handler makes an outbound HTTP or fetch call (e.g. to
  DIAL Core)
- **THEN** the outbound call's headers include a `traceparent` value sharing the inbound request's
  trace id

### Requirement: Health and metrics scrape requests excluded from tracing
The application SHALL NOT create a server span for requests to the health-check endpoint or the
Prometheus metrics scrape endpoint.

#### Scenario: Health check excluded
- **WHEN** tracing is enabled and a client sends `GET /api/health`
- **THEN** no server span is created for that request

#### Scenario: Metrics scrape excluded
- **WHEN** tracing is enabled and a client sends `GET /metrics` to the Prometheus listener
- **THEN** no server span is created for that request

### Requirement: Traceparent response header
The application SHALL include a `traceparent` response header, reflecting the active trace
context, on both success and error responses for routes where a server span was created.

#### Scenario: Success response includes traceparent
- **WHEN** tracing is enabled and a client receives a successful response from a traced route
- **THEN** the response includes a `traceparent` header in W3C format

#### Scenario: Error response includes traceparent
- **WHEN** tracing is enabled and a request to a traced route results in an error response
- **THEN** the error response includes a `traceparent` header sharing the same trace id as the
  request

#### Scenario: Traceparent exposed to browser callers
- **WHEN** a browser-origin request is made with CORS credentials
- **THEN** the response's `Access-Control-Expose-Headers` configuration includes `traceparent`

### Requirement: Application log export through OpenTelemetry
The application SHALL export NestJS `Logger` records (all supported levels) through the
OpenTelemetry Logs API when log export is enabled, while preserving existing console output and
`LOG_LEVEL` filtering behavior unchanged.

#### Scenario: Console output preserved
- **WHEN** log export is enabled and application code calls `logger.log('message')`
- **THEN** the message still appears in console output exactly as it did before this change

#### Scenario: Level filtering preserved
- **WHEN** `LOG_LEVEL` is configured such that `debug`-level messages are suppressed
- **THEN** a `logger.debug(...)` call produces neither console output nor an exported log record

#### Scenario: Log export produces no duplicate records
- **WHEN** log export is enabled and a single `logger.log(...)` call is made
- **THEN** exactly one log record is emitted to the OpenTelemetry Logs pipeline for that call

#### Scenario: SDK diagnostics not looped back
- **WHEN** the OpenTelemetry SDK emits its own internal diagnostic output
- **THEN** that diagnostic output is not routed through the application's `Logger`-to-OpenTelemetry
  bridge

### Requirement: Log severity mapping and trace correlation
Exported log records SHALL carry an OpenTelemetry severity number/text derived from the NestJS log
level, and SHALL include the active `trace_id`/`span_id` when emitted within a span's context.

#### Scenario: Level-to-severity mapping
- **WHEN** application code calls `logger.warn(...)`
- **THEN** the exported log record's severity number corresponds to the OpenTelemetry `WARN`
  severity

#### Scenario: Trace correlation present
- **WHEN** a log statement executes while a server span is active
- **THEN** the exported log record includes that span's `trace_id` and `span_id`

#### Scenario: No active span
- **WHEN** a log statement executes with no active span (e.g. during startup)
- **THEN** the exported log record has no `trace_id`/`span_id` populated

#### Scenario: Exception fields preserved
- **WHEN** application code calls `logger.error(message, stack)`
- **THEN** the exported log record's attributes include the exception type, message, and
  stack trace as structured fields

### Requirement: Request duration and count metric
The application SHALL record an HTTP server request duration histogram, in seconds, attributed by
HTTP method, normalized route template, and response status code, replacing the monitoring TODOs
in `MetricsInterceptor`.

#### Scenario: Successful request recorded
- **WHEN** metrics are enabled and a client completes a successful request to a versioned business
  route
- **THEN** a data point is recorded on the request duration histogram with attributes for the
  request's HTTP method, matched route template, and response status code

#### Scenario: Errored request recorded exactly once
- **WHEN** metrics are enabled and a request handler throws an exception
- **THEN** exactly one data point is recorded on the request duration histogram for that request,
  with the thrown error's status code

#### Scenario: Unmatched route uses bounded fallback
- **WHEN** metrics are enabled and a client requests a path that does not match any registered
  route
- **THEN** the recorded data point's route attribute is a fixed bounded value rather than the raw
  requested path

### Requirement: Health check excluded from HTTP request metrics
The application SHALL NOT record an `http.server.request.duration` data point for requests to the
health-check endpoint, so infrastructure probe traffic (e.g. a Kubernetes liveness/readiness
probe polling every few seconds) does not pollute business-request dashboards, alerting, or
percentile calculations. This mirrors the health endpoint's existing exclusion from tracing
(`ignoreIncomingRequestHook`) — both exclusions are driven by the same shared path list
(`telemetry/excluded-paths.ts`) so the two signals cannot silently drift apart.

#### Scenario: Health check not recorded
- **WHEN** metrics are enabled and a client sends `GET /api/health`
- **THEN** no data point is recorded on the request duration histogram for that request
- **AND** the request is still logged as before (this exclusion only affects the metrics
  histogram, not `MetricsInterceptor`'s existing log line)

### Requirement: No high-cardinality metric or span attributes
The application SHALL NOT use raw URLs, query strings, conversation IDs, deployment IDs, user IDs,
or other unbounded values as metric attribute values or span names.

#### Scenario: Route template used instead of raw path
- **WHEN** a client requests `/api/v1/conversations/abc-123-def-456`
- **THEN** the recorded metric's route attribute is the route template (e.g.
  `/api/v1/conversations/:id`), not the literal path containing the conversation id

### Requirement: No duplicate HTTP metric sources
The application SHALL NOT enable any automatic HTTP instrumentation metrics feature that would
produce a second source of HTTP server request duration data alongside the `MetricsInterceptor`
histogram.

#### Scenario: Single metrics source
- **WHEN** metrics are enabled
- **THEN** `MetricsInterceptor`'s histogram is the only emitter of HTTP server request duration
  data points for the application
