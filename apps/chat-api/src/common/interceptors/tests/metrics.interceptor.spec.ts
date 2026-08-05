import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { metrics } from '@opentelemetry/api';
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import { of, throwError } from 'rxjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MetricsInterceptor as MetricsInterceptorType } from '../metrics.interceptor';

class TestMetricReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {
    /* nothing to flush — reader.collect() is called directly in assertions */
  }

  protected async onShutdown(): Promise<void> {
    /* no resources to release */
  }
}

const createExecutionContext = (
  request: Record<string, unknown>,
  response: Record<string, unknown>,
): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  }) as unknown as ExecutionContext;

/*
 * Same ordering requirement as http-metrics.spec.ts: `MetricsInterceptor` imports the shared
 * histogram from `http-metrics.ts`, which binds to the global MeterProvider at import time — so
 * the provider must be registered before the interceptor module is loaded.
 */
describe('MetricsInterceptor', () => {
  let reader: TestMetricReader;
  let MetricsInterceptor: typeof MetricsInterceptorType;

  beforeAll(async () => {
    reader = new TestMetricReader();
    const meterProvider = new MeterProvider({ readers: [reader] });
    metrics.setGlobalMeterProvider(meterProvider);

    ({ MetricsInterceptor } = await import('../metrics.interceptor'));
  });

  /*
   * See the matching comment in `http-metrics.spec.ts`: deregister the global MeterProvider this
   * spec installed once it's done with it.
   */
  afterAll(() => {
    metrics.disable();
  });

  const findDataPoint = async (attributes: Record<string, unknown>) => {
    const { resourceMetrics } = await reader.collect();
    const dataPoints = resourceMetrics.scopeMetrics.flatMap((scope) =>
      scope.metrics
        .filter(
          (metric) => metric.descriptor.name === 'http.server.request.duration',
        )
        .flatMap((metric) => metric.dataPoints),
    );
    return dataPoints.find(
      (dataPoint) =>
        JSON.stringify(dataPoint.attributes) === JSON.stringify(attributes),
    );
  };

  it('records exactly one data point for a successful request', async () => {
    const interceptor = new MetricsInterceptor();
    const context = createExecutionContext(
      {
        method: 'GET',
        url: '/api/v1/themes/abc',
        route: { path: '/api/v1/themes/:id' },
      },
      { statusCode: 200 },
    );
    const handler: CallHandler = { handle: () => of({ ok: true }) };

    await new Promise<void>((resolve) => {
      interceptor.intercept(context, handler).subscribe({ complete: resolve });
    });

    const dataPoint = await findDataPoint({
      'http.request.method': 'GET',
      'http.route': '/api/v1/themes/:id',
      'http.response.status_code': 200,
    });
    expect(dataPoint?.value.count).toBe(1);
  });

  it('records exactly one data point for a thrown exception, using the error status code', async () => {
    const interceptor = new MetricsInterceptor();
    const context = createExecutionContext(
      {
        method: 'POST',
        url: '/api/v1/themes',
        route: { path: '/api/v1/themes' },
      },
      { statusCode: 200 },
    );
    const handler: CallHandler = {
      handle: () => throwError(() => ({ status: 502, message: 'Bad Gateway' })),
    };

    await new Promise<void>((resolve) => {
      interceptor
        .intercept(context, handler)
        .subscribe({ error: () => resolve() });
    });

    const dataPoint = await findDataPoint({
      'http.request.method': 'POST',
      'http.route': '/api/v1/themes',
      'http.response.status_code': 502,
    });
    expect(dataPoint?.value.count).toBe(1);
  });

  it('falls back to the bounded route literal for an unmatched request', async () => {
    const interceptor = new MetricsInterceptor();
    const context = createExecutionContext(
      { method: 'GET', url: '/api/v1/does-not-exist' },
      { statusCode: 404 },
    );
    const handler: CallHandler = { handle: () => of(null) };

    await new Promise<void>((resolve) => {
      interceptor.intercept(context, handler).subscribe({ complete: resolve });
    });

    const dataPoint = await findDataPoint({
      'http.request.method': 'GET',
      'http.route': 'unmatched',
      'http.response.status_code': 404,
    });
    expect(dataPoint?.value.count).toBe(1);
  });

  it('does not record a data point for the excluded /api/health route', async () => {
    const interceptor = new MetricsInterceptor();
    const context = createExecutionContext(
      { method: 'GET', url: '/api/health', route: { path: '/api/health' } },
      { statusCode: 200 },
    );
    const handler: CallHandler = { handle: () => of({ status: 'ok' }) };

    await new Promise<void>((resolve) => {
      interceptor.intercept(context, handler).subscribe({ complete: resolve });
    });

    const dataPoint = await findDataPoint({
      'http.request.method': 'GET',
      'http.route': '/api/health',
      'http.response.status_code': 200,
    });
    expect(dataPoint).toBeUndefined();
  });
});
