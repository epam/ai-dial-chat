## ADDED Requirements

### Requirement: Dedicated Prometheus scrape endpoint
The application SHALL expose a Prometheus-compatible metrics scrape endpoint on a dedicated HTTP
listener, independent of the main Nest/Express application port, when the Prometheus metrics
exporter is selected.

#### Scenario: Prometheus exporter enabled
- **WHEN** the SDK is enabled with `OTEL_METRICS_EXPORTER` including `prometheus`
- **THEN** an HTTP listener starts on the configured Prometheus host/port
- **AND** a `GET /metrics` request to that listener returns a `200` response with content type
  `text/plain` (the literal, unconditional value the installed
  `@opentelemetry/exporter-prometheus@0.221.0` sets — verified against its source; older
  versions of this package appended `; version=0.0.4; charset=utf-8`, but the currently pinned
  version does not)

#### Scenario: Prometheus exporter not selected
- **WHEN** the SDK is enabled with `OTEL_METRICS_EXPORTER=otlp` only
- **THEN** no Prometheus HTTP listener is started

#### Scenario: SDK disabled
- **WHEN** `OTEL_SDK_DISABLED` is `true` (the default)
- **THEN** no Prometheus HTTP listener is started regardless of `OTEL_METRICS_EXPORTER`

### Requirement: Prometheus listener does not share the business application port
The Prometheus metrics listener SHALL run on a separate port from the main application, so that
scrape traffic and business API traffic are never mixed on the same origin.

#### Scenario: Ports differ
- **WHEN** the Prometheus listener and the main application are both running
- **THEN** the Prometheus listener's port is different from the application's `PORT`
  configuration
- **AND** the metrics endpoint is not reachable at `/api/metrics` on the application port

### Requirement: Prometheus host and port configuration
The application SHALL read the Prometheus listener's bind host and port from
`OTEL_EXPORTER_PROMETHEUS_HOST` and `OTEL_EXPORTER_PROMETHEUS_PORT`, defaulting to `0.0.0.0` and
`9464` respectively, since the underlying Prometheus exporter package does not read these
variables itself.

#### Scenario: Default host and port
- **WHEN** the Prometheus exporter is enabled with neither variable set
- **THEN** the listener binds to `0.0.0.0:9464`

#### Scenario: Custom port
- **WHEN** the Prometheus exporter is enabled with `OTEL_EXPORTER_PROMETHEUS_PORT=9500`
- **THEN** the listener binds to port `9500`

### Requirement: Metrics endpoint requires no authentication
The Prometheus metrics endpoint SHALL NOT require request authentication, consistent with standard
Prometheus scrape conventions; access control is expected to be enforced by network policy rather
than the application.

#### Scenario: Unauthenticated scrape succeeds
- **WHEN** a client sends `GET /metrics` to the Prometheus listener with no credentials
- **THEN** the request succeeds with a `200` response

### Requirement: Simultaneous Prometheus and OTLP metrics export
The application SHALL support exporting the same recorded metrics through both the Prometheus
listener and an OTLP metrics exporter at the same time, without requiring duplicate instrumentation
code.

#### Scenario: Both exporters active
- **WHEN** `OTEL_METRICS_EXPORTER=otlp,prometheus` is set and the SDK is enabled
- **THEN** a metric recorded once through the application's meter is observable both via a scrape
  of the Prometheus endpoint and via the configured OTLP metrics exporter

### Requirement: Metrics scrape requests excluded from the endpoint's own tracing
Requests to the Prometheus metrics endpoint SHALL NOT themselves generate an HTTP trace span, so
that repeated scrapes do not create self-referential telemetry noise.

#### Scenario: Scrape does not generate a span
- **WHEN** tracing and the Prometheus listener are both enabled and a scraper sends
  `GET /metrics`
- **THEN** no server span is created for that request
