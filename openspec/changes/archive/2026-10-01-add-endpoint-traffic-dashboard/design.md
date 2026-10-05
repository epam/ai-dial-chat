## Context

The user wants to understand feature usage. Existing transport observations contain bounded
method and route labels at settlement, not user actions or route-level request starts.
`docs/observability.md` owns the metric contract; dashboard 00 is the import/configuration model.
The user explicitly chose existing metrics now and a future request-start counter in the local plan.

## Goals / Non-Goals

**Goals:** Compare API areas and endpoints over a chosen period, inspect request frequency, and
make low-volume endpoints accessible through a complete table and filters.

**Non-goals:** Unique users, feature adoption percentages, successful business actions, browser
analytics, exact audit counts, new instruments, infrastructure monitoring, or live deployment.

## Decisions

1. Use `dial_chat_http_response_duration_count` with all terminal outcomes by default.
   Unlike the legacy handler metric it also covers guarded-route rejections. It counts an SSE
   request only when its transport ends. Do not combine it with arrivals or handler counts.
2. Include all matched route templates and derive `api_area` from the first segment after `/vN/`,
   falling back to `unversioned` for other matched routes. Preserve the route prefix, version,
   and method in endpoint identities. This avoids a hand-maintained controller inventory and
   excludes unmatched traffic. API areas are a secondary summary, not a product-feature taxonomy.
3. Reuse datasource/cluster/namespace/job/pod selectors; add method, route, and terminal
   outcome. Use existing Grafana regex
   interpolation for multi-value selectors. Filter state belongs to Grafana, not React.
4. Default to the last 24 hours and a five-minute refresh for usage analysis. Use `increase`
   for approximate period totals and their shares, and `rate * 60` for requests/minute. Apply
   counter functions per original series before aggregating to handle per-process resets.
5. Select the trend's top ten once from period totals using an `@` modifier pinned to the
   selected range end, then intersect per-endpoint rates with that set. Bar and graph use the
   same ranking window. The full table has no top-k restriction; selecting a route exposes it
   in both charts. Do not mask absent data with `or vector(0)`.
6. Use built-in stat, bar-gauge, time-series, and table panels, including textual values and
   legends so color is not the sole encoding. Grafana supplies keyboard/table controls and
   responsive layout; there is no custom HTML/CSS, React localization, direction logic, or plugin.

PromQL semantics follow [Prometheus functions](https://prometheus.io/docs/prometheus/latest/querying/functions/)
and [query modifiers](https://prometheus.io/docs/prometheus/latest/querying/basics/#modifier).
Table composition follows [Grafana transformations](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/query-transform-data/transform-data/).

## Risks / Trade-offs

- API calls can be polling, retries, automatic reads, or failed attempts → show this on the
  dashboard and guide; no unique-user/adoption claims. A route without a recorded series is
  not proof a feature is unused.
- Streaming counts lag opening → label panels as ended requests and keep request-start
  instrumentation as explicit P1 follow-up.
- `increase` extrapolates and can be fractional; first scrape and gaps limit accuracy → label
  period totals as estimates, retain decimals, and document missing samples.
- Duplicate scrape jobs inflate totals → retain deployment filters and scope guidance.
- Large ranges cost more to query → bounded route labels, instant period summaries, five-minute
  refresh, and only ten trend lines. No recording rules or deployment dependencies are added.
- Live Grafana/Prometheus may be inaccessible → distinguish static/query validation from live
  rendering and production evidence in the completion report.

## Migration Plan

Import the new JSON and select the application Prometheus source. No backend rollout is needed.
Rollback removes the imported dashboard and additive repository artifacts. Existing dashboards
and telemetry contracts stay compatible. Maintain canonical JSON directly, not via the historical
git-excluded generator.

## Open Questions

Live workload labels, collection coverage, and final rendering must be verified in the deployment.
The separate route-start instrumentation task must define pre-routing/unmatched rejection coverage
before implementation; it is not solved by this dashboard.
