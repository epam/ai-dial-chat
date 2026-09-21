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
| [05 — Auth and sessions](examples/dashboards/05-bff-auth-sessions.json)                   | Login redirects issued, OIDC callback outcomes and processing latency, refresh-token exchanges and coalesced callers, authorization decisions with bounded rejection reasons, and logout results.            |

In Grafana, open **Dashboards → New → Import**, upload or paste a JSON file, select the
Prometheus data source containing the backend metrics, and import it. Repeat for the examples
you need. Grafana documents this flow in [Import dashboards](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/import-dashboards/).
Maintain these examples by editing the version-controlled JSON directly.

These examples target the series emitted by the BFF's Prometheus `/metrics` listener. When a
deployment has both a scrape data source and an OTLP data source, choose the source containing
those series and their scope labels. An OTLP pipeline can store different metric names or labels,
even when its backend supports PromQL.

Configure the dashboard variables before interpreting the panels:

| Variable                             | Configuration and scope                                                                                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `datasource`                         | The Prometheus data source selected during import.                                                                                                                                                                                                           |
| `cluster`, `namespace`, `job`, `pod` | Deployment labels supplied by scraping or collection. Select the backend workload and its metric job. The application does not add these Kubernetes labels. `All` uses a regex matcher and can include series without the selected label.                    |
| `http_route`, `http_method`          | HTTP filters where present. In dashboard 00, route applies to terminal measurements only: arrival and active instruments have no route label. Method values come from the arrival counter, independently of the route selection.                             |
| `route`, `method`                    | Dashboard 01's filters for the legacy handler histogram; its method choices are scoped to the selected route.                                                                                                                                                |
| `generation_api`                     | Generation API filter where present. Capability-resolution failures have no API label and are intentionally queried separately.                                                                                                                              |
| `auth_provider`                      | Dashboard 05's identity-provider filter. Its values come from the login counter, so the list is empty until the first login redirect. Only the login, callback, and refresh instruments carry that attribute; the authorization and logout panels ignore it. |
| `scrape_job`                         | Dashboard 00's explicit Prometheus job for scrape health. Replace `__configure_bff_scrape_job__` with the exact backend scrape job. The `up` query uses this value instead of the application-metric `job` selection, and ignores HTTP route/method filters. |
| `tempo_datasource`, `trace_service`  | Optional Tempo data source and actual OpenTelemetry `service.name` for dashboard 00's trace link. The default service name is `@epam/chat-api`; use the deployment's `OTEL_SERVICE_NAME` override when configured.                                           |

Variable choices are derived from application series and are not a complete inventory of desired
or unavailable pods. The examples assume the application's emitted scope label
`otel_scope_name="dial-chat-api"` is preserved. This meter scope is different from the trace
resource's `service.name`. Scope and package versions are not a reliable deployed release tag.
If a collector changes these labels, adjust the JSON selectors and variable queries together.

Panels showing individual replicas preserve `cluster`, `namespace`, `job`, `pod`, and `instance`
in their grouping and legends. This keeps identically named pods in different clusters or scrape
targets distinct when selecting multiple values. Aggregated route, outcome, and API panels still
combine the selected workload. Select one collection path to avoid counting duplicate ingestion.
The scrape-health textbox takes one exact job name; its query uses equality and the Prometheus
data source's string escaping so job names containing slashes or dots remain valid.
For job names containing quotes, verify the interpolated query in Query Inspector: Grafana's
legacy formatter requires an appropriate special-character setting or a custom escaped matcher.

The runtime memory panel uses bytes and leaves stacking disabled. Its five series overlap and
must remain separate. Multi-value variables use regex selectors; preserve that behavior when
adapting the queries. See [Prometheus template variables](https://grafana.com/docs/grafana/latest/datasources/prometheus/template-variables/).

### If every panel shows No samples

In Explore, select the intended data source and run these queries without dashboard variables:

```promql
dial_chat_generations_active
```

```promql
dial_chat_generations_active{otel_scope_name="dial-chat-api"}
```

This runtime gauge is emitted even when there are no generations. If the first query is empty,
verify the data source, selected time range, collection health, and metric name. If only the
second query is empty, inspect the actual scope labels. Once both return data, use the same
source in the dashboard and narrow its topology filters. For an OTLP-only deployment, adapt the
queries to the names and labels stored by its collector. Leave missing data visible during this
check; replacing it with zero would hide collection or configuration failures.

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

### Authorization and session decisions

| OpenTelemetry instrument           | Prometheus family                                     | Type / unit                          | Application labels                                                         |
| ---------------------------------- | ----------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| `dial.chat.auth.login.started`     | `dial_chat_auth_login_started_total`                  | Counter / operations (`{operation}`) | `dial_chat_auth_provider`                                                  |
| `dial.chat.auth.callback.duration` | `dial_chat_auth_callback_duration_{bucket,sum,count}` | Histogram / seconds (`s`)            | `dial_chat_auth_provider`, `dial_chat_auth_outcome`                        |
| `dial.chat.auth.refresh.duration`  | `dial_chat_auth_refresh_duration_{bucket,sum,count}`  | Histogram / seconds (`s`)            | `dial_chat_auth_provider`, `dial_chat_auth_outcome`                        |
| `dial.chat.auth.refresh.coalesced` | `dial_chat_auth_refresh_coalesced_total`              | Counter / requests (`{request}`)     | `dial_chat_auth_provider`                                                  |
| `dial.chat.auth.authorization`     | `dial_chat_auth_authorization_total`                  | Counter / requests (`{request}`)     | `dial_chat_auth_source`, `dial_chat_auth_outcome`, `dial_chat_auth_reason` |
| `dial.chat.auth.logout`            | `dial_chat_auth_logout_total`                         | Counter / operations (`{operation}`) | `dial_chat_auth_result`, `dial_chat_auth_revocation`                       |

Instrument definitions, bounded label enums, and the failure classifiers live in
[auth metrics](../apps/chat-api/src/auth/auth-metrics.ts). Recording happens in the
[auth controller](../apps/chat-api/src/auth/auth.controller.ts) (login, callback, logout), the
[refresh service](../apps/chat-api/src/auth/refresh/refresh.service.ts), and the
[session guard](../apps/chat-api/src/auth/session/session.guard.ts).

`dial_chat_auth_provider` is restricted to the provider ids this build can construct
(`AuthProviderId`); any other value, including one supplied in a URL path, is recorded as
`unknown`. No subject, session id, CSRF token, access or refresh token, redirect URL, or
exception message is an auth metric label.

The BFF holds no server-side session state, so none of these instruments is an active-session
gauge and none of them counts users. One browser session produces many authorization decisions
and, over its lifetime, several refresh exchanges.

`dial_chat_auth_login_started_total` increments when the redirect to the identity provider is
actually issued. It is not a count of successful sign-ins: the user may abandon the provider's
pages, and one person can start several logins. A request for an unconfigured provider fails
before the redirect and is visible only in the HTTP metrics, as a 404.

The callback histogram measures the BFF's own callback processing — code exchange, the optional
Keycloak userinfo lookup, the bucket fetch, session encryption, and the redirect. The time the
user spent on the identity provider is outside it, because the BFF only observes the redirect
back. Both histograms use explicit boundaries in seconds:

```text
0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 10, 30, 60
```

The largest finite boundary matches the transport histogram's, so the same `le=~"60([.]0+)?"`
guard applies. That boundary contract is likewise stable under these names.

| `dial_chat_auth_outcome` (callback) | Meaning                                                                                                                                                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `success`                           | A session cookie was issued and the browser was redirected to the application.                                                                                                                           |
| `validation_rejected`               | Refused before the code exchange: a provider-reported error, missing code or state, a missing/expired/unreadable transaction cookie, a state, provider, or issuer mismatch, or an unconfigured provider. |
| `exchange_failed`                   | The authorization-code exchange with the identity provider failed.                                                                                                                                       |
| `internal_error`                    | Any other failure after validation passed — a backend fault, not a rejected request.                                                                                                                     |

Comparing callbacks with login starts is an approximate funnel only. The two events are minutes
apart, can fall in different query windows or land on different replicas, and extra tabs,
retried callbacks, and abandoned logins all move the ratio. It is not a login success rate.

The refresh histogram observes **real token exchanges**, one observation each. A request that
joined an exchange already in flight for the same session on the same pod is counted by
`dial_chat_auth_refresh_coalesced_total` instead and contributes no duration, so the histogram's
count stays equal to the number of exchanges actually performed. That mutex is per pod:
concurrent requests on different replicas each perform their own exchange.

| `dial_chat_auth_outcome` (refresh) | Meaning                                                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `refreshed`                        | The identity provider returned a new token set.                                                                                                                                       |
| `race_absorbed`                    | `invalid_grant` arrived while the access token was still valid — a lost refresh-token rotation race, absorbed without forcing a logout. Neither a refresh success nor a session loss. |
| `invalid_grant`                    | `invalid_grant` with an already-expired access token: the session cannot be recovered.                                                                                                |
| `upstream_error`                   | Any other failure of the exchange, including an unresolvable provider.                                                                                                                |

`dial_chat_auth_authorization_total` counts one `SessionGuard` decision per guarded request.
Routes marked `@Public()` make no authorization decision and are deliberately not counted, so
this counter is not a request counter. `dial_chat_auth_source` is the matching strategy's own
credential source, `cookie` or `header`, or `none` when no strategy claimed the request.
`OptionalSessionGuard` makes no counted decision.

Rejection reasons are derived from the `AuthErrorCode` the strategies already return:
`token_expired`, `token_invalid`, `untrusted_issuer`, `provider_not_found`, and `malformed` for
header bearer tokens, `no_credentials` when nothing was supplied, and `session_invalid` for a
session cookie that could not be decrypted or whose refresh failed unrecoverably.
`bucket_unavailable` is different in kind: the credential was valid and DIAL Core was
unreachable, so it is an upstream failure rather than a rejected caller. `internal_error` marks
an unexpected strategy failure. Accepted decisions carry the reason `accepted`. Some rejections
are expected in normal operation — an expired cookie on a returning tab, or an unauthenticated
first request — so a change in the reason mix is more informative than the rejection level.

`dial_chat_auth_logout_total` records what the BFF did locally and, separately, the outcome of
its best-effort refresh-token revocation. `cookie_cleared` means the session cookie was cleared;
it does not confirm a federated logout at the identity provider, which the redirect to the
end-session endpoint cannot establish either. `header_noop` is a header-authenticated caller with
no session to clear, and `origin_rejected` is a logout refused by the origin check. Revocation is
`success`, `failed`, or `not_attempted` — the last covering no advertised revocation endpoint, no
stored refresh token, an unreadable cookie, and every refused logout. A failed revocation never
fails the logout, so it tracks provider reachability rather than user impact.

Login, callback, refresh, and logout operations happen on routes that are `@Public()`, so their
HTTP responses are counted by the transport instruments while their authorization counterpart
does not exist. Do not reconcile the two families as one population.

### Process memory and outstanding work

| OpenTelemetry instrument       | Prometheus series              | Type / unit                               | Application labels                                                    |
| ------------------------------ | ------------------------------ | ----------------------------------------- | --------------------------------------------------------------------- |
| `dial.chat.process.memory`     | `dial_chat_process_memory`     | ObservableGauge / bytes (`B`)             | `kind`: `rss`, `heap_used`, `heap_total`, `external`, `array_buffers` |
| `dial.chat.sse.active`         | `dial_chat_sse_active`         | ObservableGauge / count, no declared unit | `kind`: `client_channel`, `conversation_watch`, `generation_attach`   |
| `dial.chat.generations.active` | `dial_chat_generations_active` | ObservableGauge / count, no declared unit | `state`: `active`, `cancel_requested`, `finalizing`, `settling`       |

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

The generation gauge counts entries retained by one process, with four `state` series emitted
on every collection, including zero values. Normal completion can move directly from `active`
to `finalizing`; cancellation and a finalization timeout introduce the other states:

| `state`            | Meaning                                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `active`           | An admitted entry before cancellation or terminal finalization, including capability/history lookup and the start-state save. It does not prove that an upstream stream is running.                 |
| `cancel_requested` | User stop, maximum duration, or stale handling requested cancellation. The worker and its registry ownership remain until settlement.                                                               |
| `finalizing`       | The worker entered its single terminal-save attempt and is waiting for it to resolve or reject.                                                                                                     |
| `settling`         | The finalization timeout expired. Existing attachment listeners were notified and removed and timers cleared; the pending write, registry entry, assembled snapshot, and gauge contribution remain. |

`released` is not emitted: releasing a registry key removes that entry's contribution. A normal
settlement follows a resolved or rejected terminal save; preflight failure can release an entry
without a terminal save. Shutdown also clears entries, notifying subscribers when terminal cleanup has not already run,
without waiting for or proving the outcome of an in-flight write. Stale expiry and maximum duration
request cancellation rather than removing entries. The gauge has no cancellation-reason label.
See the [registry implementation](../apps/chat-api/src/conversations/conversation-generation.service.ts)
and [runtime instruments](../apps/chat-api/src/telemetry/runtime-metrics.ts).

The dashboard generation legends include `state`. For a total per scraped process, sum these
mutually exclusive state counts while preserving target identity, for example:

```promql
sum by (cluster, namespace, job, pod, instance) (
  dial_chat_generations_active{otel_scope_name="dial-chat-api"}
)
```

Choose one ingestion path to avoid duplicate counting. Unlike overlapping memory kinds,
generation state counts can be summed. A rolling deployment can contain older unlabeled series;
inspect each process's revision and raw labels before comparing state-specific totals.

**Finalization timeout is a cleanup boundary, not a persistence deadline.**
`GENERATION_FINALIZE_TIMEOUT_MS` starts when `beginFinalizing()` runs immediately before the
terminal-save call. On expiry, a `settling` entry still rejects another start for the same
principal and conversation path **in that process** with `409`. Its write is not cancelled,
retried, or duplicated by this timeout, and the worker and originating completion handler can
remain awaiting it. The timeout does not cover capability/history lookup, the start-state save,
or an upstream operation that does not settle after cancellation. The separate maximum-duration
timer requests cancellation; it is not a hard upper bound on total task lifetime. Defaults are
listed in the [backend environment reference](../apps/chat-api/README.md#environment-variables).

Admission, leases, stop, attach, and these counts are process-local. They provide no distributed
lock, cross-pod ownership transfer, or storage-side fencing. Restart clears the in-memory
registry but does not establish whether an outstanding remote write committed. Recovery of a
retained key occurs when the write settles or the process exits. **A falling gauge, including a
`settling` entry disappearing, never proves durable persistence.** Read the conversation back
from storage to check the expected terminal content.

There is also a current late-attachment limit: `attach()` accepts any retained entry, including
`settling`. An attachment created after the timeout's terminal notification does not receive a
replayed terminal event and is not covered by that already-fired cleanup timer. Do not treat
this timeout as a bound for every future attachment or for all retained memory. The gauges
retain only counts; the registry itself still retains its entry and snapshot. These limits are
separate from the [registry contract](../openspec/specs/generation-registry/spec.md) and
[persistence contract](../openspec/specs/backend-owned-generation-persistence/spec.md).

### Completion-response termination

The originating conversation completion handler records
`dial.chat.completion.response.terminations` (Counter, unit `{response}`), exposed
as `dial_chat_completion_response_terminations_total`. Its only application
attribute is the bounded `reason` value:

| Reason                   | Interpretation                                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `completed`              | The handler ended the response after consuming the generator. This can include a failure after stream headers were committed. |
| `client_closed`          | The handler observed a client close and left the response untouched.                                                          |
| `backpressure_ended`     | The detached response was released without the helper taking its forced-destroy outcome.                                      |
| `backpressure_destroyed` | The release helper took its forced-destroy fallback.                                                                          |

Recording happens in controller finalization, not when backpressure first occurs.
Ordinary pre-stream rejections do not contribute, but an observed disconnect
during a failing preflight can still produce `client_closed`. This counter is
therefore not an exact count of responses that successfully entered streaming.
The controller keeps consuming backend-owned generation and its terminal
persistence attempt before releasing the detached response. The current
`SSE_RELEASE_TIMEOUT_MS` bound is 15 seconds **from the start of response release**;
it does not bound generation or persistence. Attach responses use the same release
helper but do not contribute to this originating-completion counter.

Neither `completed` nor `backpressure_ended` proves successful generation,
successful persistence, or that a browser received all output. A rising
`backpressure_destroyed` rate shows that forced release is being used; it does not
alone establish a leak or an incorrectly configured timeout. Correlate it with
HTTP active requests, terminal transport outcomes and per-process memory.
The existing HTTP active metric counts unfinished response lifecycles; telemetry
does not retain response objects to aggregate their buffered bytes.

The supplied dashboards do not yet include a panel for this counter. See the
[instrument](../apps/chat-api/src/conversations/streaming/completion-response-metrics.ts),
[controller](../apps/chat-api/src/conversations/conversation.controller.ts), and
[release helper](../apps/chat-api/src/common/utils/sse.ts).

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

## Operational validation of generation lifecycle limits

Use controlled traffic and read back the affected conversations. Run each workload separately
so memory and state changes can be attributed to it:

1. **Start and completion** — watch `active` then `finalizing`, and verify release after the
   terminal save settles. A short intermediate state may fall between collection samples.
2. **User stop and maximum duration** — exercise each cancellation cause separately. Check
   `cancel_requested` and finalization, the stored user-stop versus non-user-error marker, and
   that a second start on the same process and key receives `409` while ownership remains.
3. **Reconnect** — watch `dial_chat_sse_active{kind="generation_attach"}` separately from registry
   counts. Include a late attachment after a finalization timeout when evaluating the documented
   late-attachment limitation.
4. **Delayed terminal persistence** — delay a save past `GENERATION_FINALIZE_TIMEOUT_MS` and
   verify that `settling` stays counted, existing subscribers are released, and the same-process
   key remains occupied. Resolve and reject separate controlled writes, then check release and
   storage independently. The timeout must not be interpreted as remote-write cancellation.
5. **Stale sweep** — use controlled clock/timer fixtures to isolate stale cancellation. The sweep
   runs only on `register()` and its threshold is `max(30 min, MAX_GENERATION_DURATION_MS) + 1 min`.
   Under normal timer execution, the maximum-duration timer requests cancellation first; simply
   leaving a live generation idle is not an independent reproduction of the stale-sweep path.

For every workload, record the application revision, retained counts by state, attachment count,
and process RSS, heap, and external memory without stacking memory kinds. Check the expected
return to baseline through a quiet period. A deliberately unsettled write is expected to retain
its entry; its continued presence is not evidence of a dashboard defect. These checks describe
acceptance work and do not claim that a production workload or OOM investigation has passed.

## Rollback

The [archived migration plan](../openspec/changes/archive/2026-09-21-fix-generation-eviction-lifecycle/design.md)
describes the drain procedure. Stop admitting new completions and account for **all four**
non-released states before reverting. `finalizing` and `settling` identify pending terminal
writes, but `active` and `cancel_requested` still represent owned work too. Do not infer a drained
process from one state reaching zero. A never-settling write prevents a clean drain; restarting
clears local ownership without confirming the remote write's result. Reverting restores the
older admission behavior and its replacement risk.
