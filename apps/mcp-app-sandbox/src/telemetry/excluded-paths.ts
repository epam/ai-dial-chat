/**
 * Paths excluded from tracing. The sandbox has no health endpoint; `/metrics` is served by the
 * Prometheus exporter's own standalone HTTP server, which `HttpInstrumentation` would otherwise
 * trace on every scrape.
 */
export const TELEMETRY_EXCLUDED_PATHS = new Set(['/metrics']);

/**
 * Tells whether a request path is infrastructure traffic that must not produce telemetry.
 * @param path - raw request URL (query string ignored) or route path
 */
export const isExcludedFromTelemetry = (
  path: string | null | undefined,
): boolean => path != null && TELEMETRY_EXCLUDED_PATHS.has(path.split('?')[0]);
