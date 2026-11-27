# Spec Delta

## MODIFIED Requirements

### Requirement: Request-local terminal timing phases

The backend SHALL record `dial.chat.http.request.phase.duration` in seconds, once for each `dial.chat.http.phase` value `total`, `core`, `analytics`, and `chat` per monitored request at its first terminal event. The scope SHALL start at the earliest registered application middleware, before cookies, body parsing and guards, and honor the shared telemetry exclusions. The labels SHALL use bounded HTTP method, matched route template or `unmatched`, transport kind, terminal outcome, and status only when headers were sent. Existing metrics, the metric name, the existing phase values and bucket boundaries SHALL remain unchanged.

#### Scenario: Request without Core calls

- **WHEN** a monitored request ends without a Core or DIAL Analytics wire request
- **THEN** all four observations are emitted, Core and Analytics are zero and outside-upstream (`chat`) equals total
- **AND** a later close/error event does not emit another observation

#### Scenario: Guard rejection or aborted request

- **WHEN** a guard rejects the request or the transport aborts before response headers
- **THEN** timing records the terminal outcome and available route without fabricating a response status

### Requirement: Overlap-safe Core attribution

Core time SHALL be the union of request-local wire intervals observed through the shared Core fetch transport, from outgoing request creation through body completion or failure, clipped at the incoming request's terminal time. Chat time SHALL equal total minus the union of all attributed upstream intervals (Core and DIAL Analytics together), SHALL never be negative or exceed total, and SHALL be described as time outside Core and Analytics calls, including other waits. Wall time during which Core and Analytics overlap SHALL count in both the `core` and the `analytics` phase and SHALL be subtracted from `chat` once, so `core + analytics + chat` equals total only when the two never overlap. Timing SHALL use a monotonic clock and constant-size interval accumulation per incoming request. Response bodies SHALL NOT be cloned, drained or rewritten by the timing feature.

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

#### Scenario: Core and Analytics overlap

- **WHEN** a Core call and a DIAL Analytics call are in flight at the same time within one incoming request
- **THEN** `core` and `analytics` each include the shared wall time
- **AND** `chat` equals total minus the union of both intervals, counting the shared time once, and is not negative

#### Scenario: Unmarked outbound fetch

- **WHEN** a request makes a native fetch that is neither the shared Core transport nor the DIAL Analytics transport (themes, OIDC/identity provider or another dependency), even to the same origin
- **THEN** that time is attributed to neither `core` nor `analytics` and remains part of `chat`

### Requirement: Opt-in collection and trace correlation

The feature SHALL be inactive when telemetry is disabled or both metrics and traces are disabled. Metrics SHALL work without trace export. Enabled trace collection SHALL include a request timing span marked `dial.chat.http.request.timing=true` with route/method/outcome and total/Core/Analytics/chat duration attributes in seconds (`dial.chat.http.duration.total`, `.core`, `.analytics`, `.chat`). Request identifiers and trace IDs SHALL NOT be metric labels. The feature SHALL add no response header and SHALL NOT change any response status, header or body.

#### Scenario: Metrics-only deployment

- **WHEN** Prometheus is enabled and traces are disabled
- **THEN** terminal phase metrics are available without a trace collector

#### Scenario: Trace investigation

- **WHEN** request timing spans are exported
- **THEN** Tempo can select one request's timing span and display its four durations with navigation to the whole trace

### Requirement: Whole-period latency dashboard

Dashboard 08 SHALL default to rolling 24 hours and refresh every five minutes. It SHALL expose workload, method, route, outcome and transport filters, defaulting to ordinary requests, and tables/rankings for ended-request count, weighted mean duration, p95/p99, Core/Analytics/outside-upstream means and Core share, and counts/shares above 5 and 60 seconds. Queries SHALL use only the new timing population, apply increase before aggregation, preserve missing samples and reject zero denominators. Quantiles beyond the 3600-second finite bucket SHALL be omitted. An optional Tempo table SHALL show matching individual slow requests, including their Analytics duration, and trace links while disclosing sampling/search limits and separate trace filters. The dashboard SHALL state that Core and Analytics overlap counts in both components.

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

#### Scenario: Analytics series absent during a rolling deploy

- **WHEN** some replicas in the selected interval run a version that emits no `analytics` phase
- **THEN** mean Analytics time is shown only from the replicas that emit it and is not displayed as zero for endpoints with no Analytics observations

## ADDED Requirements

### Requirement: Overlap-safe DIAL Analytics attribution

Analytics time SHALL be the union of request-local wire intervals observed through the shared DIAL Analytics transport owned by `DialAnalyticsClientService` in `apps/chat-api/src/dial/dial-analytics-client.service.ts`, from outgoing request creation through body completion, failure or cancellation, clipped at the incoming request's terminal time. Attribution SHALL NOT alter that transport's timeout, redirect, User-Agent, logging or error-body handling.

#### Scenario: Concurrent Analytics calls

- **WHEN** two DIAL Analytics calls overlap within one incoming request, as usage-history schema discovery and its queries do
- **THEN** the overlap counts once in `analytics`, which cannot exceed total
- **AND** neither call adds to `core`

#### Scenario: Usage history request

- **WHEN** `GET /api/v1/user/usage/history` completes after waiting on DIAL Analytics and making no Core call
- **THEN** `analytics` is greater than zero, `core` is zero and `chat` equals total minus `analytics`

#### Scenario: Failed call with a cancelled error body

- **WHEN** DIAL Analytics answers a non-2xx status and the transport cancels the error body unread
- **THEN** the Analytics interval ends no later than that cancellation and does not run on to the incoming request's settlement

#### Scenario: Timed-out or caller-aborted call

- **WHEN** a DIAL Analytics call is aborted by `ANALYTICS_TIMEOUT_MS` or by the caller's signal
- **THEN** its interval ends at the abort

#### Scenario: Call still open at settlement

- **WHEN** the incoming response settles while a DIAL Analytics call is still in flight
- **THEN** `analytics` is clipped at settlement and the later completion does not change the recorded observation
