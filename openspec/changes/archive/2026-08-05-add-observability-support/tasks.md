## 1. Dependencies

- [x] 1.1 Add `@opentelemetry/api`, `@opentelemetry/api-logs`, `@opentelemetry/sdk-node`,
      `@opentelemetry/sdk-trace-node`, `@opentelemetry/sdk-metrics`, `@opentelemetry/resources`,
      `@opentelemetry/semantic-conventions`, `@opentelemetry/instrumentation-http`,
      `@opentelemetry/instrumentation-undici`, `@opentelemetry/exporter-trace-otlp-http`,
      `@opentelemetry/exporter-metrics-otlp-http`, `@opentelemetry/exporter-logs-otlp-http`, and
      `@opentelemetry/exporter-prometheus` to `apps/chat-api/package.json` `dependencies` (verify
      current versions compatible with Node 24 / NestJS 11 before pinning; do not add
      `@opentelemetry/instrumentation-fetch` or `@opentelemetry/instrumentation-pino` — see
      design.md §2/§3 for why they're excluded). Also added `@opentelemetry/sdk-trace-base`
      (`BatchSpanProcessor`) and `@opentelemetry/sdk-logs` (`BatchLogRecordProcessor`), both
      required by `NodeSDK`'s `spanProcessors`/`logRecordProcessors` options but not listed
      individually in the design. Verified current npm versions form one mutually-compatible set
      (`sdk-node@0.221.0`'s own `dependencies` pin `resources`/`sdk-metrics`/`sdk-trace-node` at
      `2.10.0` and `api-logs`/exporters at `0.221.0`; `api@1.9.1` satisfies `sdk-node`'s
      `@opentelemetry/api: >=1.3.0 <1.10.0` peer range).
- [x] 1.2 Run `npm install` at the workspace root and confirm the lockfile updates cleanly.

## 2. Exporter/config parsing (pure, unit-testable)

- [x] 2.1 Create `apps/chat-api/src/telemetry/otel-config.ts`: pure functions parsing
      `OTEL_SDK_DISABLED`, `OTEL_TRACES_EXPORTER`, `OTEL_LOGS_EXPORTER` (each `otlp` | `none`,
      default `otlp` when enabled), and `OTEL_METRICS_EXPORTER` (comma-separated subset of `otlp`,
      `prometheus`, `none`; default `prometheus` when enabled) from a `NodeJS.ProcessEnv`-shaped
      input into a typed result object. No SDK or network imports in this file.
- [x] 2.2 Create `apps/chat-api/src/telemetry/tests/otel-config.spec.ts` covering: fully disabled
      (default and explicit), each signal individually disabled via `none`, comma-separated
      metrics list parsing (single value, both values, whitespace tolerance), and default
      resolution when variables are unset.
- [x] 2.3 Verify: `npm exec nx test chat-api`, `npm exec nx lint chat-api`.

## 3. OpenTelemetry SDK bootstrap and resource identity

- [x] 3.1 Create `apps/chat-api/src/telemetry/otel-sdk.ts`: builds the resource
      (`OTEL_SERVICE_NAME || pkg.name || 'chat-api'` for `service.name`, `pkg.version` for
      `service.version`), constructs `HttpInstrumentation` (with
      `ignoreIncomingRequestHook` excluding `/api/health` and `/metrics`) and
      `UndiciInstrumentation`, constructs the trace `BatchSpanProcessor` (OTLP HTTP exporter) when
      traces are enabled, constructs the log `BatchLogRecordProcessor` (OTLP HTTP exporter) when
      logs are enabled, constructs the metric reader(s) per `otel-config.ts`'s parsed selection
      (Prometheus reader reading `OTEL_EXPORTER_PROMETHEUS_HOST`/`_PORT`, default `0.0.0.0:9464`;
      OTLP periodic reader), and assembles/starts a `NodeSDK` — all skipped entirely when disabled.
      Exported `buildResource`/`buildInstrumentations`/`buildSpanProcessors`/
      `buildLogRecordProcessors`/`buildMetricReaders` individually (not just the singleton) so
      each is directly unit-testable and so `buildSpanProcessors`/`buildLogRecordProcessors` accept
      an optional exporter override used by the task 4.5 propagation test to substitute an
      in-memory exporter without a live collector. Note: passing `spanProcessors: []` /
      `logRecordProcessors: []` (the `'none'` case) to `NodeSDK` — verified against the installed
      `sdk-node@0.221.0` source — means that signal's provider is not constructed at all (not "a
      no-op processor" as design.md §1 phrased it); the net effect (no export for that signal) is
      identical, so no spec scenario is affected, but the README/otel-sdk.ts comments describe the
      verified behavior rather than design.md's phrasing.
- [x] 3.2 Export `initializeOpenTelemetry()` (called at module scope, self-initializing on import)
      and `shutdownOpenTelemetry(timeoutMs = 5000)` (races `sdk.shutdown()` against the timeout via
      `Promise.race`, resolves either way, never throws).
- [x] 3.3 Create `apps/chat-api/src/telemetry/telemetry-shutdown.service.ts`: `@Injectable()
      TelemetryShutdownService implements OnApplicationShutdown`, calling
      `shutdownOpenTelemetry()` from the lifecycle hook.
- [x] 3.4 Register `TelemetryShutdownService` as a provider in `apps/chat-api/src/app/app.module.ts`.
- [x] 3.5 In `apps/chat-api/src/main.ts`: make `import './telemetry/otel-sdk';` the first import in
      the file (before `reflect-metadata` and everything else); add a one-line comment documenting
      the import-order invariant (see design.md Risks — depends on `webpack.config.js`'s
      `optimization: false`); add `app.enableShutdownHooks();` to the bootstrap function.
- [x] 3.6 Create `apps/chat-api/src/telemetry/tests/otel-sdk-shutdown.spec.ts`: asserts
      `shutdownOpenTelemetry()` resolves within its bounded timeout against a deliberately slow
      fake exporter/processor, and resolves promptly with fast fakes.
- [x] 3.7 Verify: `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build
      chat-api`.

## 4. Traces: propagation, scrape exclusion, traceparent header

- [x] 4.1 Create `apps/chat-api/src/telemetry/traceparent.middleware.ts`: reads the active trace
      context (via `@opentelemetry/api`'s `propagation.inject`/`trace.getSpan`) and sets a
      `traceparent` response header when a span is active; no-op when none is active. Also checks
      `isSpanContextValid(...)` so a non-recording/invalid span (e.g. if tracing is registered but
      a given signal ends up with no processor) never produces a garbage all-zero traceparent.
- [x] 4.2 Wire the middleware in `main.ts` via `app.use(...)` immediately after `cookieParser()`,
      before routing.
- [x] 4.3 Add `'traceparent'` to the `exposedHeaders` array in `main.ts`'s `app.enableCors({...})`
      call, alongside the existing `X-CSRF-Token` / `X-DIAL-CLIENT-CHANNEL-ID` entries.
- [x] 4.4 Create `apps/chat-api/src/telemetry/tests/traceparent.middleware.spec.ts`: asserts header
      presence/W3C format when a span is active, and absence for `/api/health` and `/metrics`
      requests.
- [x] 4.5 Create an integration test (e.g.
      `apps/chat-api/src/telemetry/tests/trace-propagation.spec.ts`) using `supertest` against the
      bootstrapped app with telemetry enabled and in-memory/local exporters: send a request
      carrying an inbound `traceparent`, assert the response's `traceparent` shares the same
      trace id, and assert a local stand-in "upstream" HTTP server (started in-test) receives the
      propagated header on an outbound call triggered by the handler. Built as a standalone Nest
      app with a real `BasicTracerProvider`/`InMemorySpanExporter` + `HttpInstrumentation`/
      `UndiciInstrumentation` registered directly in the test (rather than reusing the
      `otel-sdk.ts` singleton, which self-initializes from ambient `process.env` at import time
      and can't be reconfigured per test) — passed on the first run, confirming the outbound
      `fetch()` call made by the handler carries the propagated `traceparent`.
- [x] 4.6 Verify: `npm exec nx test chat-api`, `npm exec nx lint chat-api`.

## 5. Logs: NestJS Logger → OpenTelemetry bridge

- [x] 5.1 Create `apps/chat-api/src/telemetry/nestjs-otel-logger.ts`: `NestOtelLogger extends
      ConsoleLogger`, overriding `log`/`error`/`warn`/`debug`/`verbose`/`fatal` to call `super.*()`
      first (preserving console output) then emit via
      `logs.getLogger('chat-api', pkg.version).emit({...})` from `@opentelemetry/api-logs`, with:
      severity mapping table (`verbose→TRACE`, `debug→DEBUG`, `log→INFO`, `warn→WARN`,
      `error→ERROR`, `fatal→FATAL`), `context: context.active()` for trace correlation,
      `attributes['logger.name']` set to the Nest logger context string, and
      `exception.type`/`exception.message`/`exception.stacktrace` attributes when an error stack
      is provided. Explicitly checks `this.isLevelEnabled(method)` before emitting via OTel (not
      just before the inherited console output) so a suppressed `LOG_LEVEL` produces neither
      console output nor an exported record, per the spec's "Level filtering preserved" scenario.
- [x] 5.2 In `main.ts`, pass `new NestOtelLogger(resolveLogLevels(...))` as the `logger` option to
      `NestFactory.create` (replacing the current inline `logger: resolveLogLevels(...)` array
      argument) so `LOG_LEVEL` gating is preserved unchanged.
- [x] 5.3 Confirm `diag.setLogger(...)` is never called with `NestOtelLogger` (no code path wires
      OTel SDK diagnostics back into the bridge) — add a one-line comment noting this is
      intentional.
- [x] 5.4 Create `apps/chat-api/src/telemetry/tests/nestjs-otel-logger.spec.ts`: verify
      level→severity mapping, `trace_id`/`span_id` present when emitted inside an active span
      (started via `@opentelemetry/sdk-trace-base`'s `InMemorySpanExporter`) and absent otherwise,
      console output still occurs, `LOG_LEVEL` gating still suppresses the same levels as before
      this change, and exception attributes are populated for `error(message, stack)` calls.
      Registers a real `AsyncHooksContextManager` (a fresh test process has no context manager
      registered by default, so `context.with(...)` wouldn't actually switch the active context).
      Caught a real bug while writing this test: `@opentelemetry/sdk-logs`'s
      `SimpleLogRecordProcessor`/`BatchLogRecordProcessor` constructors take `{ exporter }` (an
      options object), not the exporter directly — unlike `@opentelemetry/sdk-trace-base`'s
      `BatchSpanProcessor`/`SimpleSpanProcessor`, which do take the exporter as a bare first
      argument (a leftover from the pre-2.x API this package shims). Fixed the same
      exporter-shape bug in `otel-sdk.ts`'s `buildLogRecordProcessors` (production code, not just
      this test) — verified in isolation with a throwaway Node script that the incorrect call
      shape silently drops every log record (the malformed exporter reference makes the internal
      `_export()` promise reject, and the rejection is swallowed by `sdk-logs`'s own
      `.catch(globalErrorHandler)`), with no thrown error and no diagnostic output.
- [x] 5.5 Verify: `npm exec nx test chat-api`, `npm exec nx lint chat-api`.

## 6. Metrics: request duration/count instrument

- [x] 6.1 Create `apps/chat-api/src/telemetry/http-metrics.ts`: exports a shared `Meter`
      (`metrics.getMeter('dial-chat-api', pkg.version)`) and one `http.server.request.duration`
      histogram (unit `s`) plus a helper to resolve the bounded route-template attribute (matched
      Express `request.route?.path`, falling back to the literal `"unmatched"`).
- [x] 6.2 Update `apps/chat-api/src/common/interceptors/metrics.interceptor.ts`: replace both TODO
      blocks with `.record()` calls on the shared histogram — success branch uses the response's
      actual `statusCode`, error branch uses `getErrorDetails(error).statusCode` — keeping exactly
      one `.record()` call per request via the existing `tap({next, error})` structure. Retain the
      existing log lines.
- [x] 6.3 Extend `apps/chat-api/src/common/interceptors/tests/metrics.interceptor.spec.ts` (or
      create it under `common/interceptors/tests/` if it doesn't already exist) to assert the
      histogram is recorded exactly once per request for both the success and thrown-exception
      paths, with correct method/route/status attributes. Created it (didn't exist yet). Both this
      test and 6.4 dynamically `import()` the module under test *after* registering a test
      `MeterProvider`, since `@opentelemetry/api`'s `metrics.getMeter()` resolves the global
      provider at call time — a static top-level import would permanently bind
      `http-metrics.ts`'s module-scope histogram to the API's default no-op meter before the test
      provider is registered (this mirrors production ordering, where `otel-sdk.ts` registers the
      real provider as `main.ts`'s first import, ahead of the module graph reaching this file).
- [x] 6.4 Create `apps/chat-api/src/telemetry/tests/http-metrics.spec.ts` using
      `@opentelemetry/sdk-metrics`'s in-memory metric reader: assert one data point per request,
      correct attributes, and the `"unmatched"` fallback for unrouted paths.
- [x] 6.5 Verify: `npm exec nx test chat-api`, `npm exec nx lint chat-api`.

## 6a. Fix (post-review): health check excluded from metrics, not just tracing

- [x] 6a.1 Review feedback caught a real gap: `otel-sdk.ts`'s `ignoreIncomingRequestHook` excluded
      `/api/health` from *tracing* only — `MetricsInterceptor` had no knowledge of that exclusion
      and kept recording an `http.server.request.duration` data point for every health-check
      probe. `/metrics` itself was never actually affected in practice (it's served by the
      Prometheus exporter's own standalone HTTP server, never reaching `MetricsInterceptor`), but
      the fix covers both paths symmetrically via one shared source of truth.
- [x] 6a.2 Created `apps/chat-api/src/telemetry/excluded-paths.ts` exporting
      `TELEMETRY_EXCLUDED_PATHS` and `isExcludedFromTelemetry(path)`. Updated `otel-sdk.ts`'s
      `ignoreIncomingRequestHook` to use it (against the raw request URL) and
      `metrics.interceptor.ts` to skip the `.record()` call (both success and error branches) when
      the resolved route template is excluded — the existing log line is unaffected, so health
      checks are still logged as before, just not recorded onto the histogram.
- [x] 6a.3 Added `apps/chat-api/src/telemetry/tests/excluded-paths.spec.ts` (direct unit coverage
      for the predicate — this was the missing piece that let the original gap slip through, since
      no test previously exercised `ignoreIncomingRequestHook`'s logic directly) and a new test in
      `metrics.interceptor.spec.ts` asserting no data point is recorded for `GET /api/health`.
- [x] 6a.4 Added a new requirement + scenario to
      `specs/observability-telemetry/spec.md` ("Health check excluded from HTTP request metrics")
      and a design.md §4 note documenting the fix.
- [x] 6a.5 Verify: `npm exec nx test chat-api`, `npm exec nx lint chat-api`,
      `npm exec nx build chat-api`.

      **Correction (post-review):** an earlier version of this entry blamed an intermittent
      `prometheus-endpoint.spec.ts` failure on "a stale Nx-managed Vitest worker" cleared by
      `nx reset`. That diagnosis was wrong, and a first attempt to fix it (splitting
      `vitest.config.ts` into a `projects` config with `fileParallelism: false` for the
      telemetry specs, plus `afterAll` cleanup) was based on a second, *also* wrong theory — a
      cross-file race over `@opentelemetry/api`'s global registry. Tracing the registry's
      contents at the start of `prometheus-endpoint.spec.ts`'s `beforeAll` showed the real cause:
      `npm exec nx test chat-api` (unlike a bare `vitest run`) auto-loads
      `apps/chat-api/.env` via Nx's `NX_LOAD_DOT_ENV_FILES`. That file is a
      developer-machine-only, git-ignored config for running the app locally against a real
      collector, and on this machine it sets `OTEL_SDK_DISABLED=false` plus
      `OTEL_TRACES_EXPORTER`/`OTEL_METRICS_EXPORTER`/etc. for that purpose. When those env vars
      reach a worker process, Vitest's own built-in OpenTelemetry test-run tracing
      (https://vitest.dev/guide/open-telemetry) activates and calls the real `@opentelemetry/api`
      `setGlobal*` functions before any spec's own `beforeAll` runs — so
      `prometheus-endpoint.spec.ts`'s `metrics.setGlobalMeterProvider(...)` call found the slot
      already taken and `registerGlobal()` silently no-op'd (`diag.error`, returns `false`),
      making the test fail depending on the developer's local `.env` contents. Confirmed by
      removing `apps/chat-api/.env` and seeing the suite go green, then restoring it. Fixed with
      one line: `vitest.config.ts`'s `test.env` now sets `OTEL_SDK_DISABLED: 'true'`, which
      overrides whatever Nx already loaded into `process.env` for every worker, making the suite
      deterministic regardless of an individual developer's `.env`. The `projects`/
      `fileParallelism` split was reverted as unnecessary; the `afterAll` cleanup
      (`metrics.disable()`/`trace.disable()`/`context.disable()`/`propagation.disable()`/
      `logs.disable()`) added to each OTel-global-mutating spec was kept as general hygiene.
      Verified by running `npm exec nx test chat-api` repeatedly (with `apps/chat-api/.env`'s
      OTEL vars in place) with no observed flake.

## 7. Prometheus scrape endpoint

- [x] 7.1 Confirm (from task 3.1) the Prometheus `MetricReader` is constructed with `{host: process.env.OTEL_EXPORTER_PROMETHEUS_HOST ?? '0.0.0.0', port: Number(process.env.OTEL_EXPORTER_PROMETHEUS_PORT) || 9464, endpoint: '/metrics'}` — the exporter package does not read these env vars itself. Confirmed: `otel-sdk.ts`'s `buildMetricReaders` constructs it exactly this way.
- [x] 7.2 Create `apps/chat-api/src/telemetry/tests/prometheus-endpoint.spec.ts`: start the
      Prometheus exporter on a specific free port obtained via a throwaway `net.createServer()`
      probe (`PrometheusExporter`'s own `port` option treats literal `0` as "not provided" —
      `config.port || ... || DEFAULT_PORT`, and `0` is falsy in JS — so it cannot itself bind an
      OS-assigned ephemeral port; the probe-then-reuse pattern is the workaround), record a metric
      via the shared meter, issue a loopback `GET /metrics`, and assert `200`, the content type,
      and the expected metric family name in the body — no live collector involved. **Design
      correction**: the content type is `text/plain`, not `text/plain; version=0.0.4;
      charset=utf-8` as design.md §5 assumed — verified against the installed
      `@opentelemetry/exporter-prometheus@0.221.0` source, which sets this header
      unconditionally with no version/charset suffix (older versions of this package included
      that suffix). Updated design.md §5 and specs/prometheus-metrics-endpoint/spec.md's
      "Prometheus exporter enabled" scenario to match; the response body is still the standard
      Prometheus text exposition format, only the header string differs from what was assumed.
- [x] 7.3 Verify: `npm exec nx test chat-api`, `npm exec nx lint chat-api`.

## 8. Production smoke test

- [x] 8.1 Build the compiled bundle: `npm exec nx build chat-api`.
- [x] 8.2 Script (documented in the README per task 9.1, run manually or via a throwaway shell
      script — not a permanent CI job unless the team decides otherwise) starting
      `node apps/chat-api/dist/main.js` with `OTEL_SDK_DISABLED=false`,
      `OTEL_TRACES_EXPORTER=none`, `OTEL_LOGS_EXPORTER=none`, `OTEL_METRICS_EXPORTER=prometheus`,
      plus the app's existing required env vars stubbed to safe local values.
- [x] 8.3 From the script: `curl` `GET /api/health` (expect `200`) and
      `GET http://localhost:9464/metrics` (expect `200`, Prometheus content type, containing
      default process metrics). Ran against the real built bundle: `/api/health` returned `200`
      with the expected JSON body; `:19464/metrics` returned `200`,
      `content-type: text/plain`, and included both the standard `target_info` gauge (correctly
      showing `service_name="@epam/chat-api"`, `service_version="0.0.1"` — confirming the
      resource-identity fallback chain end-to-end) and our own
      `http_server_request_duration` histogram with the expected
      `http_request_method`/`http_route`/`http_response_status_code` attributes.
- [x] 8.4 Send `SIGTERM` to the process and assert it exits within a bounded window (e.g. 10s)
      without requiring `SIGKILL`. Exited cleanly in ~279ms.

## 9. Documentation

- [x] 9.1 Update `apps/chat-api/README.md` with an **Observability** section: architecture
      summary, the full `OTEL_*` variable table (from design.md §6) with explicit defaults, a
      minimal collector example, a `curl localhost:9464/metrics` example, and the local
      verification commands (including the smoke-test steps from section 8). Also added a
      Features bullet, a `telemetry/` entry in the Project Structure tree, and an OpenTelemetry
      JS link under Related Documentation.
- [x] 9.2 Update `docs/architecture.md`'s "apps/chat-api — Backend" section with a short bullet
      noting the optional `:9464` Prometheus listener and the `traceparent` response header. Also
      added `telemetry/` to the domain structure tree.

## 10. Final verification

- [x] 10.1 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build
      chat-api` and confirm all pass together (not just per-slice). All green: 1691 tests, 0 lint
      errors (1 pre-existing unrelated warning in `share.service.ts`), successful webpack build.
- [x] 10.2 Confirm the pruned Docker build still succeeds: build the root `Dockerfile` (or at
      minimum `npm exec nx run chat-api:prune` followed by `npm ci --omit=dev` in
      `apps/chat-api/dist`) and check the resulting image/directory contains the new
      `@opentelemetry/*` packages. Ran `nx run chat-api:prune` then `npm ci --omit=dev` in
      `apps/chat-api/dist`; the resulting `node_modules/@opentelemetry/` contains all 14 runtime
      packages plus their own transitive sub-dependencies (e.g. `context-async-hooks`, `core`,
      `sdk-trace`, `otlp-transformer`, gRPC/protobuf exporter variants pulled in by `sdk-node`
      itself). Booted `node main.js` from inside `dist` against this pruned-only `node_modules`
      with required env vars stubbed — started cleanly with no module-resolution errors.
- [x] 10.3 Re-run the production smoke test (section 8) against the final build. Ran it a second
      time specifically from `apps/chat-api/dist` (so Node resolves `dist/node_modules`, the
      pruned production-only set, not the workspace's): `/api/health` → `200`; Prometheus
      `:19466/metrics` → `200`, `content-type: text/plain`, containing `target_info` (correct
      `service_name`/`service_version`) and `http_server_request_duration`; `SIGTERM` → clean exit
      in ~283ms.
- [x] 10.4 Review every new file in `apps/chat-api/src/telemetry/` for the "no secrets in
      telemetry" constraint: no request bodies, authorization headers, cookies, tokens, API keys,
      or `OTEL_EXPORTER_OTLP_HEADERS` values appear in any span/log/metric attribute or in
      application log output. Reviewed all 6 source files (`otel-config.ts`, `otel-sdk.ts`,
      `nestjs-otel-logger.ts`, `traceparent.middleware.ts`, `http-metrics.ts`,
      `telemetry-shutdown.service.ts`): none read or forward `OTEL_EXPORTER_OTLP_HEADERS`
      (exporter packages read it natively, never touched by our code); `NestOtelLogger` forwards
      only the message string, an optional stack string, and the logger context string — never
      arbitrary object arguments; `http-metrics.ts` only ever attributes method/route-template/
      status code, never a raw URL or ID. Also grepped the app for any existing `Logger` call site
      passing more than 2–3 arguments (which `NestOtelLogger`'s narrowed override signatures would
      silently drop from console output) — found none; the only 3-argument matches were unrelated
      calls to a different `generationService.error(...)` method.
