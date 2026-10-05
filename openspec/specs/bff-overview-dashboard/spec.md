# bff-overview-dashboard Specification

## Purpose
Defines the committed, importable Grafana "DIAL BFF - Overview / HTTP" dashboard
(`docs/examples/dashboards/00-bff-overview-http.json`) built on the BFF's HTTP transport metrics,
and the query rules that keep its panels statistically honest.

## Requirements

### Requirement: Importable BFF Overview / HTTP dashboard definition
The repository SHALL commit an importable Grafana dashboard JSON file titled
"DIAL BFF - Overview / HTTP" at `docs/examples/dashboards/00-bff-overview-http.json`, alongside the
other example dashboards in that folder (`01-bff-http-handlers.json` through
`07-bff-red-overview.json`), and link it from `docs/observability.md` and
`apps/chat-api/README.md`. It is a hand-maintained file; no generator script and no git-ignored
local copy exist. It SHALL provide: application-observed arrival RPS and period arrival/ended
counts, completed-response rate by status, 4xx/5xx fractions with a documented denominator,
aborted/failed transport rates, in-flight HTTP request count, mean and p50/p95/p99 latency for
completed 2xx ordinary responses ("Successful ordinary responses — latency") with a separate
4xx/5xx ordinary mean-latency panel, busiest/slowest/error-prone route tables, and streaming panels
split by route and outcome ("Streaming transports — mean duration" and "Streaming transports
ending after 60s — share"). No streaming percentile panel SHALL be shown, because a tail beyond the
largest finite (60s) bucket cannot be located precisely. `01-bff-http-handlers.json` is a separate,
independently maintained handler dashboard in the same folder.

#### Scenario: Dashboard JSON is valid and importable
- **WHEN** `00-bff-overview-http.json` is imported into a Grafana instance matching the target
  version
- **THEN** the import succeeds with no schema errors

#### Scenario: Dashboard is committed and documented
- **WHEN** a reader follows the HTTP overview link in `docs/observability.md` or
  `apps/chat-api/README.md`
- **THEN** it resolves to the tracked file `docs/examples/dashboards/00-bff-overview-http.json`

#### Scenario: Streaming duration has no percentile
- **WHEN** the streaming panels are inspected
- **THEN** they show the mean duration and the share ending after 60s by route/outcome, and no
  streaming `histogram_quantile` panel exists

### Requirement: Percentile latency is computed by aggregating buckets, never averaging per-pod percentiles
Every latency percentile panel in the dashboard SHALL compute `histogram_quantile` over buckets
summed by `le` across the selected scope, and SHALL NOT average or otherwise combine per-pod
percentile values after the fact.

#### Scenario: p95 panel query aggregates before quantile
- **WHEN** the p95 latency panel's query is inspected
- **THEN** it takes the form `histogram_quantile(0.95, sum by (le) (rate(..._bucket[...])))`
- **AND** no panel query averages a `histogram_quantile` result computed per pod

### Requirement: Rate-based panels use rate/increase, never raw counter deltas
Every panel based on a counter instrument (`dial_chat_http_requests_started_total`, `dial_chat_http_response_duration_count`, or any other `_total`/`_count` series) SHALL use `rate()` or `increase()`, correctly handling counter resets, and SHALL NOT subtract raw counter
values across time.

#### Scenario: Arrival RPS uses rate()
- **WHEN** the arrival-RPS panel's query is inspected
- **THEN** it wraps the counter series in `rate(...[$__rate_interval])`

### Requirement: 4xx/5xx fraction denominator is documented and excludes non-completed outcomes
The 4xx/5xx fraction panel(s) SHALL restrict both numerator and denominator to terminal
observations with `dial.chat.http.outcome="completed"`, and the panel description SHALL state
this scope explicitly, so a viewer does not read the fraction as "of all arrived requests."

#### Scenario: Panel description states the denominator
- **WHEN** the 4xx/5xx fraction panel is viewed
- **THEN** its description states that both the numerator and denominator are limited to
  completed responses, excluding aborted or errored transport outcomes

### Requirement: Absent telemetry renders as no data, not a healthy zero
Panels scoped to a specific `job`/`pod` combination (in-flight requests, per-pod latency, or any panel where "no scrape" and "zero traffic" must be visually distinguishable) SHALL NOT apply an `or vector(0)` fallback. `or vector(0)` SHALL be used only where a zero numerator over a present,
non-zero denominator is the correct reading (e.g. an error-rate numerator when overall traffic is
present).

#### Scenario: Stopped scrape shows as a gap
- **WHEN** a pod stops being scraped by Prometheus
- **THEN** its in-flight-requests panel shows a gap for that pod, not a flat zero line

### Requirement: Ordinary and streaming latency are never mixed into one percentile
The dashboard SHALL present ordinary-request latency percentiles filtered to
`dial_chat_http_transport_kind="ordinary"`, and streaming (SSE) transport durations in separate
panels filtered to `dial_chat_http_transport_kind="streaming"`. Neither panel's query
SHALL span both values.

#### Scenario: Streaming route excluded from ordinary percentile
- **WHEN** the ordinary-latency p95 panel's query is inspected
- **THEN** it includes a `dial_chat_http_transport_kind="ordinary"` selector

### Requirement: Configurable datasource, environment, and topology filters
The dashboard SHALL expose Grafana template variables for datasource, cluster, namespace, scrape
job, and pod (`cluster`/`namespace`/`job`/`pod` via `label_values(dial_chat_generations_active{...})`),
and SHALL bound route/method filters to values actually observed by the HTTP instruments
(`http_route` from `dial_chat_http_response_duration_count`, `http_method` from
`dial_chat_http_requests_started_total`) rather than free-text input. It SHALL also expose a
`tempo_datasource` datasource variable and two free-text textbox variables: `trace_service`
(default `@epam/chat-api`, the trace `service.name`) and `scrape_job` (default
`dial-chat-metrics`, the `up` series job used only by the scrape-health panel).

#### Scenario: Route filter is a bounded query variable
- **WHEN** the route template variable is inspected
- **THEN** its query is a `label_values(...)` lookup against `dial_chat_http_response_duration_count`,
  not a free-text field

#### Scenario: Free-text variables are limited to trace service and scrape job
- **WHEN** the dashboard's textbox variables are listed
- **THEN** they are exactly `trace_service` and `scrape_job`

### Requirement: Scrape health is shown without implying platform availability
The dashboard SHALL include a "Collection health — uses the Scrape health job" row containing one
state-timeline panel, "Scrape target status over time", querying
`up{cluster=~"$cluster",namespace=~"$namespace",job="$scrape_job",pod=~"$pod"}`, where
`$scrape_job` is the separate textbox variable rather than the metric `$job` selector. Its
description SHALL state that value 1 means scrape success only, not application or ingress
availability, and that no matching `up` series means unknown/not configured, not healthy. The
dashboard SHALL NOT contain Kubernetes-readiness, available-replica, or synthetic-check panels, and
SHALL NOT query invented metric names, labels, or datasource UIDs.

#### Scenario: Scrape-health panel is correctly labeled
- **WHEN** the "Scrape target status over time" panel is viewed
- **THEN** its description identifies it as Prometheus scrape success only, not application or
  ingress availability

#### Scenario: Scrape health uses the scrape-job variable
- **WHEN** the scrape-health panel's query is inspected
- **THEN** it filters `up` by `job="$scrape_job"`, not `$job`

### Requirement: Trace navigation is a scoped search, not an exact-request link
The dashboard SHALL provide a Grafana data link, titled "Search service traces in this time range
(not an exact request)", on the "Successful ordinary responses — latency" and "Streaming transports
— mean duration" panels, opening a Tempo Explore TraceQL search scoped only by
`resource.service.name = "${trace_service}"` and the current time range (`${__from}`/`${__to}`),
using the `${tempo_datasource}` template variable. The link SHALL NOT filter by `http_route`,
because the app does not set `http.route` on server spans; no `loki_datasource` variable or Loki
navigation exists, and the "Trace search configuration" text panel states both limits. The dashboard SHALL NOT present or imply an exact link from one specific metric
data point to one specific trace, because the currently installed
`@opentelemetry/exporter-prometheus` version emits no exemplar data.

#### Scenario: Data link is scoped, not exact
- **WHEN** the trace-navigation data link is inspected
- **THEN** its target URL is parameterized by `${trace_service}` and the time range only, with no
  route, trace-id, or exemplar-derived value
- **AND** its label or description states it is a search, not a link to one specific request

#### Scenario: Trace datasource is a template variable
- **WHEN** the trace-navigation data link's datasource is inspected
- **THEN** it references `${tempo_datasource}`, not a hardcoded datasource UID
