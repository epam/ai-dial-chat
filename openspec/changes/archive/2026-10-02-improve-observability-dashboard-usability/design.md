## Context

The six operational JSON examples contain 50 metric panels, six text panels, and 62 queries.
All but runtime begin with a five-unit interpretation block; nearly every metric is a time series.
Six top-k charts can accumulate changing members across a time range. Runtime memory places five
overlapping kinds and all process identities on one chart. Dashboard 06 supplies the native
summary/table pattern already validated with Grafana 12.0.1.

## Goals / Non-Goals

**Goals:** Explain the diagnostic question, distinguish time scopes, make rankings readable, and
preserve existing telemetry semantics and all diagnostic views.

**Non-goals:** Backend changes, instrumentation, alerts/SLOs, Grafana plugins, app UI changes,
production writes, or changes to endpoint-usage dashboard 06.

## Decisions

- Add three compact summary cards per dashboard. Counter totals use per-series `increase`
  over the selected range before summation; fractions retain positive denominators and existing
  conditional zero behavior. Gauge totals are instant observations at the range end. Titles
  distinguish `in period` from `at range end`; counts are estimates rounded only for display.
- Keep existing detailed trend queries unchanged. Shorten panel titles and retain the original
  caveats in descriptions. Use native expanded row sections for traffic, failures, latency,
  route ranking, runtime, and authentication stages. The overview's trace configuration becomes
  an optional collapsed section so it does not compete with HTTP investigation.
- Convert the six existing top-k charts into native sortable instant tables. Preserve their
  expressions, including p95 bucket guards; query the range end over `$__rate_interval` and say
  so explicitly. A table provides a stable ten-row comparison without changing ranking meaning
  to period totals. Full process identity remains in per-replica legends.
- Split runtime memory into RSS, heap used, heap allocated, external, and array-buffer charts.
  Each query adds exactly one `kind` selector. Preserve every process label and disable stacking;
  never sum memory kinds. Keep SSE operations and generation states in their own sections.
- Use neutral summaries without invented healthy/unhealthy thresholds. Scrape health is a state
  timeline with explicit Up/Down labels and gaps for missing samples. Zero-filled telemetry is
  prohibited. Native Grafana loading/errors, tables, tooltips, and keyboard behavior are retained.
- Percentage trend axes start at zero and scale automatically instead of fixing the upper
  limit at 100%, so small error fractions remain visible without clipping larger values.
- Keep six-hour ranges and refresh intervals unchanged. No app state, hooks, i18n keys, RTL styles,
  API/generated client, caching, feature flags, dependencies, or library interfaces are introduced.

## Risks / Trade-offs

- Eighteen new summary queries and four memory-kind queries increase refresh work → use instant
  summaries, retain existing refresh intervals, and document the updated inventory.
- Snapshot rankings no longer show their history → other trend panels remain, and route filters
  support focused investigation; state the snapshot boundary in the section and description.
- Long replica identities and tables on small screens → keep full identity and use native
  scrolling; inspect 360, 900, 1280, and 1920 px without custom Grafana CSS.
- Synthetic evidence cannot verify production collection → label previews and test PromQL
  against real Prometheus separately from presentation.

## Migration Plan

Reimport each revised JSON with its existing dashboard UID. No backend rollout is needed.
Reimport the previous JSON to roll back. The local historical generator remains untouched.
