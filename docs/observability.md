# Backend observability

The backend exports OpenTelemetry metrics, traces, and logs. For environment variables and
defaults, see the [backend README](../apps/chat-api/README.md#observability).

## Enable collection

Telemetry is disabled by default. For Prometheus metrics only, restart the backend with:

```dotenv
OTEL_SDK_DISABLED=false
OTEL_METRICS_EXPORTER=prometheus
OTEL_TRACES_EXPORTER=none
OTEL_LOGS_EXPORTER=none
```

Check the separate metrics listener from inside the process or pod's network namespace:

```bash
curl http://127.0.0.1:9464/metrics
```

For an external scraper, set `OTEL_EXPORTER_PROMETHEUS_HOST=0.0.0.0` and configure scraping on
port `9464`, path `/metrics`. This listener is unauthenticated: restrict network access.
The exporter does not create a scrape target or Grafana data source.

For an existing OTLP collector:

```dotenv
OTEL_SDK_DISABLED=false
OTEL_METRICS_EXPORTER=otlp
OTEL_TRACES_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
```

Replace the collector address. These exporters use HTTP/JSON; `OTEL_EXPORTER_OTLP_PROTOCOL`
does not switch them to protobuf or gRPC. `OTEL_METRICS_EXPORTER=otlp,prometheus` enables both
metric paths, but ingesting both copies will double-count the same process.

## Import the dashboard examples

In Grafana, open **Dashboards → New → Import**, upload a JSON file, and select the Prometheus
data source containing the backend metrics. To replace an existing dashboard, use its UID.
Maintain the version-controlled JSON directly.

| Dashboard                                                                                 | Use it for                                                                          |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [00 — HTTP overview](examples/dashboards/00-bff-overview-http.json)                       | Arrivals, in-flight requests, outcomes, latency, route rankings, and scrape health. |
| [01 — HTTP handlers](examples/dashboards/01-bff-http-handlers.json)                       | Nest handler counts, recorded errors, and mean latency.                             |
| [02 — Conversation generations](examples/dashboards/02-bff-conversation-generations.json) | Relay outcomes, duration, and time to first text delta.                             |
| [03 — Routing and streaming](examples/dashboards/03-bff-routing-streaming.json)           | API selection, capability failures, and unknown Responses events.                   |
| [04 — Runtime diagnostics](examples/dashboards/04-runtime-diagnostics.json)               | Memory by kind, SSE operations, and retained generations.                           |
| [05 — Auth and sessions](examples/dashboards/05-bff-auth-sessions.json)                   | Login, callback, refresh, authorization, and logout.                                |
| [06 — Endpoint usage](examples/dashboards/06-bff-endpoint-traffic.json)                   | Calls per method and endpoint over a selected period.                               |
| [07 — RED overview](examples/dashboards/07-bff-red-overview.json)                         | Completed-response rate, error share, and latency, with route rankings.             |
| [08 — Request latency](examples/dashboards/08-bff-request-latency.json)                   | Whole-period slow endpoints, Core/outside-Core timing, and individual slow traces.  |

Select one workload and ingestion path. The queries expect Prometheus exporter names and
`otel_scope_name="dial-chat-api"`; adapt selectors if a collector renames them. Kubernetes labels
come from collection, not the application. Replica panels preserve `cluster`, `namespace`,
`job`, `pod`, and `instance`; aggregate panels combine the selected workload.

| Filter                               | Scope                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Cluster, Namespace, Scrape job, Pod  | Select the backend workload; `All` can include series without that label.                                                                  |
| Method, Route / Endpoint             | Filter supported HTTP panels. In 00, arrivals and in-flight requests ignore Route.                                                         |
| Outcome                              | Filters terminal outcomes in 06.                                                                                                           |
| Generation API                       | Filters generation measurements; registry gauges include all APIs, and capability failures have no API label.                              |
| Identity provider                    | Filters login, callback, and refresh in 05; authorization and logout include all providers. Choices appear after the first login redirect. |
| Scrape health job                    | Separate exact job name for `up` in 00; defaults to `dial-chat-metrics`.                                                                   |
| Trace datasource, Trace service.name | Optional Tempo search in 00; default service is `@epam/chat-api`.                                                                          |

Dashboards 00–05 start with summaries and named sections:

- **In period:** totals or fractions over the selected range; counts are estimates rounded for display.
- **At range end:** instant gauge observations, including for historical ranges.
- **Recent rate / latency tables:** top ten at the range end over `$__rate_interval`, not period counts.
- **Legend:** `Last *` is the last non-null value; `Max` is the maximum displayed value. `Last *` can be stale.

Missing samples remain missing. Percentage axes scale from zero, and tables and legends scroll
inside their panels. Dashboard 00 shows scrape states as Up/Down and keeps trace setup collapsed.

Dashboard 07 includes completed streams and all statuses; its in-flight card ignores Route.
Summary cards and bar rankings use the selected range end. Quantiles above the last finite
60-second bucket are omitted. Use 00 for separate transport classes and aborted outcomes.

### Count requests per endpoint

Open **06 → All endpoints — requests in period**, choose a range, and sort by count. Each row
shows the method, route template, estimated count, average requests/minute, and traffic share.
Parameter values share one route row. Method, Endpoint, and Outcome filters apply to all traffic
panels. The default range is 24 hours with a five-minute refresh.

The top ten and its trend use the whole-period ranking; the full table includes every recorded
endpoint. The trend uses a symmetric logarithmic axis to keep spikes and small rates visible.
The API-area table groups routes by the first segment after `/vN/`; other matched routes are
`unversioned`.

Counts use per-series `increase(dial_chat_http_response_duration_count[...])` before aggregation.
They handle counter resets but remain scrape-based estimates, not an exact audit trail.
A request contributes when its transport **ends**: completed, aborted, and error outcomes count
by default; open SSE connections do not count yet. Unmatched requests are excluded.

Automatic loads, polling, retries, and failed attempts also count. Request volume does not measure
unique users or successful feature adoption; a missing series does not prove zero usage.

### Investigate slow requests over a day

Open **08 — Request latency**. The default is rolling **last 24 hours**, refreshing every five
minutes; select an absolute range for a calendar day. The endpoint tables show count, mean,
p95/p99, Core/outside-Core means, Core share, and counts/shares above duration thresholds.
Rankings by mean duration identify slow endpoints; rankings by accumulated duration identify
where requests spend the most time overall. Method and route template identify each endpoint.
All period statistics use the selected interval, including historical ranges.

The default transport is **ordinary**. Select **streaming** separately for the explicitly
classified SSE routes; long-lived subscriptions measure connection lifetime, which is not
equivalent to a slow REST response. As in the existing classifier, `/chat/completions` is
ordinary even when its payload streams. Counts and durations enter the period when a request
ends; still-open streams are absent. Counts are scrape-based estimates. Percentiles are
histogram estimates and are omitted when they fall beyond the last finite bucket (one hour);
means and slow-tail counts still cover those observations.

**Core** is wall time with at least one outgoing Core request active, including connection,
network, upload and response-body transfer. Parallel calls overlap only once. **Outside Core**
is the remaining wall time: Chat work, other dependencies such as the identity provider,
scheduling and delivery waits. It is not CPU time. Work done locally while Core is active is
part of the Core-active interval; this split does not prove which component caused a delay.
Requests awaiting another request's coalesced work have no separate Core call for that wait.
Measuring processing inside Core itself requires Core-side traces.

Expand the optional **individual slow requests** section and select a Tempo source, service and
minimum duration. Its table shows individual timing spans and their three durations; the span
link opens the corresponding trace. Trace filters are separate from the Prometheus workload,
route and outcome filters. Results are sorted by duration **among returned matches**: sampling,
retention and search limits mean they are not guaranteed to be the globally slowest calls of
the day. Enable trace export and configure Tempo ingestion to populate this section.

Deploy the backend instrumentation before importing 08. During rolling deployment it covers
only upgraded instances, and data accumulates from deployment onward; old metrics cannot
reconstruct the split. Use one ingestion path. Do not combine the new component metrics with
old transport or handler totals, or subtract independently computed percentiles.

The existing dashboards retain distinct purposes: 00/07 show recent operational latency,
01 measures handlers including dependencies, 02 measures generation relays, 03 diagnoses
routing/streaming, 04 shows runtime state, 05 covers auth, and 06 counts endpoint traffic.
Selecting 24 hours in 00/07 does not turn their **recent** route rankings into daily rankings.

### If the scrape-health panel shows No samples

Find the backend's target in Explore and copy its `job` into **Scrape health job**:

```promql
group by (job, pod, instance) (up{namespace="<namespace>"})
```

This job can differ from the application metrics' job. If the target has no Kubernetes labels,
remove those matchers from the panel query. An OTLP/remote-write-only source may have no `up`.
For job names containing quotes, check the escaped matcher in Query Inspector.

### If every panel shows No samples

Run these in the intended data source without dashboard variables:

```promql
dial_chat_generations_active
dial_chat_generations_active{otel_scope_name="dial-chat-api"}
```

The gauge is emitted even with no generations. If both are empty, check exporter, collection,
time range, and metric names. If only the second is empty, inspect the scope label. Then narrow
the dashboard filters. Do not replace missing telemetry with zero.

## Metric contracts

Names below are from the pinned Prometheus exporter: dots become underscores, counters gain
`_total`, and histogram families have `_bucket`, `_sum`, and `_count` series. No unit suffix is
added. Histograms also carry `le`; deployment and exporter scope labels are additional.

### HTTP transport lifecycle

| Prometheus family                                     | Measurement                          | Application labels                                                                                                                   |
| ----------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `dial_chat_http_requests_started_total`               | Observed arrivals                    | `http_request_method`                                                                                                                |
| `dial_chat_http_requests_active`                      | Unsettled HTTP requests              | `http_request_method`                                                                                                                |
| `dial_chat_http_response_duration_{bucket,sum,count}` | Terminal transport duration, seconds | `http_request_method`, `http_route`, `dial_chat_http_outcome`, `dial_chat_http_transport_kind`, optional `http_response_status_code` |
| `http_server_request_duration_{bucket,sum,count}`     | Nest handler duration, seconds       | `http_request_method`, `http_route`, `http_response_status_code`                                                                     |

Transport monitoring starts on Node's `request` event after Express's registered listener.
It covers guard rejections and unmatched requests, but can miss synchronous preprocessing and
traffic rejected before Node emits that event. Exact raw URLs `/api/health` and `/metrics` are
excluded; query strings and changed prefixes are not normalized. The metrics listener is separate.

Routes are matched templates or `unmatched`; unmatched is not synonymous with 404. Methods are
bounded to GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS, or `unknown`. No raw URLs or user IDs
are labels.

| Transport outcome         | Meaning                                                  |
| ------------------------- | -------------------------------------------------------- |
| `completed`               | Response emitted `finish`, including 4xx/5xx.            |
| `aborted_before_response` | Close/abort before headers; no status label.             |
| `aborted_during_response` | Close/abort after headers.                               |
| `error`                   | Request or response error settled the observation first. |

Only the first terminal event counts. Status is present only after headers; HTTP 200 can
accompany an in-band generation error. Completion does not confirm browser delivery.

`streaming` identifies four fixed `/api/v1/` routes: `conversations/completions`,
`conversations/completions/attach`, `conversations/watch`, and `client-channel/subscribe`.
Other matched routes, including `chat/completions`, are `ordinary`. A custom API prefix needs
classifier changes.

The Nest histogram starts after guards and measures handler execution, including downstream
pipeline errors. It omits guard/static responses, and its timing and error status can differ
from transport measurements. Do not merge the two populations.
See [transport instruments](../apps/chat-api/src/telemetry/http-lifecycle-metrics.ts) and the
[handler interceptor](../apps/chat-api/src/common/interceptors/metrics.interceptor.ts).

### Request timing attribution

| Prometheus family                                          | Measurement / labels                                                                                                                                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dial_chat_http_request_phase_duration_{bucket,sum,count}` | Seconds per terminal request; `dial_chat_http_phase` = `total`, `core`, or `chat`, plus the transport duration's method, route, outcome, transport-kind and optional status labels. |

The [timing middleware](../apps/chat-api/src/telemetry/request-timing.ts) starts before cookies,
body parsing and guards and ends at the first finish, close, abort or error. It excludes the
same exact probe URLs as other telemetry. It does not include work before that middleware,
and its population/boundary differs from the raw HTTP listener. All three phases are recorded
together, including zero Core time for requests without Core calls; `total = core + chat`.

The [Core observer](../apps/chat-api/src/telemetry/core-request-timing.ts) tags the shared
`DialClientService.fetchCore` transport, including SDK calls and direct Core escape hatches.
Undici request creation starts an interval; body completion or error ends it. This includes
client queueing/connection establishment and transfer, not just the wait for headers.
Failures before request creation accrue no Core interval. Other upstream fetches are excluded.
The request-local union is clipped at the incoming request's terminal event. Background
generation/persistence after disconnect cannot extend the closed request's timing.

Finite bucket boundaries in seconds are `0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5,
0.75, 1, 2.5, 5, 10, 30, 60, 120, 300, 600, 1800, 3600`. This is a new family; the existing
60-second transport histogram is unchanged. No URL, token, user, conversation or trace ID is
a metric label. Metrics-only collection works without trace export.

When traces are exported, an internal `request.timing METHOD route` span carries
`dial.chat.http.request.timing=true` and `dial.chat.http.duration.total`, `.core`, and `.chat`
attributes in seconds, together with the bounded request attributes. It ends at the same
terminal boundary and parents the handler's downstream spans. Timing collection is inactive
when telemetry is disabled, or when both metric and trace exporters are disabled.

### Conversation generation measurements

| Prometheus family                                   | Measurement / labels                                             |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `generation_requests_total`                         | Relay terminal outcomes; `generation_api`, `outcome`.            |
| `generation_time_to_first_delta_{bucket,sum,count}` | Seconds to first visible text; `generation_api`.                 |
| `generation_stream_duration_{bucket,sum,count}`     | Upstream relay duration in seconds; `generation_api`, `outcome`. |
| `generation_capability_resolution_total`            | `outcome`; `generation_api` only when resolved.                  |
| `generation_responses_unknown_events_total`         | Unrecognized events by sanitized `event_type`.                   |

- These cover conversation generation, not the separate `/chat/completions` endpoint.
  `generation_api` is `responses` or `chat_completions`; there are no model/deployment labels.
- `generation_requests_total` records relay endings **before persistence**, excluding pre-relay
  failures. `aborted` combines stop, timeout, shutdown, and other causes. A completed relay does
  not prove a saved conversation.
- First delta starts before the upstream call, after preflight, and records at relay end only
  if nonempty text appeared. Tool-only output is excluded; this is not browser latency.
- Capability failures have no API label. Unknown-event series appear only after an event;
  an empty panel is normal. Event types are truncated to 64 characters, not a finite allowlist.

Definitions: [generation metrics](../apps/chat-api/src/conversations/generation/generation-metrics.ts).
Adapter behavior: [Responses integration](responses-api-integration.md).

### Authorization and session decisions

| Prometheus family                                     | Measurement / labels                                                        |
| ----------------------------------------------------- | --------------------------------------------------------------------------- |
| `dial_chat_auth_login_started_total`                  | Login redirects issued; `dial_chat_auth_provider`.                          |
| `dial_chat_auth_callback_duration_{bucket,sum,count}` | Callback processing seconds; provider and `dial_chat_auth_outcome`.         |
| `dial_chat_auth_refresh_duration_{bucket,sum,count}`  | Actual refresh exchange seconds; provider and outcome.                      |
| `dial_chat_auth_refresh_coalesced_total`              | Callers joining an in-flight refresh; provider.                             |
| `dial_chat_auth_authorization_total`                  | Guard decisions; `dial_chat_auth_source`, outcome, `dial_chat_auth_reason`. |
| `dial_chat_auth_logout_total`                         | `dial_chat_auth_result` and `dial_chat_auth_revocation`.                    |

- Login starts are redirects, not successful sign-ins. Callback duration excludes time at the
  identity provider. Callbacks/redirects is an approximate funnel, not a success rate.
- Coalesced callers do not add refresh duration observations; coalescing is per pod.
  `race_absorbed` is a recovered rotation race, not refresh success. `session_expired` means
  the exchange finished after the session deadline.
- `SessionGuard` decisions exclude public routes and `OptionalSessionGuard`. Source is
  `cookie`, `header`, or `none`. A `bucket_unavailable` rejection means valid credentials
  with a DIAL Core failure.
- `cookie_cleared` confirms local logout only. Revocation is `success`, `failed`, or
  `not_attempted`; failed revocation does not fail logout.
- These instruments count operations, not active sessions or users. Labels exclude tokens
  and session IDs. Routine successful auth emits metrics without per-event logs.

For bounded outcomes and reasons, see [auth metrics](../apps/chat-api/src/auth/auth-metrics.ts).

### Process memory and outstanding work

| Series                         | Unit / labels                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `dial_chat_process_memory`     | Bytes; `kind` = `rss`, `heap_used`, `heap_total`, `external`, `array_buffers`.    |
| `dial_chat_sse_active`         | Operations; `kind` = `client_channel`, `conversation_watch`, `generation_attach`. |
| `dial_chat_generations_active` | Retained entries; `state` as below.                                               |

Memory kinds overlap: array buffers are part of external memory, and heap total includes heap
used. **Do not sum or stack memory kinds.** Dashboard 04 separates them; its summary sums only
RSS across selected processes. Process RSS is not total pod memory.

SSE counts include asynchronous setup/cleanup, not just connected browsers; ordinary completion
delivery is excluded. Generation counts are process-local registry entries, including preflight,
with all four states emitted even at zero:

| State              | Meaning                                                              |
| ------------------ | -------------------------------------------------------------------- |
| `active`           | Admitted work before cancellation or terminal finalization.          |
| `cancel_requested` | Cancellation requested; the worker still owns the entry.             |
| `finalizing`       | Waiting for the single terminal-save attempt.                        |
| `settling`         | Finalization timeout expired; the write, entry, and snapshot remain. |

State counts are disjoint and can be summed per process. Removing an entry removes its gauge
contribution; a falling count does not prove persistence.

`GENERATION_FINALIZE_TIMEOUT_MS` starts immediately before terminal save. Expiry releases
existing attachment listeners and timers but **does not cancel the write**. The retained key
still rejects another start on the same process with `409` until settlement or restart.
The timeout does not bound preflight or total generation lifetime. Once it has released
subscribers, a later attach to the `settling` entry receives `404` and adds no
`generation_attach` SSE subscription. Maximum duration and stale handling request cancellation
rather than releasing ownership; stale sweeping runs on registration.

There is no distributed lock or cross-pod ownership transfer. Restart clears local ownership
without confirming remote writes. To investigate retained work, inspect states and memory per
pod and read the conversation back from storage after completion, cancellation, or delayed save.
For details, see the [registry contract](../openspec/specs/generation-registry/spec.md),
[persistence contract](../openspec/specs/backend-owned-generation-persistence/spec.md), and
[runtime instruments](../apps/chat-api/src/telemetry/runtime-metrics.ts).

### Completion-response termination

`dial_chat_completion_response_terminations_total` records the originating completion
controller's finalization, with `reason`:

| Reason                   | Meaning                                                   |
| ------------------------ | --------------------------------------------------------- |
| `completed`              | Handler ended the response; may include an in-band error. |
| `client_closed`          | Client close observed.                                    |
| `backpressure_ended`     | Detached response released without forced destruction.    |
| `backpressure_destroyed` | Release used forced destruction.                          |

The handler continues generation and persistence before releasing a detached response.
The 15-second release timeout bounds release only. Attach responses are excluded, and a
preflight disconnect can count as `client_closed`. This is not a successful-stream counter.
The supplied dashboards have no panel for it yet.
See [instrument](../apps/chat-api/src/conversations/streaming/completion-response-metrics.ts)
and [release helper](../apps/chat-api/src/common/utils/sse.ts).

## Read rates, latency, and missing data correctly

- Use `rate()` for counters and histogram sums/counts; read gauges directly. Set the Grafana
  scrape interval correctly so `$__rate_interval` includes enough samples.
- Missing series can mean no recorded event, a new process, or failed collection. Avoid
  unconditional `or vector(0)`. Ratios use zero for missing error numerators only when a total
  exists, and leave zero-traffic denominators empty.
- Mean latency is `sum(rate(duration_sum[...])) / sum(rate(duration_count[...]))`.
  Aggregate histogram buckets by `le` and the desired grouping before calculating percentiles;
  do not average per-pod percentiles.
- Transport and auth histograms end their finite buckets at 60 seconds. Tail quantiles beyond
  that boundary are suppressed; streaming panels use mean duration and the fraction above 60s.
  The matcher `le=~"60([.]0+)?"` handles Prometheus 3's numeric-label normalization.
- Handler and generation histograms use coarse default buckets, so dashboards show means.
  Keep bucket layouts stable under an existing metric name during rolling deployments.

## Traces, logs, and platform signals

HTTP and Undici instrumentation propagate trace context. Responses expose `traceparent` when
an active valid context exists. Enabled exported logs carry trace/span context when available;
console logging and `LOG_LEVEL` filtering remain. Metrics-only setup exports neither traces
nor logs.

Dashboard 00's optional Tempo link searches **service and time range**, not an exact request.
Dashboard 08 additionally searches the explicit request timing spans described above and
links their individual results to traces.
For service names containing quotes or backslashes, customize nested query/JSON escaping.
Metric route and scrape labels are not guaranteed span attributes, and the exporter provides
no exemplars. Log storage and indexed labels must be configured by the deployment.

`up` reports scrape success, not user-visible availability. Use ingress, Kubernetes readiness,
and synthetic checks for availability; those integrations are outside these dashboard examples.
