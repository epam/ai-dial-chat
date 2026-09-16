# bff-http-lifecycle-metrics Specification

## Purpose
TBD - created by archiving change complete-bff-http-observability. Update Purpose after archive.

## Requirements

### Requirement: Instrumentation point precedes parsing, guards, and routing
The application SHALL observe every HTTP request reaching its main application `http.Server`
before Express body parsers, `helmet`, CORS handling, Nest guards, pipes, and routing execute,
by attaching a listener to the underlying `http.Server`'s `'request'` event rather than to a Nest
interceptor or an `app.use()` middleware whose position depends on registration order. This
instrumentation SHALL NOT alter request parsing, authentication, CORS, exception handling,
response bodies, or routing behavior.

#### Scenario: Guard rejection is observed
- **WHEN** a request is rejected by an authentication, CSRF, feature-flag, or rate-limiting guard
  before reaching any controller
- **THEN** `dial.chat.http.requests.started` is incremented for that request
- **AND** `dial.chat.http.response.duration` records exactly one terminal data point for it

#### Scenario: Malformed or oversized body is observed
- **WHEN** a request's body fails JSON parsing or exceeds the configured body-size limit
- **THEN** `dial.chat.http.requests.started` is incremented for that request
- **AND** `dial.chat.http.response.duration` records exactly one terminal data point for it

#### Scenario: Unmatched route is observed
- **WHEN** a request path does not match any registered Nest route or static-asset path
- **THEN** `dial.chat.http.requests.started` is incremented for that request
- **AND** the terminal data point's `http.route` attribute is the bounded literal `unmatched`

#### Scenario: Request handling behavior is unaffected
- **WHEN** this instrumentation is active
- **THEN** the response status code, body, and headers for any given request are identical to
  what they would be with the instrumentation removed

### Requirement: Monitored scope is explicit and excludes the separate metrics listener
The application SHALL apply this instrumentation only to its main application `http.Server`
(covering `API_PREFIX`-scoped API routes, `OPTIONS` preflight requests, static/frontend traffic,
and the health-check route before exclusion is applied), and SHALL NOT apply it to the separate
Prometheus metrics-scrape listener, which runs on its own independent `http.Server` instance.
`GET /api/health` and `GET /metrics` SHALL be excluded from all three instruments in this
capability, using the same shared exclusion predicate the existing `http.server.request.duration`
histogram and tracing use.

#### Scenario: Static/frontend traffic is counted as arrival traffic
- **WHEN** a client requests a non-`/api/*` static asset served by the frontend static/SPA
  middleware
- **THEN** `dial.chat.http.requests.started` and `dial.chat.http.requests.active` include that
  request
- **AND** its terminal `http.route` attribute is the bounded literal `unmatched`

#### Scenario: OPTIONS preflight is counted
- **WHEN** a client sends an `OPTIONS` preflight request
- **THEN** `dial.chat.http.requests.started` is incremented with `http.request.method` = `OPTIONS`

#### Scenario: Health check is excluded
- **WHEN** a client sends `GET /api/health`
- **THEN** no data point is recorded on any of the three instruments in this capability for that
  request

#### Scenario: Prometheus scrape listener is never instrumented
- **WHEN** a scraper sends `GET /metrics` to the dedicated Prometheus listener
- **THEN** no data point is recorded on any of the three instruments in this capability, because
  that listener is a different `http.Server` instance entirely

### Requirement: Arrival, in-flight, and terminal-duration instruments
The application SHALL expose three new OpenTelemetry instruments distinct from
`http.server.request.duration`:
- `dial.chat.http.requests.started` (Counter, unit `{request}`), incremented exactly once per
  monitored request at the point it enters the monitored scope, attributed only by
  `http.request.method` (bounded to `GET`/`HEAD`/`POST`/`PUT`/`PATCH`/`DELETE`/`OPTIONS`, else
  `unknown`).
- `dial.chat.http.requests.active` (UpDownCounter, unit `{request}`), incremented at the same
  entry point and decremented exactly once at the terminal observation, using the identical
  attribute set (method only) captured at entry time for both the increment and the decrement.
- `dial.chat.http.response.duration` (Histogram, unit `s`), recorded exactly once per monitored
  request at its terminal observation, using a monotonic clock (`process.hrtime.bigint()`, never
  `Date.now()`) for the duration measurement.

#### Scenario: Arrival and in-flight increment together
- **WHEN** a monitored request enters the application
- **THEN** `dial.chat.http.requests.started` increments by 1
- **AND** `dial.chat.http.requests.active` increments by 1 with the same `http.request.method`
  attribute value

#### Scenario: In-flight decrement uses the same attribute set as its increment
- **WHEN** a monitored request that incremented `dial.chat.http.requests.active` with
  `http.request.method="POST"` later settles
- **THEN** the decrement is recorded with `http.request.method="POST"`, matching the increment
  exactly, regardless of what `http.route` or status code is resolved at settle time

#### Scenario: Net-zero in-flight after settlement
- **WHEN** any single monitored request completes, is aborted, or errors
- **THEN** `dial.chat.http.requests.active`'s net change across that request's lifecycle is zero

#### Scenario: Duration uses a monotonic clock
- **WHEN** a monitored request's terminal duration is recorded
- **THEN** the recorded value is derived from `process.hrtime.bigint()` timestamps taken at entry
  and at settlement, not from `Date.now()`

### Requirement: Exactly-once terminal recording across finish, close, error, and abort races
The application SHALL record `dial.chat.http.response.duration` and release the corresponding
`dial.chat.http.requests.active` contribution exactly once per monitored request, regardless of
which combination of the response's `'finish'`, `'close'`, or `'error'` events, or the request's
`'aborted'`/`'error'` events, fire for it, and regardless of their order. An ordinary `'close'`
event on the response SHALL NOT, by itself, be interpreted as response completion.

#### Scenario: Normal completion records once
- **WHEN** a request completes normally (`'finish'` fires, later followed by `'close'` on
  connection teardown)
- **THEN** exactly one terminal data point is recorded for that request, from the `'finish'` event
- **AND** the later `'close'` event produces no additional data point

#### Scenario: Client disconnect before any response fires only 'close'
- **WHEN** a client disconnects before the server sends any response and only a `'close'` event
  fires (no `'finish'`)
- **THEN** exactly one terminal data point is recorded, with outcome `aborted_before_response`
- **AND** `http.response.status_code` is omitted from that data point

#### Scenario: Client disconnect mid-stream fires close after headers were sent
- **WHEN** a client disconnects while an SSE response is streaming (headers already sent, no
  `'finish'`)
- **THEN** exactly one terminal data point is recorded, with outcome `aborted_during_response`
- **AND** `http.response.status_code` reflects the status committed before disconnect

#### Scenario: No listener leak across many requests
- **WHEN** a large number of monitored requests complete sequentially
- **THEN** the count of `'finish'`/`'close'`/`'error'` listeners attached to any given response or
  request object returns to its pre-request baseline after that request settles

### Requirement: Truthful, bounded terminal attributes
`dial.chat.http.response.duration` SHALL carry `http.request.method` (same bounded set as the
arrival instrument), `http.route` (the Nest-resolved route template when available, else the
bounded literal `unmatched` — never the raw requested path), `http.response.status_code` (present
only when the response's headers were actually sent), `dial.chat.http.outcome` (one of
`completed`, `aborted_before_response`, `aborted_during_response`, `error`), and
`dial.chat.http.transport_kind` (one of `ordinary`, `streaming`, `unmatched`, derived from a fixed,
explicit list of long-lived SSE route templates). No attribute on any of the three instruments in
this capability SHALL ever be a raw URL, query string, or any user/conversation/deployment
identifier.

#### Scenario: Matched business route reports its template
- **WHEN** a request to `/api/v1/themes/icon` completes
- **THEN** the terminal data point's `http.route` is the matched route template, not the literal
  requested path

#### Scenario: Streaming route is classified as streaming
- **WHEN** a request to `/api/v1/conversations/completions`, `/api/v1/conversations/completions/attach`,
  `/api/v1/conversations/watch`, or `/api/v1/client-channel/subscribe` completes or is aborted
- **THEN** the terminal data point's `dial.chat.http.transport_kind` is `streaming`

#### Scenario: Every other matched route is ordinary
- **WHEN** a request to any matched route not in the streaming list completes
- **THEN** the terminal data point's `dial.chat.http.transport_kind` is `ordinary`

#### Scenario: Status code omitted before headers are sent
- **WHEN** a request's terminal outcome is `aborted_before_response`
- **THEN** the terminal data point has no `http.response.status_code` attribute

#### Scenario: No raw path or identifier ever appears
- **WHEN** a client requests an unmatched or parameterized path containing an identifier (e.g.
  `/api/v1/conversations/abc-123-def-456`)
- **THEN** no attribute on any of the three instruments contains that raw path segment

### Requirement: Explicit sub-second histogram bucket boundaries
`dial.chat.http.response.duration` SHALL use the fixed bucket boundaries
`[0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 10, 30, 60]` seconds, spanning
both ordinary sub-second REST latency and longer-lived streaming durations, rather than the
OpenTelemetry SDK's default boundaries (which start at 0, 5, 10 seconds).

#### Scenario: Sub-second latency is distinguishable
- **WHEN** an ordinary REST request completes in under 100 milliseconds
- **THEN** its duration falls into one of this histogram's sub-100ms buckets, distinct from
  requests completing in 100-500ms

### Requirement: Bucket boundary changes require a new metric identity
Once `dial.chat.http.response.duration`'s bucket boundaries are released, the application SHALL
NOT change them in place under the same metric name. A future change to bucket boundaries SHALL
ship under a new metric name or an explicit version suffix.

#### Scenario: Boundary change ships as a new metric
- **WHEN** a future change needs different histogram bucket boundaries for this signal
- **THEN** it introduces a new instrument name rather than editing
  `dial.chat.http.response.duration`'s existing boundaries

### Requirement: Instruments are gated by the existing metrics-exporter toggle
The application SHALL register the `'request'` listener and its three instruments only when at
least one metrics exporter is enabled (mirroring the existing runtime-gauge registration
condition), so that a deployment with telemetry disabled observes no behavior change from this
capability.

#### Scenario: Metrics disabled
- **WHEN** `OTEL_SDK_DISABLED` is `true` or `OTEL_METRICS_EXPORTER=none`
- **THEN** the `'request'` listener is not attached
- **AND** none of the three instruments in this capability record any data
