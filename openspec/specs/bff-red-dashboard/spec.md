# bff-red-dashboard Specification

## Purpose

Provide a portable RED dashboard without exposing installation-specific export data or
misrepresenting existing HTTP transport measurements.

## Requirements

### Requirement: Sanitized portable import

The example SHALL select Prometheus through an import input and dashboard variable.
It SHALL omit original dashboard identity, datasource identity, absolute dates, saved
deployment selections, private URLs, credentials, and user data. The original attachment
SHALL NOT be copied into the repository.

#### Scenario: Import into another Grafana installation

- **WHEN** an operator selects a Prometheus source during import
- **THEN** every metric panel, target, and query variable uses that selection
- **AND** the dashboard opens with a relative six-hour range and no selected deployment.

### Requirement: Explicit RED population

The dashboard SHALL retain the supplied 17-panel Rate / Errors / Duration layout and
existing namespace, job, route, and method filters. RED measurements SHALL describe completed
transports, including streams and all statuses. In-flight measurements SHALL state that
Route does not apply. Native Grafana SHALL own state, keyboard controls, tooltips, loading,
error display, and responsive/direction behavior; no app i18n keys or styles are introduced.
The example introduces no backend API, cache, feature flag, memoization, or instrumentation.

#### Scenario: Inspect a completed stream

- **WHEN** a selected streaming response finishes
- **THEN** its completed transport measurement contributes to RED panels
- **AND** the descriptions do not claim that streaming is excluded.

### Requirement: Honest missing-data and latency behavior

Error ratios SHALL remain absent when their total is absent or zero, while a missing error
series with positive traffic SHALL yield zero. Quantiles SHALL be omitted when they exceed
the last finite 60-second bucket, including for per-route rankings. Summary cards SHALL
evaluate at the selected range end rather than showing an earlier non-null value.

#### Scenario: No completed responses

- **WHEN** the selection has no samples or zero completed-response traffic
- **THEN** the error ratio is missing rather than a fabricated healthy zero.

#### Scenario: Latency exceeds the measurable percentile boundary

- **WHEN** less than the requested quantile fraction fits in the 60-second bucket
- **THEN** that quantile is absent, rather than appearing capped at 60 seconds
- **AND** the corresponding summary does not reuse an earlier valid sample.
