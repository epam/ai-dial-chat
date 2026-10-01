## Why

### Problem

The deployed screenshot shows missing API-area names and a rate spike compressing all ordinary
traffic. The count dashboard needs clearer presentation of which endpoint was called how often.

### Solution

Improve the existing JSON using native Grafana 12.0.1 panels, verified against synthetic data
in a local instance of the deployment's version.

## What Changes

- Replace the unlabeled area gauges with an explicit area/count/share table.
- Keep the endpoint-count table prominent, show readable full counts, and compact the summary.
- Give top-ten bars enough space for labels and place related summaries together.
- Use a clearly labeled symmetric logarithmic rate axis so spikes and ordinary traffic are visible.
- Update the observability guide and local roadmap with the presentation changes and validation.

### Non-goals

No backend metrics, collection boundaries, new dependencies, deployed dashboard writes, or
feature-adoption analytics. Existing method/route/outcome filters and period semantics remain.

### Acceptance criteria

API-area names and numeric counts are visible with many areas; a large spike does not conceal
ordinary traffic; period counts remain estimates; zero-rate observations are supported. Validate
real rendering in local Grafana 12.0.1 and retain correct counter aggregation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bff-endpoint-traffic-dashboard`: Readable counts, labeled area summaries, and spike-tolerant trends.

## Impact

Follow `docs/examples/dashboards/06-bff-endpoint-traffic.json:1` and its existing guide. Only
Grafana JSON, docs, and OpenSpec artifacts change; no app state, API, shared library, or React
i18n keys change. Built-in English Grafana labels follow the existing examples. Compared with
only increasing gauge height, an explicit table keeps category names visible independently of
bar sizing. Reimporting the previous JSON rolls back the presentation without backend changes.
