## Why

### Problem

The HTTP overview mixes operational diagnostics with endpoint traffic. Its busiest-route panel
shows only completed responses and can display more than ten routes as the ranking changes
(`docs/examples/dashboards/00-bff-overview-http.json:814`). Operators need an easy way to see
which functionality is used, using incoming Chat API calls as a proxy, and how traffic changes.

### Solution

Ship a separate Grafana dashboard using existing HTTP transport observations. The user confirmed
that route-level counting at request start remains future work in the local observability plan.

## What Changes

- Add `docs/examples/dashboards/06-bff-endpoint-traffic.json`, following dashboard 00's import,
  data-source, and workload-selector conventions.
- Group routes by API area (conversations, files, share, scheduled-tasks, etc.),
  making the purpose feature-usage investigation rather than infrastructure health.
- Show period totals, average requests/minute, a horizontal top ten, a time graph with fixed
  top-ten membership over the selected period, and a sortable endpoint table.
- Count all selected terminal outcomes using the transport histogram's count, preserving method
  and route template. Explain streaming delay, estimated totals, missing data, and the difference
  between API calls and user actions: polling, retries, and automatic loading contribute too.
- Add import/interpretation guidance to `docs/observability.md` and update the local roadmap.

### Non-goals

No new backend instruments, arrival attribution, outbound/Core/model statistics, app UI,
deployment, alerts, or changes to existing dashboards. No shared libraries or providers change.

### Acceptance criteria

- A standalone JSON can be imported with a selected Prometheus data source.
- Every metric query uses the existing transport count and the same workload and traffic filters.
- Method, route, and outcome filters support narrowing a functional investigation;
  unmatched traffic is outside this dashboard's scope. Non-versioned endpoints are included.
- Rankings and trends use method plus route and preserve a fixed set of at most ten series.
- Failed and aborted requests are included by default; open streams are explicitly not counted yet.
- The full table remains available for routes outside the top ten; missing telemetry is not zero-filled.
- The local plan distinguishes the delivered dashboard from the pending request-start counter.

## Capabilities

### New Capabilities

- `bff-endpoint-traffic-dashboard`: Focused, importable endpoint traffic analysis on existing
  terminal HTTP metrics.

### Modified Capabilities

None. Existing metric and dashboard contracts remain unchanged.

## Impact

Only dashboard/documentation/OpenSpec artifacts and the git-excluded local roadmap change.
Grafana owns filters and time selection; no application context or hook is introduced.
New labels are English, consistent with existing Grafana examples; no React i18n keys change.
Alternatives: reuse dashboard 00 (less focused), or add route-start instrumentation now
(explicitly deferred by the user). Removing the additive JSON and guide entry rolls back the
change without affecting backend behavior or existing imports.
