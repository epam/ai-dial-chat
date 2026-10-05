## ADDED Requirements

### Requirement: Standalone API usage dashboard

The repository SHALL supply `docs/examples/dashboards/06-bff-endpoint-traffic.json`, importable
with built-in Grafana panels and a Prometheus datasource selection. Grafana SHALL own filters
and time selection; no application API, context, hook, cache, feature flag, or dependency is added.
The dashboard SHALL default to 24 hours and a five-minute refresh.

#### Scenario: Import and workload selection

- **WHEN** an operator imports the JSON and selects an application Prometheus source
- **THEN** they can filter by cluster, namespace, scrape job, pod, method, route, and outcome
- **AND** the dashboard uses the existing `dial-chat-api` scope without modifying older dashboards.

### Requirement: Interpret API traffic as a feature-usage proxy

The dashboard SHALL use existing transport histogram counts for matched incoming API routes,
including all terminal outcomes by default. It SHALL derive API area from the segment after
`/vN/` and retain method and complete route template as the endpoint identity. It SHALL visibly
explain that polling, retries, and automatic loading count too, and that these are neither user
counts nor successful product-action counts. Unmatched routes SHALL be excluded. Matched
non-versioned routes SHALL be included and grouped under the `unversioned` API area.

#### Scenario: Investigate a functional area

- **WHEN** an operator selects conversation endpoints
- **THEN** every traffic panel is restricted to those routes and selected methods/outcomes
- **AND** the operator can inspect individual routes in the full table.

#### Scenario: Streaming request remains open

- **WHEN** an SSE request has started but its transport has not ended
- **THEN** the dashboard does not claim to count that invocation yet
- **AND** the scope text states this limitation and distinguishes ended requests from request starts.

### Requirement: Readable rankings and frequency

The dashboard SHALL include period summary cards, ranked API areas, a horizontal top-ten
endpoint ranking, a request-per-minute trend, and a sortable table containing endpoint,
estimated period requests, average requests/minute, and share of the selected traffic.
The table SHALL contain all matching observed endpoints, without a top-k limit. Numeric values
and labels SHALL supplement color; rendering and accessibility use native Grafana controls.
English labels follow the existing Grafana examples; no app i18n or RTL behavior is introduced.

#### Scenario: Ranking changes during the selected period

- **WHEN** more than ten endpoints exchange rank during the period
- **THEN** the trend uses the fixed top ten by total traffic for the entire selected period
- **AND** the endpoint ranking uses the same period and grouping.

#### Scenario: Low-volume endpoint

- **WHEN** an endpoint falls outside the top ten
- **THEN** it remains in the table when its metric is present
- **AND** selecting that route allows its trend to be inspected.

### Requirement: Honest counter aggregation and missing data

Queries SHALL apply `increase` or `rate` before aggregating original series. Totals SHALL be
described as estimates; shares SHALL use the same selected population and a positive denominator.
Missing series SHALL NOT be filled with artificial zeros, or interpreted as unused features.

#### Scenario: Restart and collection gaps

- **WHEN** a pod counter resets or a label combination has insufficient samples
- **THEN** counter reset handling occurs per series before aggregation
- **AND** missing observations remain missing rather than being converted to zero.

### Requirement: Document delivery separately from future instrumentation

The observability guide SHALL link the new dashboard and explain its usage and measurement
limits. The local observability roadmap SHALL record this dashboard as delivered and route-start
counting as pending P1 work with bounded labels, SSE, rejection, and single-count acceptance.

#### Scenario: Review the roadmap

- **WHEN** the operator reads the updated local plan
- **THEN** they can distinguish the available API-usage dashboard from the unimplemented
  route-start instrument and from unverified live Grafana deployment.
