## Context

Audit of the eight canonical dashboards under `docs/examples/dashboards/`:

| Dashboard            | Current purpose                           | Limitation for daily attribution                                   |
| -------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| 00 HTTP overview     | Transport lifecycle, recent route latency | Rankings use the recent rate interval, not the selected period     |
| 01 HTTP handlers     | Nest handler duration/errors              | Starts after guards; includes downstream time                      |
| 02 Generations       | Relay duration and first text delta       | Only generation relay; excludes preflight and terminal persistence |
| 03 Routing/streaming | API selection and event diagnostics       | No dependency latency                                              |
| 04 Runtime           | Memory, SSE and retained generations      | No request timing                                                  |
| 05 Auth/sessions     | Auth outcomes and exchange duration       | No request-local Core attribution                                  |
| 06 Endpoint usage    | Whole-period request counts               | No duration statistics                                             |
| 07 RED               | Rates/errors/recent latency               | Recent rankings; mixes streams and ordinary requests               |

The ignored local generator/copies are historical; committed JSON is authoritative. No production Grafana or Prometheus data was inspected.

Reference patterns: `apps/chat-api/src/telemetry/http-lifecycle-listener.ts:63` for terminal outcomes, `apps/chat-api/src/dial/dial-client.service.ts:49` for the shared Core transport, and `docs/examples/dashboards/06-bff-endpoint-traffic.json:438` for period table queries. Existing histograms have different observation populations and cannot be subtracted.

## Goals / Non-Goals

Goals: daily endpoint counts, means, p95/p99, slow counts; request-local total/Core/outside-Core timing; trace detail for individual slow requests. Preserve normal request/stream behavior and bound metric cardinality.

Non-goals: CPU profiling, measuring execution inside Core, browser latency, an exact request audit log, deploying to a running environment, or redesigning existing dashboards. Grafana configuration has no product i18n/RTL impact or feature-flag/authorization changes.

## Decisions

1. **Separate timing population.** Install middleware before body parsing, cookies, and guards, and end at the first response finish/close/error or request abort/error. Its own histogram uses `phase=total|core|chat`. Keep the old raw listener and histogram unchanged because its start boundary differs. Earliest middleware does not include work before Express reaches it.
2. **Request-local union.** AsyncLocalStorage owns a small per-request state. An active-Core counter accumulates the union of overlapping intervals with a monotonic clock. Freeze at HTTP settlement; later background work contributes nothing. No request, token, URL, or conversation identifier becomes a metric label. Zero-Core requests still emit all three phases.
3. **Observe full wire lifetime.** Tag only the shared `fetchCore` call context; subscribe to Undici request creation, completion/trailers and errors. This covers connection/transfer and streamed bodies without wrapping or draining responses. It avoids the header-only measurement from awaiting fetch. Weakly keyed request state and fixed subscribers keep overhead bounded. Core SDK and raw Core escape hatches already share this transport.
4. **Honest attribution.** Core is time with at least one observed Core request in flight, including network and transfer; local work can overlap it. `chat` is wall time outside these intervals, including IdP/other dependencies, scheduling, serialization and delivery. It is neither CPU nor critical-path causal attribution. Pooling/coalescing may cause other requests to await shared work outside their own Core intervals. True Core processing requires Core-side spans.
5. **New bucket layout.** Use a new metric with finite buckets from 5ms through 3600s. Do not modify released layouts. Suppress quantiles falling in the infinite bucket and provide slow-tail counts/means instead. Record each phase once with the same bounded labels and population.
6. **Whole-period dashboard.** Default rolling 24h, five-minute refresh, ordinary transports. Aggregate per-series increases before ratios/quantiles; group by method and route; retain missing data and zero-denominator gaps. Separate long-lived streams and terminal outcomes using filters. Rank means and accumulated time separately. Histogram percentiles are estimates, not maxima.
7. **Trace detail.** A separate internal timing span owns the same terminal boundary and timing attributes, independently of the auto-instrumented server span's lifecycle. A boolean marker identifies it in Tempo. The optional table selects slow timing spans and links to their traces; sort the returned results by duration and state that sampling/search limits do not guarantee the globally slowest requests.

Undici's documented [diagnostics channels](https://github.com/nodejs/undici/blob/main/docs/docs/api/DiagnosticsChannel.md) distinguish response headers from complete body delivery. Grafana's [TraceQL query documentation](https://grafana.com/docs/tempo/latest/traceql/construct-traceql-queries/) distinguishes span duration from whole-trace duration; the request timing span is the appropriate filter here.

## Risks / Trade-offs

- Added histogram series → bounded route/method/outcome/phase dimensions; no request IDs or raw paths.
- Undici diagnostic contract/runtime compatibility → integration tests with actual fetch and delayed bodies; no response rewriting.
- Background generations and subscriptions → freeze at terminal transport; document open streams and post-disconnect work separately.
- Limited trace search → label results as matching samples, not an exhaustive daily maximum; metrics remain the source for aggregate statistics.
- First deployment/scrape → no historical backfill; low-volume increases remain estimates.

## Migration Plan

Deploy the backend with existing telemetry settings, scrape the new family, and import dashboard 08 with Prometheus and optional Tempo sources. Compare phase counts and total/Core/remainder sums. During rolling deployment the new dashboard covers only upgraded instances; do not combine old total metrics with new component metrics. Roll back by reverting this additive change and removing dashboard 08.

## Open Questions

Deployment-specific data source UIDs, trace sampling and retention are operator configuration. The user confirmed both aggregate statistics and individual slow-call investigation.
