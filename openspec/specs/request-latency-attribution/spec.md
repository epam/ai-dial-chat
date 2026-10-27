# request-latency-attribution Specification

## Purpose

Measure per-request total, Core-active and outside-Core duration in the Chat backend and expose whole-period endpoint statistics and individual slow-request traces. Request-local timing state belongs to `requestTimingStorage` in `apps/chat-api/src/telemetry/request-timing-state.ts`; collection is controlled by existing OpenTelemetry settings. This adds no business endpoints, product feature flags, caches, frontend state or product translation keys. The Grafana dashboard uses native panels, with accessibility and responsive layout provided by Grafana.

## Requirements

### Requirement: Request-local terminal timing phases

The backend SHALL record `dial.chat.http.request.phase.duration` in seconds, once for each `dial.chat.http.phase` value `total`, `core`, and `chat` per monitored request at its first terminal event. The scope SHALL start at the earliest registered application middleware, before cookies, body parsing and guards, and honor the shared telemetry exclusions. The labels SHALL use bounded HTTP method, matched route template or `unmatched`, transport kind, terminal outcome, and status only when headers were sent. Existing metrics and bucket boundaries SHALL remain unchanged.

#### Scenario: Request without Core calls

- **WHEN** a monitored request ends without a Core wire request
- **THEN** all three observations are emitted, Core is zero and outside-Core equals total
- **AND** a later close/error event does not emit another observation

#### Scenario: Guard rejection or aborted request

- **WHEN** a guard rejects the request or the transport aborts before response headers
- **THEN** timing records the terminal outcome and available route without fabricating a response status

### Requirement: Overlap-safe Core attribution

Core time SHALL be the union of request-local wire intervals observed through the shared Core fetch transport, from outgoing request creation through body completion or failure, clipped at the incoming request's terminal time. Chat time SHALL equal total minus Core and be described as time outside Core calls, including other waits. Timing SHALL use a monotonic clock and constant-size interval accumulation per incoming request. Response bodies SHALL NOT be cloned, drained or rewritten by the timing feature.

#### Scenario: Parallel Core calls

- **WHEN** two Core calls overlap for part of the same incoming request
- **THEN** the overlap counts once and Core cannot exceed total
- **AND** another incoming request's observations remain independent

#### Scenario: Delayed response body

- **WHEN** Core headers arrive before its final response body chunk
- **THEN** Core timing continues through body completion or failure

#### Scenario: Background work outlives HTTP

- **WHEN** the incoming response closes while Core is still active
- **THEN** the observation ends at that close and later Core completion or new background calls do not change it

### Requirement: Opt-in collection and trace correlation

The feature SHALL be inactive when telemetry is disabled or both metrics and traces are disabled. Metrics SHALL work without trace export. Enabled trace collection SHALL include a request timing span marked `dial.chat.http.request.timing=true` with route/method/outcome and total/Core/chat duration attributes in seconds. Request identifiers and trace IDs SHALL NOT be metric labels.

#### Scenario: Metrics-only deployment

- **WHEN** Prometheus is enabled and traces are disabled
- **THEN** terminal phase metrics are available without a trace collector

#### Scenario: Trace investigation

- **WHEN** request timing spans are exported
- **THEN** Tempo can select one request's timing span and display its three durations with navigation to the whole trace

### Requirement: Whole-period latency dashboard

Dashboard 08 SHALL default to rolling 24 hours and refresh every five minutes. It SHALL expose workload, method, route, outcome and transport filters, defaulting to ordinary requests, and tables/rankings for ended-request count, weighted mean duration, p95/p99, Core/outside-Core means and Core share, and counts/shares above 5 and 60 seconds. Queries SHALL use only the new timing population, apply increase before aggregation, preserve missing samples and reject zero denominators. Quantiles beyond the 3600-second finite bucket SHALL be omitted. An optional Tempo table SHALL show matching individual slow requests and trace links while disclosing sampling/search limits and separate trace filters.

#### Scenario: Historical daily selection

- **WHEN** an operator selects a historical 24-hour range
- **THEN** endpoint statistics and rankings use that whole interval ending at the selected end time, rather than the most recent rate window

#### Scenario: No observations or long open stream

- **WHEN** an endpoint has no observed terminal requests in the selected interval
- **THEN** its latency is not displayed as zero
- **AND** still-open streams do not contribute until they terminate

#### Scenario: Tail above finite buckets

- **WHEN** a requested percentile falls beyond the last finite bucket
- **THEN** the dashboard leaves it absent rather than reporting a clipped 3600-second estimate
- **AND** the mean and slow-tail counts remain available
