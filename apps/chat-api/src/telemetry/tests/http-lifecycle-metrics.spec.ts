import { metrics } from '@opentelemetry/api';
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as HttpLifecycleMetricsModule from '../http-lifecycle-metrics';

class TestMetricReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {
    /* nothing to flush — reader.collect() is called directly in assertions */
  }

  protected async onShutdown(): Promise<void> {
    /* no resources to release */
  }
}

/*
 * Same global-MeterProvider-ordering concern as `http-metrics.spec.ts`: the module under test
 * calls `metrics.getMeter(...)` once at module scope, so the in-memory reader must be registered
 * before the module is (dynamically) imported.
 */
describe('http-lifecycle-metrics', () => {
  let reader: TestMetricReader;
  let httpLifecycleMetrics: typeof HttpLifecycleMetricsModule;

  beforeAll(async () => {
    reader = new TestMetricReader();
    const meterProvider = new MeterProvider({ readers: [reader] });
    metrics.setGlobalMeterProvider(meterProvider);

    httpLifecycleMetrics = await import('../http-lifecycle-metrics');
  });

  afterAll(() => {
    metrics.disable();
  });

  const collectMetric = async (name: string) => {
    const { resourceMetrics } = await reader.collect();
    return resourceMetrics.scopeMetrics
      .flatMap((scope) => scope.metrics)
      .find((metric) => metric.descriptor.name === name);
  };

  it('defines dial.chat.http.requests.started as a counter with unit {request}', async () => {
    httpLifecycleMetrics.httpRequestsStarted.add(1, {
      'http.request.method': 'GET',
    });

    const metric = await collectMetric('dial.chat.http.requests.started');
    expect(metric?.descriptor.unit).toBe('{request}');
    expect(metric?.dataPoints[0]?.value).toBe(1);
  });

  it('defines dial.chat.http.requests.active as an up/down counter with unit {request}', async () => {
    httpLifecycleMetrics.httpRequestsActive.add(1, {
      'http.request.method': 'POST',
    });

    const metric = await collectMetric('dial.chat.http.requests.active');
    expect(metric?.descriptor.unit).toBe('{request}');
  });

  it('defines dial.chat.http.response.duration as a histogram with unit s and the explicit sub-second boundaries', async () => {
    httpLifecycleMetrics.httpResponseDuration.record(0.1, {
      'http.request.method': 'GET',
      'http.route': '/api/v1/themes/:id',
      'dial.chat.http.outcome': 'completed',
      'dial.chat.http.transport_kind': 'ordinary',
    });

    const metric = await collectMetric('dial.chat.http.response.duration');
    expect(metric?.descriptor.unit).toBe('s');
    expect(httpLifecycleMetrics.HTTP_RESPONSE_DURATION_BOUNDARIES).toEqual([
      0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 10, 30,
      60,
    ]);
  });

  describe('resolveHttpMethod', () => {
    it.each(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])(
      'returns %s unchanged',
      (method) => {
        expect(httpLifecycleMetrics.resolveHttpMethod(method)).toBe(method);
      },
    );

    it('falls back to unknown for an unrecognized method', () => {
      expect(httpLifecycleMetrics.resolveHttpMethod('TRACE')).toBe(
        httpLifecycleMetrics.UNKNOWN_HTTP_METHOD,
      );
    });

    it('falls back to unknown when method is undefined', () => {
      expect(httpLifecycleMetrics.resolveHttpMethod(undefined)).toBe(
        httpLifecycleMetrics.UNKNOWN_HTTP_METHOD,
      );
    });
  });

  describe('resolveTransportKind', () => {
    it.each([
      '/api/v1/conversations/completions',
      '/api/v1/conversations/completions/attach',
      '/api/v1/conversations/watch',
      '/api/v1/client-channel/subscribe',
    ])('classifies %s as streaming', (route) => {
      expect(httpLifecycleMetrics.resolveTransportKind(route)).toBe(
        httpLifecycleMetrics.TransportKind.Streaming,
      );
    });

    it('classifies an ordinary matched route as ordinary', () => {
      expect(
        httpLifecycleMetrics.resolveTransportKind('/api/v1/themes/:id'),
      ).toBe(httpLifecycleMetrics.TransportKind.Ordinary);
    });

    it('classifies the unmatched fallback as unmatched', () => {
      expect(httpLifecycleMetrics.resolveTransportKind('unmatched')).toBe(
        httpLifecycleMetrics.TransportKind.Unmatched,
      );
    });
  });
});
