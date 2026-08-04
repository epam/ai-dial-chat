import { metrics } from '@opentelemetry/api';
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as HttpMetricsModule from '../http-metrics';

class TestMetricReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {
    /* nothing to flush — reader.collect() is called directly in assertions */
  }

  protected async onShutdown(): Promise<void> {
    /* no resources to release */
  }
}

/*
 * `http-metrics.ts` calls `metrics.getMeter(...)` once at module scope, binding to whichever
 * MeterProvider is globally registered at that exact moment (the OTel API resolves the global
 * provider at call time, not lazily on each `.record()`) — exactly like production, where
 * `otel-sdk.ts` registers the real provider as `main.ts`'s first import, before the module graph
 * reaches this file. So the test registers its in-memory reader first, then dynamically imports
 * `http-metrics.ts` to reproduce that same ordering; a static top-level import here would bind
 * the shared histogram to the API's default no-op meter instead.
 */
describe('http-metrics', () => {
  let reader: TestMetricReader;
  let httpMetrics: typeof HttpMetricsModule;

  beforeAll(async () => {
    reader = new TestMetricReader();
    const meterProvider = new MeterProvider({ readers: [reader] });
    metrics.setGlobalMeterProvider(meterProvider);

    httpMetrics = await import('../http-metrics');
  });

  /*
   * `metrics.setGlobalMeterProvider` mutates `@opentelemetry/api`'s process-global registry
   * (`registerGlobal` silently no-ops if a global is already set — see `diag.error` in
   * `global-utils.js`). Vitest runs each spec file in its own worker process by default, so this
   * mainly guards against ambient global state within *this* process (e.g. Vitest's own
   * OpenTelemetry test-tracing, see `vitest.config.ts`'s `env.OTEL_SDK_DISABLED` comment) rather
   * than leakage to other spec files.
   */
  afterAll(() => {
    metrics.disable();
  });

  const collectDataPoints = async () => {
    const { resourceMetrics } = await reader.collect();
    return resourceMetrics.scopeMetrics.flatMap((scope) =>
      scope.metrics
        .filter(
          (metric) => metric.descriptor.name === 'http.server.request.duration',
        )
        .flatMap((metric) => metric.dataPoints),
    );
  };

  it('records a data point with the expected attributes', async () => {
    httpMetrics.httpServerRequestDuration.record(0.25, {
      'http.request.method': 'GET',
      'http.route': '/api/v1/themes/:id',
      'http.response.status_code': 200,
    });

    const dataPoints = await collectDataPoints();
    expect(dataPoints).toHaveLength(1);
    expect(dataPoints[0].attributes).toEqual({
      'http.request.method': 'GET',
      'http.route': '/api/v1/themes/:id',
      'http.response.status_code': 200,
    });
  });

  describe('resolveRouteTemplate', () => {
    it('returns the matched route template', () => {
      expect(
        httpMetrics.resolveRouteTemplate({
          route: { path: '/api/v1/themes/:id' },
        }),
      ).toBe('/api/v1/themes/:id');
    });

    it('falls back to the bounded literal for an unrouted request', () => {
      expect(httpMetrics.resolveRouteTemplate({})).toBe(
        httpMetrics.UNMATCHED_ROUTE,
      );
    });

    it('falls back to the bounded literal when route.path is not a string', () => {
      expect(
        httpMetrics.resolveRouteTemplate({ route: { path: undefined } }),
      ).toBe(httpMetrics.UNMATCHED_ROUTE);
    });
  });
});
