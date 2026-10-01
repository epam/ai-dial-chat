## 1. Presentation slice

Strategy: one vertical dashboard/documentation slice, preserving metric semantics.

- [x] 1.1 Update `docs/examples/dashboards/06-bff-endpoint-traffic.json`: visible area/count/share
      table, full count formatting, compact layout, manual top-ten labels, and labeled symlog trend.
      Verification: render with synthetic metrics in local Grafana 12.0.1; inspect labels, long
      endpoints, spikes, and native narrow-screen layout. Check changed area queries with promtool.
- [x] 1.2 Update `docs/observability.md` and `bff-observability-local/bff-observability-plan.md`
      for the presentation and dashboard inventory changes. Verification: `npm run validate:docs`.

## 2. Final verification

- [x] 2.1 Validate JSON, formatting, OpenSpec, and diff; review query boundaries and screenshots.
      Remove temporary preview containers/network/browser afterward. Record local visual evidence
      separately from live deployment. No application Vitest/build checks apply to this JSON/docs slice.

Evidence: Prometheus promtool 3.5.0 passed 43 assertions across six synthetic scenarios.
Grafana 12.0.1 rendered synthetic metrics at 1920, 1280, 900, and 360 px, including long
routes, more than twenty areas, zero rates, and a large spike. Tables scroll internally on
narrow screens; no page-wide horizontal overflow was observed. Temporary containers, network,
and isolated browser were removed. This is local rendering evidence, not a live deployment.

Self-review found no blocking correctness, readability, architecture, security, performance,
or documentation issues. Existing metric queries and filters are preserved; one area-count
query is added. Native Grafana panels own keyboard interaction and responsive stacking.
Documentation validation, strict OpenSpec validation, JSON structure, inventory, and formatting
checks passed. No backend instrumentation or remote dashboard mutation was performed.
