/*
 * Infrastructure paths excluded from all telemetry signals — no trace spans
 * (otel-sdk.ts's `HttpInstrumentation` `ignoreIncomingRequestHook`) and no
 * `http.server.request.duration` data points (`MetricsInterceptor`) — so health-check and
 * metrics-scrape probe traffic never pollutes business-request dashboards/alerting.
 *
 * `/metrics` never actually reaches `MetricsInterceptor` (it's served by the Prometheus
 * exporter's own standalone `http.createServer()`, entirely outside Nest/Express — see
 * design.md §5), so this set only has practical effect on `/api/health` for that consumer; it's
 * still shared so both exclusion points stay driven by one source of truth.
 */
export const TELEMETRY_EXCLUDED_PATHS = new Set(['/api/health', '/metrics']);

/*
 * Shared predicate so both exclusion points (the raw request URL `HttpInstrumentation` sees
 * before routing resolves, and the matched route template `MetricsInterceptor` sees after) are
 * driven by one directly-unit-testable function instead of two separately inlined `.has(...)`
 * checks that could silently drift apart.
 */
export const isExcludedFromTelemetry = (
  path: string | null | undefined,
): boolean => path != null && TELEMETRY_EXCLUDED_PATHS.has(path);
