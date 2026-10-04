## Why

### Problem

Dashboards 00–05 present long grids of similarly weighted charts and dense interpretation notes.
Route rankings change membership across the graph, while runtime memory mixes overlapping kinds
and replicas in one plot. Operators cannot quickly identify the relevant signal or its time scope.

### Solution

Give each dashboard a concise reading guide, summary cards, named diagnostic sections, and
readable comparisons, using the native Grafana panels already used in dashboard 06.

## What Changes

- Improve all six existing operational dashboards, preserving instrument and filter boundaries.
- Add explicitly labeled period totals and end-of-range gauge summaries from existing metrics.
- Present route/rejection rankings as sortable snapshots at the selected range end.
- Separate the five memory kinds into unstacked charts and make scrape states readable.
- Retain detailed measurement caveats in panel descriptions and the observability guide.
- Validate queries and native Grafana 12.0.1 rendering on synthetic data.

### Non-goals

Backend instrumentation, new data sources or plugins, alert thresholds, production dashboard
writes, and changes to dashboard 06 are outside this change. No app UI or shared libraries change.

### Acceptance criteria

Every dashboard states what it measures and exposes a useful summary. Ranking rows keep names
and numeric values together. Snapshot time and period totals are distinct. No-data stays missing;
process identity, quantile guards, scope filters, and outcome denominators remain intact.

## Capabilities

### New Capabilities

- `observability-dashboard-usability`: Readable operational dashboards with explicit time scopes
  and verified interpretation boundaries.

### Modified Capabilities

None. Existing telemetry instruments and the endpoint-usage contract remain unchanged.

## Impact

Edit `docs/examples/dashboards/00-05*.json`, `docs/observability.md`, and the local observability
roadmap. Follow `docs/examples/dashboards/06-bff-endpoint-traffic.json:1` for portable native
panels and missing-data behavior. Existing `00-bff-overview-http.json` route/filter exceptions
remain authoritative. Grafana owns state, keyboard interaction, localization, and responsive
layout; English example labels do not introduce app i18n keys.

Alternatives: title-only edits leave overloaded comparisons intact; replacing Grafana with a
custom UI adds ownership and dependencies. Native sections, summaries, and tables provide the
needed improvement with bounded extra queries. Importing the prior JSON restores presentation;
use the existing dashboard UID when updating an import.
