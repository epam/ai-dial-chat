## MODIFIED Requirements

### Requirement: No duplicate HTTP metric sources
The application SHALL NOT enable any automatic HTTP instrumentation metrics feature (e.g.
`@opentelemetry/instrumentation-http`'s built-in metrics) that would produce a second source of
`http.server.request.duration` data alongside `MetricsInterceptor`, and neither
`http.server.request.duration` nor the `dial.chat.http.*` instrument family (`requests.started`,
`requests.active`, `response.duration` — see the `bff-http-lifecycle-metrics` capability) SHALL
record more than one terminal data point for the same request within its own family. The
`dial.chat.http.*` family is a distinct, differently-scoped instrument set — observing the
complete HTTP transport lifecycle rather than Nest handler settlement — and its existence SHALL
NOT be read as violating this requirement; it exists alongside `http.server.request.duration`,
not in place of it.

#### Scenario: Single source of http.server.request.duration
- **WHEN** metrics are enabled
- **THEN** `MetricsInterceptor`'s histogram is the only emitter of `http.server.request.duration`
  data points for the application

#### Scenario: dial.chat.http.* coexists without duplicating http.server.request.duration
- **WHEN** metrics are enabled and a request completes
- **THEN** `http.server.request.duration` records at most one data point for it (unchanged from
  before this change)
- **AND** `dial.chat.http.response.duration` independently records at most one data point for it
- **AND** neither instrument's data point is derived from or duplicates the other's recording
  logic

#### Scenario: No automatic HTTP instrumentation metrics enabled
- **WHEN** the OpenTelemetry SDK is initialized
- **THEN** `HttpInstrumentation`'s own metrics feature is not enabled
- **AND** the only HTTP-duration emitters in the application are `MetricsInterceptor` and the
  `dial.chat.http.*` instrument family
