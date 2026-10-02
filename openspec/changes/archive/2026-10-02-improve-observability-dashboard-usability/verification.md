# Verification — 2026-10-02

## Scope and environment

Updated canonical dashboard examples 00–05 and their reading guide. Dashboard 06,
backend instrumentation, and the historical local generator are unchanged.
Validation used Grafana 12.0.1, Prometheus 3.5.0, and an isolated headless Chrome
against loopback-only services on an internal Docker network. No production data
or Grafana instance was modified.

## Query behavior

- Evaluated all 84 target expressions against a real Prometheus TSDB, then repeated
  with an absent cluster: **168 evaluations passed**. Populated results were finite;
  absent selections remained empty instead of becoming healthy zeros.
- Checked **18 summary values** against fixture expectations, including per-series
  counter resets, weighted period fractions, gauge aggregation, and RSS-only sums.
- Compared all **62 original target expressions**: 61 are unchanged; the runtime
  memory target adds its RSS selector, with four additional kind-specific targets.
  Six existing ranking expressions now run as instant table queries.
- Fixtures contained 1,352 series over six hours, two independently named replicas,
  long endpoint labels, 15 routes, both generation APIs, two identity providers,
  a counter reset, and scrape failures and gaps. These synthetic populations are
  independent test inputs, not a model of production traffic.

## Native browser checks

All six dashboards rendered at **360, 900, 1280, and 1920 px**. The desktop pass
scrolled through every diagnostic section to trigger lazy-loaded queries. No query
HTTP errors or JavaScript exceptions occurred; canceled navigation requests were
excluded. Verified summary values, full route columns, numeric units, memory kinds,
authentication stages, and labeled scrape failures with visible gaps.

Mobile summaries stack vertically. Short guides remain visible, and long tables
and legends scroll within their panels. An additional absent-cluster browser check
showed `No samples` in the overview's summaries and charts. Table inspection caught
and fixed units accidentally inherited by numeric HTTP status labels, and the
authentication reason column now expands to use available width.

Known host limitation: at a 900 px viewport, the overview's native Grafana toolbar
overflows with the long absolute historical time range used in this test. The
original dashboard already overflowed by 88 px; the revised one overflowed by
44 px. The data panels fit both versions. No page overflow occurred at 360, 1280,
or 1920 px, or in the other five dashboards at 900 px. This is not a claim of
complete Grafana accessibility or RTL conformance.

## Quality review

- **Correctness:** period totals, range-end snapshots, filter exceptions, ratio
  populations, quantile guards, missing data, and process identities are preserved
  or explicitly identified in titles and descriptions.
- **Readability:** summaries and named sections establish an investigation order;
  recent rankings use tables, percentage axes reveal small changes, and memory
  kinds no longer compete in one chart. Original caveats remain available.
- **Architecture:** native Grafana JSON only; no application or library boundaries,
  generated clients, frontend state, plugins, or dependencies are introduced.
- **Security:** existing datasource variables and query escaping remain intact;
  no credentials or real telemetry are embedded in the examples.
- **Performance:** 18 instant summary queries and four memory queries raise 00–05
  from 62 to 84 targets. Rankings remain limited to ten entries, refresh stays at
  30 seconds, and no production load benchmark is claimed.
- **Documentation:** the observability guide and ignored local plan describe
  snapshot timing, interpretation, memory overlap, and the revised inventory.

## Repository checks

`npm run validate:docs`, strict OpenSpec validation, Prettier, and `git diff --check`
passed. JSON checks confirmed unique panel IDs, non-overlapping grid positions,
three summary cards per dashboard, and unstacked memory panels. Application
builds and unit tests are not applicable to this JSON/documentation-only change.

Temporary Grafana, Prometheus, the internal Docker network, and the isolated test
browser were removed after verification. Synthetic previews and local verification
artifacts remain under `/tmp/dial-dashboard-usability` for this session.

## Documentation cleanup before archive

Reduced `docs/observability.md` from 722 to 309 lines and approximately 6,800 to
2,300 words. Removed repeated caveats, implementation walkthroughs, and duplicated
test procedures. Retained collection setup, all dashboard links, the metric
reference, filter/time boundaries, generation lifecycle limits, and every section
anchor referenced by other repository documents. Documentation validation passed.
