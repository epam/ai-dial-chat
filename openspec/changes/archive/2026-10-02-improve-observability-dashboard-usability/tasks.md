## 1. HTTP diagnostic slice

Strategy: vertical dashboard groups; verify preserved queries and rendering before completion.
This change contains Grafana JSON and documentation only, so application Vitest/build targets
do not apply. Query evaluation and native rendering are the relevant verification.

- [x] 1.1 Update `docs/examples/dashboards/00-bff-overview-http.json` and
      `01-bff-http-handlers.json` with summaries, sections, snapshot rankings, and scrape states.
      Verification: compare retained queries and filters; evaluate PromQL in Prometheus;
      render long endpoint names, missing data, and scrape states in local Grafana 12.0.1.

## 2. Generation and runtime slice

- [x] 2.1 Update `docs/examples/dashboards/02-bff-conversation-generations.json`,
      `03-bff-routing-streaming.json`, and `04-runtime-diagnostics.json` with summaries,
      focused sections, and separate memory-kind panels.
      Verification: evaluate counters and memory selectors with multiple replicas and missing
      series; render summaries, identities, and unstacked memory in local Grafana.

## 3. Authentication slice

- [x] 3.1 Update `docs/examples/dashboards/05-bff-auth-sessions.json` with authentication-stage
      sections, summaries, and rejection snapshot table.
      Verification: preserve provider filter exceptions and ratio populations; render all stages.

## 4. Documentation and quality

- [x] 4.1 Update `docs/observability.md` and local `bff-observability-local/bff-observability-plan.md`
      with the reading guide, time scopes, memory layout, and query inventory.
      Verification: `npm run validate:docs`, strict OpenSpec validation, formatting, and diff checks.
- [x] 4.2 Complete five-axis review and browser checks at 360, 900, 1280, and 1920 px.
      Record synthetic evidence and remove temporary containers, network, and isolated browser.

See [verification.md](verification.md) for results and the pre-existing Grafana toolbar limitation.
