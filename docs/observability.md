# Backend observability

The NestJS backend exports OpenTelemetry metrics, traces, and logs. This guide describes the
implemented signals, the supplied Grafana examples, and the limits of each measurement. The
[backend README](../apps/chat-api/README.md#observability) is the reference for all telemetry
environment variables and defaults.

## Enable collection

Telemetry is disabled by default. To expose metrics without exporting traces or logs, set these
variables on the backend process and restart it:

```dotenv
OTEL_SDK_DISABLED=false
OTEL_METRICS_EXPORTER=prometheus
OTEL_TRACES_EXPORTER=none
OTEL_LOGS_EXPORTER=none
```

The Prometheus exporter serves `http://127.0.0.1:9464/metrics` in the same process as Nest, on a
separate listener. Check it from the process or pod's network namespace:

```bash
curl http://127.0.0.1:9464/metrics
```

For a scraper outside that namespace, set `OTEL_EXPORTER_PROMETHEUS_HOST=0.0.0.0` and configure
the deployment to scrape port `9464`, path `/metrics`. This listener is unauthenticated and does
not inherit the application's authentication, CORS, or rate limits; restrict access through the
deployment's network controls. Enabling the exporter does not create a Prometheus scrape target
or a Grafana data source.

The existing OTLP path is an alternative for deployments that already use a collector:

```dotenv
OTEL_SDK_DISABLED=false
OTEL_METRICS_EXPORTER=otlp
OTEL_TRACES_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
```

Replace the example collector address with the deployment's endpoint. The installed
`*-otlp-http` exporters send OTLP over HTTP/JSON (`Content-Type: application/json`);
the application does not support switching these exporters to protobuf or gRPC with
`OTEL_EXPORTER_OTLP_PROTOCOL`. Per-signal endpoints and other supported settings are documented
in the README. `OTEL_METRICS_EXPORTER=otlp,prometheus` enables both metric paths, which is useful
for checking local exposition while retaining collector export. Avoid ingesting both paths as
duplicate copies of the same process metrics. Collector transformations may change metric names
or labels, so verify them before using the supplied Prometheus queries unchanged.

The SDK starts before application imports. Runtime callbacks are registered only after startup
when metrics are enabled, run during metric collection, and are removed on shutdown. There is
no additional runtime sampling timer. See [SDK bootstrap](../apps/chat-api/src/telemetry/otel-sdk.ts)
and [configuration parsing](../apps/chat-api/src/telemetry/otel-config.ts).

## Import the dashboard examples

The repository includes standalone dashboard JSON files. They contain queries against existing
application metrics; importing them does not install exporters, alerts, collectors, or platform
integrations.

| Example                                                                                   | What it shows                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [00 — HTTP overview](examples/dashboards/00-bff-overview-http.json)                       | Observed request arrivals, in-flight requests, terminal HTTP outcomes and statuses, ordinary-request latency, route comparisons, streaming transport duration, scrape health, and optional trace navigation. |
| [01 — HTTP handlers](examples/dashboards/01-bff-http-handlers.json)                       | The existing Nest interceptor's handler measurements, with their narrower coverage and mean latency.                                                                                                         |
| [02 — Conversation generations](examples/dashboards/02-bff-conversation-generations.json) | Recorded generation outcomes, upstream relay duration, and time to first visible text delta.                                                                                                                 |
| [03 — Routing and streaming](examples/dashboards/03-bff-routing-streaming.json)           | Capability resolution, selected generation API, and unrecognized Responses stream events.                                                                                                                    |
| [04 — Runtime diagnostics](examples/dashboards/04-runtime-diagnostics.json)               | Process memory, outstanding SSE operations, and retained generation registry entries, in three separate time-series panels.                                                                                  |

In Grafana, open **Dashboards → New → Import**, upload or paste a JSON file, select the
Prometheus data source containing the backend metrics, and import it. Repeat for the examples
you need. Grafana documents this flow in [Import dashboards](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/import-dashboards/).
Maintain these examples by editing the version-controlled JSON directly.

Configure the dashboard variables before interpreting the panels:

| Variable                             | Configuration and scope                                                                                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `datasource`                         | The Prometheus data source selected during import.                                                                                                                                                                                                           |
| `cluster`, `namespace`, `job`, `pod` | Deployment labels supplied by scraping or collection. Select the backend workload and its metric job. The application does not add these Kubernetes labels. `All` uses a regex matcher and can include series without the selected label.                    |
| `http_route`, `http_method`          | HTTP filters where present. In dashboard 00, route applies to terminal measurements only: arrival and active instruments have no route label. Method values come from the arrival counter, independently of the route selection.                             |
| `route`, `method`                    | Dashboard 01's filters for the legacy handler histogram; its method choices are scoped to the selected route.                                                                                                                                                |
| `generation_api`                     | Generation API filter where present. Capability-resolution failures have no API label and are intentionally queried separately.                                                                                                                              |
| `scrape_job`                         | Dashboard 00's explicit Prometheus job for scrape health. Replace `__configure_bff_scrape_job__` with the exact backend scrape job. The `up` query uses this value instead of the application-metric `job` selection, and ignores HTTP route/method filters. |
| `tempo_datasource`, `trace_service`  | Optional Tempo data source and actual OpenTelemetry `service.name` for dashboard 00's trace link. The default service name is `@epam/chat-api`; use the deployment's `OTEL_SERVICE_NAME` override when configured.                                           |

Variable choices are derived from application series and are not a complete inventory of desired
or unavailable pods. The examples assume the application's emitted scope label
`otel_scope_name="dial-chat-api"` is preserved. This meter scope is different from the trace
resource's `service.name`. Scope and package versions are not a reliable deployed release tag.
If a collector changes these labels, adjust the JSON selectors and variable queries together.

The runtime memory panel uses bytes and leaves stacking disabled. Its five series overlap and
must remain separate. Multi-value variables use regex selectors; preserve that behavior when
adapting the queries. See [Prometheus template variables](https://grafana.com/docs/grafana/latest/datasources/prometheus/template-variables/).

## Metric contracts

The tables below use the names produced by the application's pinned Prometheus exporter.
Dots in instrument and attribute names become underscores. Counters receive `_total`, and
histograms produce `_bucket`, `_sum`, and `_count` series. This exporter does **not** add a
`_bytes` or `_seconds` suffix for units. Histograms also have an `le` bucket label; exporter
scope labels and deployment-added labels are additional to the application labels listed here.

### HTTP transport lifecycle

| OpenTelemetry instrument           | Prometheus family                                     | Type / unit                                                | Application labels                                                                                                                   |
| ---------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `dial.chat.http.requests.started`  | `dial_chat_http_requests_started_total`               | Counter / requests (`{request}`)                           | `http_request_method`                                                                                                                |
| `dial.chat.http.requests.active`   | `dial_chat_http_requests_active`                      | UpDownCounter, exposed as a gauge / requests (`{request}`) | `http_request_method`                                                                                                                |
| `dial.chat.http.response.duration` | `dial_chat_http_response_duration_{bucket,sum,count}` | Histogram / seconds (`s`)                                  | `http_request_method`, `http_route`, `dial_chat_http_outcome`, `dial_chat_http_transport_kind`, optional `http_response_status_code` |
| `http.server.request.duration`     | `http_server_request_duration_{bucket,sum,count}`     | Histogram / seconds (`s`)                                  | `http_request_method`, `http_route`, `http_response_status_code`                                                                     |

The first three instruments observe the main application's Node HTTP server. The arrival counter
increments and the active count increases when the monitoring listener receives a `request`
event. The first response `finish`, `close`, or `error`, or request `aborted` or `error`, settles
the observation: it decreases the active count using the same method label and records one
terminal duration. An ordinary request `close` event is not used to infer response completion.

The current listener is appended after Express's registered request listener. Its start timestamp
therefore does not necessarily include all synchronous Express or middleware preprocessing. It
provides transport-level coverage beyond Nest handlers, including guard rejections and requests
without a matched handler, but it is not an ingress timestamp or a guaranteed measurement of all
work before parsing. Traffic rejected by an ingress/WAF, or by Node's HTTP parser before a
`request` event, is outside its scope. See the [listener](../apps/chat-api/src/telemetry/http-lifecycle-listener.ts)
and [application bootstrap](../apps/chat-api/src/main.ts).

The shared [exclusion predicate](../apps/chat-api/src/telemetry/excluded-paths.ts) matches exactly
`/api/health` and `/metrics`. The lifecycle listener applies it to the raw request URL, so query
strings or changed prefixes are not normalized into an exclusion. The separate Prometheus
listener is outside the monitored application server.

Methods are bounded to `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`, and `OPTIONS`; other
methods use `unknown`. Routes are resolved at settlement from the matched Express route
template, otherwise `unmatched`. Static delivery, preflight responses, and parser or middleware
responses can lack a route template; `unmatched` is not synonymous with HTTP 404. No raw URL,
query string, user ID, or conversation ID is an HTTP metric label.

| `dial_chat_http_outcome`  | Meaning                                                                                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `completed`               | The response emitted `finish`. This includes HTTP 4xx and 5xx responses; it means the server finished writing, not that the browser received the response or the business operation succeeded. |
| `aborted_before_response` | A close or abort was observed before headers were sent. The status label is omitted rather than reported as a default 200.                                                                     |
| `aborted_during_response` | A close or abort was observed after headers were sent, before another event settled the observation.                                                                                           |
| `error`                   | A request or response error settled the observation first.                                                                                                                                     |

The first terminal event determines the outcome; it does not by itself identify which peer
caused a failure. `http_response_status_code` is present only when headers have been sent.
An SSE response can retain HTTP 200 while reporting an in-band generation error.

`dial_chat_http_transport_kind` is `streaming` for these exact route templates:

- `/api/v1/conversations/completions`
- `/api/v1/conversations/completions/attach`
- `/api/v1/conversations/watch`
- `/api/v1/client-channel/subscribe`

It is `unmatched` for an unmatched route and `ordinary` for other matched routes. The separate
`/api/v1/chat/completions` endpoint returns a parsed response and is ordinary. The streaming list
is fixed: a different `API_PREFIX` or another streaming route requires updating the classifier
to receive the streaming label. See [HTTP instruments and classification](../apps/chat-api/src/telemetry/http-lifecycle-metrics.ts).

The existing `http_server_request_duration` histogram is measured by the
[Nest interceptor](../apps/chat-api/src/common/interceptors/metrics.interceptor.ts), after guards.
It observes handler execution and errors from the downstream Nest pipeline, including pipes;
guard rejections, earlier middleware failures, and requests that never reach the interceptor are
absent. Its exception status can differ from the already-sent wire status. Completion handlers
may continue generation and finalization after the HTTP client disconnects, while attachment
handlers return after setup even though the subscription remains active. Do not combine this
histogram's counts or durations with the transport histogram as if they measured one population.

### Conversation generation measurements

| OpenTelemetry instrument              | Prometheus family                                   | Type / unit                       | Application labels                              |
| ------------------------------------- | --------------------------------------------------- | --------------------------------- | ----------------------------------------------- |
| `generation.requests`                 | `generation_requests_total`                         | Counter / count, no declared unit | `generation_api`, `outcome`                     |
| `generation.time_to_first_delta`      | `generation_time_to_first_delta_{bucket,sum,count}` | Histogram / seconds (`s`)         | `generation_api`                                |
| `generation.stream_duration`          | `generation_stream_duration_{bucket,sum,count}`     | Histogram / seconds (`s`)         | `generation_api`, `outcome`                     |
| `generation.capability_resolution`    | `generation_capability_resolution_total`            | Counter / count, no declared unit | `outcome`; `generation_api` only for `resolved` |
| `generation.responses.unknown_events` | `generation_responses_unknown_events_total`         | Counter / count, no declared unit | `event_type`                                    |

`generation_api` is `responses` or `chat_completions`. These instruments belong to the
conversation generation pipeline, not every request to the separate `/chat/completions`
endpoint. They carry no model or deployment identifier or deployment-type label. Instrument
definitions are in [generation metrics](../apps/chat-api/src/conversations/generation/generation-metrics.ts);
recording occurs in the [streaming service](../apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts).

Despite its name, `generation_requests_total` counts observed **relay terminal outcomes**, not
generation arrivals. Recording happens before final persistence. It excludes failures before
the relay is started and does not turn a later persistence failure into a generation error.
`completed` means the adapter classified the upstream relay as completed; `rejected` means an
unacceptable upstream response or missing body; `error` includes stream/protocol failures and
in-band errors; `aborted` combines user stop, timeout, shutdown, and other abort causes. It cannot
be interpreted as a user-cancellation counter. The Chat Completions adapter can classify a clean
EOF as completed without `[DONE]`; the Responses adapter requires its recognized success
terminal event.

Time to first delta starts just before the upstream generation call, after capability lookup,
history loading, and preflight work. It ends at the first nonempty visible text delta and is
recorded only when the relay terminates, if such text was seen. It excludes tool-only and other
non-text output. It is neither browser-perceived latency nor a model's internal time to first
token, and it has no outcome label. Stream duration covers the same upstream call through relay
termination, before persistence. Interrupted HTTP delivery can therefore coexist with a running
generation.

Capability resolution records `resolved` with the selected API, or `failed` without an API label.
Filtering failures by `generation_api` would lose them. Unrecognized Responses events are counted
by a sanitized event type, truncated to 64 characters, without event payloads. The length limit
does not impose a finite bound on the number of distinct event-type values. See the
[Responses adapter](../apps/chat-api/src/conversations/generation/responses.adapter.ts) and
[Responses integration](responses-api-integration.md).

### Process memory and outstanding work

| OpenTelemetry instrument       | Prometheus series              | Type / unit                               | Application labels                                                    |
| ------------------------------ | ------------------------------ | ----------------------------------------- | --------------------------------------------------------------------- |
| `dial.chat.process.memory`     | `dial_chat_process_memory`     | ObservableGauge / bytes (`B`)             | `kind`: `rss`, `heap_used`, `heap_total`, `external`, `array_buffers` |
| `dial.chat.sse.active`         | `dial_chat_sse_active`         | ObservableGauge / count, no declared unit | `kind`: `client_channel`, `conversation_watch`, `generation_attach`   |
| `dial.chat.generations.active` | `dial_chat_generations_active` | ObservableGauge / count, no declared unit | None                                                                  |

One `process.memoryUsage()` call supplies all five memory values per collection in the Node
process serving Nest requests. `heap_used` and `heap_total` describe used and allocated JavaScript
heap. `external` includes native allocations associated with JavaScript objects; `array_buffers`
includes ArrayBuffer, SharedArrayBuffer, and Node Buffer storage and is already part of
`external`. RSS covers the resident process. These measurements overlap: do not sum or stack
them into a total. Pod memory may also include other containers or memory accounted outside the
process. See [Node.js memoryUsage](https://nodejs.org/api/process.html#processmemoryusage).

`client_channel` and `conversation_watch` count from before asynchronous setup until the handler
settles, including pending work after a client disconnect. `generation_attach` counts a
subscription until cleanup, including time after its handler returns. These are outstanding
operations, not a direct count of browser connections. Normal completion-response delivery is
not part of this gauge.

The generation gauge counts entries physically retained in the generation registry, including
stopped or aborted entries awaiting persistence. Completion, error, stale eviction, replacement,
and shutdown release removed entries. Shutdown also emits a stopped terminal event to permit
attachment cleanup. Tasks that outlive removal of their registry entry are outside this count.
The gauges retain only counts, without per-user or per-conversation labels. See
[runtime instruments](../apps/chat-api/src/telemetry/runtime-metrics.ts).

## Read rates, latency, and missing data correctly

Use `rate()` on counters and histogram sums/counts, and read active-operation metrics directly.
In Grafana, `$__rate_interval` must reflect the data source's scrape interval. Rate calculations
need multiple samples; a newly started process may have gauges before usable rates. Counters
and histograms have no series for a label combination before its first recorded event. Runtime
gauges emit explicit zeros for idle operation kinds; the HTTP UpDownCounter first appears for
a method when a request with that method is observed.

Do not turn every absent result into zero with `or vector(0)`: no traffic, an unrecorded outcome,
a missing target, and a wrong selector require different interpretations. Ratio queries in the
examples use zero for an absent error numerator only when the matching total exists, and leave
zero-traffic denominators without a result. A first scrape cannot reconstruct counter changes
that happened before it. A `topk(10, ...)` range query can show more than ten different routes
over the entire selected period because membership changes at each evaluation.

Histogram mean latency is the sum of observed durations divided by their count. For example,
this Grafana query gives the mean upstream relay duration by API and terminal outcome, in
seconds, across selected pods:

```promql
sum by (generation_api, outcome) (
  rate(generation_stream_duration_sum{
    otel_scope_name="dial-chat-api", cluster=~"$cluster", namespace=~"$namespace",
    job=~"$job", pod=~"$pod", generation_api=~"$generation_api"
  }[$__rate_interval])
)
/
(
  sum by (generation_api, outcome) (
    rate(generation_stream_duration_count{
      otel_scope_name="dial-chat-api", cluster=~"$cluster", namespace=~"$namespace",
      job=~"$job", pod=~"$pod", generation_api=~"$generation_api"
    }[$__rate_interval])
  ) > 0
)
```

The transport histogram has explicit finite boundaries, in seconds:

```text
0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 10, 30, 60
```

An additional `+Inf` bucket contains all durations. Aggregate bucket rates by `le` and any
desired grouping before calling `histogram_quantile`; do not average per-pod percentiles.
If a requested quantile falls in the `+Inf` bucket, Prometheus returns the highest finite
boundary, which would misleadingly cap a long tail at 60 seconds. Dashboard 00 suppresses such
ordinary-request quantiles and shows streaming mean duration plus the fraction above 60 seconds
instead. Ordinary 2xx latency is separated from 4xx/5xx latency, and streaming transport duration
includes all terminal outcomes. See [Prometheus histogram quantiles](https://prometheus.io/docs/prometheus/latest/querying/functions/#histogram_quantile).

Queries selecting the last finite bucket use `le=~"60([.]0+)?"`, matching both `60` and `60.0`.
Prometheus 3 normalizes numeric bucket labels during ingestion; matching only `le="60"` can
therefore remove valid series. This matcher does not repair incompatible bucket layouts or all
effects of historical label changes. See the [Prometheus 3 migration guide](https://prometheus.io/docs/prometheus/3.1/migration/#le-and-quantile-label-values).

The handler and generation histograms use the SDK's default boundaries, whose first positive
boundary is 5 seconds. Their subsecond percentiles are too coarse for the supplied dashboards,
which use means. Neither these means nor HTTP transport percentiles measure browser rendering
latency. The transport histogram's boundary contract must remain stable under its existing name;
changing it requires a new family or explicit version to avoid combining incompatible buckets
during a rolling deployment.

## Traces, logs, and platform signals

HTTP and Undici instrumentation create spans and propagate trace context. The backend's
[traceparent middleware](../apps/chat-api/src/telemetry/traceparent.middleware.ts) exposes a
`traceparent` response header when an active valid span context exists. The
[OpenTelemetry logger](../apps/chat-api/src/telemetry/nestjs-otel-logger.ts) preserves console
logging and `LOG_LEVEL` filtering while exporting enabled logs with trace/span context when
available. Export, sampling, collector processing, backend storage, and Grafana data-source
configuration must all be working to find those records. Metrics-only configuration does not
export traces or logs.

Dashboard 00's optional Tempo link opens a **service and time-range search**. The link uses URL
encoding for the `trace_service` substitution, which does not escape the nested query
and Explore JSON. If the configured service name contains quotes or backslashes, customize the
link with the appropriate query and JSON escaping before using it. The application
does not explicitly enrich its server spans with `http.route`; a route label on metrics does not
prove that the same attribute is searchable in traces. Likewise, scrape labels such as pod,
namespace, and cluster are not automatically OTLP resource attributes. The pinned Prometheus
exporter emits no exemplars, so the example does not provide exact metric-point-to-trace
correlation. It includes no Loki query: log backend and indexed-label conventions must be
established by the deployment.

Prometheus `up` measures whether its scrape succeeded, not whether users can use the backend.
Kubernetes readiness/replica and ingress/synthetic availability signals are external prerequisites;
the repository examples do not configure, query, or verify them. Real ingress RPS can differ from
observed application arrivals because traffic may be rejected before reaching Node or may be
generated internally. Use the deployment's verified ingress, Kubernetes, and synthetic-check
contracts when adding availability panels.

## Investigation workflow

1. **Check the collection path.** Confirm the SDK and intended exporters are enabled, read the
   process's `/metrics` listener where applicable, then check the same families in the configured
   Prometheus data source. Inspect actual labels before narrowing dashboard variables. For an
   OTLP-only path, check collector export and any naming transformations.
2. **Separate arrival from settlement.** Compare arrivals, current in-flight requests, and terminal
   outcomes. A long-running stream increases active requests immediately and contributes a
   duration only when it settles. Inspect HTTP statuses and transport outcomes separately.
3. **Separate transport from generation.** Compare completion-route measurements with generation
   outcomes and the registry gauge. HTTP 200 or a finished response does not prove a successful
   generation or completed persistence. An HTTP disconnect can precede background generation
   completion.
4. **Compare memory with outstanding work per pod.** Rising `heap_used` with stable operation
   counts directs investigation toward retained JavaScript objects; rising `external` or
   `array_buffers` directs it toward native allocations or buffers. RSS growth alone does not
   establish a heap leak, and a short growth period can include normal warm-up. These metrics
   help locate the next investigation; they do not identify retaining objects or fix a leak.
5. **Use the matching trace/log pipeline for detail.** Search the actual service and incident time
   range, then inspect exported spans and correlated logs. Treat missing backend data, sampling,
   and absent searchable attributes as collection limits rather than evidence that an operation
   did not occur.
