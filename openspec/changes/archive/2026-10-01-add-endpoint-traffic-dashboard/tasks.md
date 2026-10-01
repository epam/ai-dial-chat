## 1. Endpoint usage dashboard

Strategy: one vertical documentation/configuration slice on existing metrics. The primary view
answers method + endpoint + count over the selected period; area grouping is secondary.

- [x] 1.1 Add `docs/examples/dashboards/06-bff-endpoint-traffic.json` with shared selectors,
      summary cards, top-ten counts, a complete sortable count/share/average table, fixed-ranking
      rate trend, and API-area breakdown. Verification: parse JSON, inspect panel/variable
      references and layout, and validate interpolated PromQL including resets and changing ranks
      when an isolated Prometheus tool is available.
- [x] 1.2 Update `docs/observability.md` with the import link and explain period counts, filters,
      streaming timing, API-call vs user-action limits, and absent data. Update
      `bff-observability-local/bff-observability-plan.md` with the delivered dashboard inventory
      and explicit pending P1 request-start counting acceptance. Verification: check links,
      inventory against JSON, and keep the local plan excluded from Git.

## 2. Verification and review

- [x] 2.1 Run `npm run validate:docs`, check new JSON/OpenSpec formatting, validate this
      OpenSpec change, and review the final diff for metric semantics and scope. Record any
      unavailable live validation explicitly. No Vitest files or Nx build/test targets apply:
      no executable application code, packages, HTTP contracts, or library APIs are modified.

Verification evidence (2026-10-01): `promtool` 3.5.0 passed 39 assertions across six synthetic
scenarios, including resets, distinct methods, selected outcomes, matched non-versioned routes,
missing/idle data, and fixed ranking before a late spike. JSON/layout/variable/inventory checks,
Prettier, `npm run validate:docs`, `openspec validate add-endpoint-traffic-dashboard --strict`,
and `git diff --check` passed. Self-review covered query correctness, existing telemetry
boundaries, bounded route labels, query cost, and documentation consistency. The local roadmap
remains Git-excluded. No live Grafana import, visual/mobile rendering, or production verification
was performed.
