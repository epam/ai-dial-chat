## 1. Request timing slice

Strategy: risk-first; prove request-local interval attribution and real transport behavior before relying on the dashboard. Backend work follows `apps/chat-api/AGENTS.md`.

- [x] 1.1 Add request-local phase state, terminal middleware, Core diagnostics and shared fetch wiring in `apps/chat-api/src/telemetry/`, `main.ts`, and `dial/dial-client.service.ts`.
      Verification: `npm run test:file -- apps/chat-api/src/telemetry/tests/request-timing-state.spec.ts apps/chat-api/src/telemetry/tests/core-request-timing.spec.ts apps/chat-api/src/dial/tests/dial-client.service.spec.ts`.
- [x] 1.2 Add real HTTP/Nest coverage for overlap, independent requests, delayed body, abort/failure, no-Core, guards, disabled telemetry and post-terminal work.
      Verification: `npm run test:file -- apps/chat-api/src/telemetry/tests/request-timing.integration.spec.ts`; run backend lint/test and build because bootstrap changes.

## 2. Dashboard and documentation slice

- [x] 2.1 Add `docs/examples/dashboards/08-bff-request-latency.json` with period statistics, attribution and optional individual trace results.
      Verification: parse JSON, validate selectors/metric names and period/quantile math, check historical queries and trace query syntax against official documentation.
- [x] 2.2 Update `docs/observability.md` and `docs/architecture.md` with metric boundaries, dashboard use, audit rationale, rollout and interpretation limits.
      Verification: `npm run validate:docs` and `npm run validate:specs`; validate the OpenSpec change.

## 3. Verification and review

- [x] 3.1 Run `npm run verify:changed` after the completed slices and one `npm run verify:full`; record any pre-existing failures and targeted verification evidence.
- [x] 3.2 Review correctness, readability, architecture, security, performance and documentation accuracy; resolve defects before completion.

## Verification evidence

- Backend build, typecheck and lint passed. Full backend suite: 257 files / 5445 tests passed before the final trace regression addition; the revised trace propagation file separately passed both tests, covering inbound/server/timing/Core parentage and a real upstream redirect.
- New deterministic, span and real Nest attribution tests passed, including full body transfer, parallel Core calls, guard rejection, response disconnect, background work, no-Core and disabled telemetry.
- `npm run validate:docs` passed. `npm run validate:specs` on Node 24 passed with zero errors and existing repository warnings. Strict OpenSpec change validation passed.
- Both `verify:changed` and `verify:full` stopped during typecheck dependencies: the existing `scheduled-tasks-consumer-fixture:pack-lib` task cannot install `dompurify@3.4.17` (`ETARGET`). The full repository gate is not green; unrelated dependency versions were not changed.
- Independent five-axis backend/dashboard reviews found no blocking defects. Live Grafana rendering and production telemetry were not inspected.
- Prometheus `promtool` 3.5.0 passed 112 expression expectations across six scenarios covering all 22 dashboard PromQL queries: full-day empty data, multiple pods and a counter reset, workload filtering, zero Core, idle series, tails above the finite bucket, and fixed period top-ten membership despite a later latency spike. Tempo schema, selected fields, conversions and trace links were checked against Grafana's official source.
- After moving the change onto current `development`, backend test, typecheck, lint and build all passed again, as did documentation and spec-reference validation. The synchronized `request-latency-attribution` spec passes strict validation. Full OpenSpec validation reports an existing missing SHALL/MUST keyword in `application-create-api`, outside this change.
