# observability-dashboard-usability Specification

## Purpose

Make the operational Grafana dashboards readable while preserving metric scope,
time boundaries, missing-data behavior, and process identity.

## Requirements

### Requirement: Readable diagnostic hierarchy

Dashboards 00–05 SHALL provide a concise reading guide, three summary cards, and named sections
for their diagnostic questions. Original measurement caveats SHALL remain available. Grafana
SHALL own filters, loading/error states, keyboard controls, tooltips, and responsive stacking.
Native English example labels introduce no app i18n keys, React state, memoization, cache,
feature flag, API, or direction-specific styling.

#### Scenario: Start an investigation

- **WHEN** an operator opens an operational dashboard
- **THEN** the guide explains its measurement scope and the summary offers immediate context
- **AND** named sections distinguish traffic, outcomes, latency, or process diagnostics.

### Requirement: Explicit time and population boundaries

Counter summary cards SHALL use per-series increases over the selected period before aggregation
and identify counts as estimates. Gauge summaries SHALL be instant observations at the selected
range end. Existing scope labels, filter exceptions, ratio denominators, and quantile guards
SHALL remain intact. Missing data SHALL NOT be replaced by a healthy zero.

#### Scenario: Select a historical period

- **WHEN** the selected range ends in the past
- **THEN** gauge summaries and comparison tables evaluate at that end timestamp
- **AND** counter totals describe the full selected interval, not the latest rate window.

#### Scenario: Select a filter that an instrument cannot support

- **WHEN** a route, generation API, or identity-provider filter cannot apply to a panel
- **THEN** the guide or section explicitly states the exception
- **AND** the query preserves that instrument's actual label boundary.

#### Scenario: Missing or idle telemetry

- **WHEN** a selector has no samples or a ratio denominator is zero
- **THEN** the panel shows missing data rather than claiming a healthy result
- **AND** observed zero gauges remain legitimate zeros.

### Requirement: Readable snapshot rankings

The existing six top-k route/rejection comparisons SHALL use sortable tables with explicit names
and numeric values. They SHALL evaluate the existing ranking expressions once at the selected
range end over the rate interval. Titles, sections, and descriptions SHALL identify this scope.
Detailed trend charts SHALL remain available.

#### Scenario: Changing membership across the range

- **WHEN** different routes enter the top ten at different times
- **THEN** the comparison table contains at most ten rows from the selected end timestamp
- **AND** it does not imply that these are the top ten by full-period count.

### Requirement: Separate process memory kinds and collection states

Runtime diagnostics SHALL display all five memory kinds as separate unstacked charts, preserving
cluster, namespace, job, pod, and instance identity. It SHALL explain that memory kinds overlap.
The overview SHALL render scrape observations as labeled Up/Down states without filling gaps.

#### Scenario: Inspect multiple replicas

- **WHEN** several replicas contribute memory, SSE, or generation-state observations
- **THEN** their identities remain distinguishable
- **AND** memory kinds are not stacked or summed into a fictitious total.

#### Scenario: Scraping stops

- **WHEN** a scrape target stops producing observations
- **THEN** missing observations do not become Up or Down values invented by the dashboard.
