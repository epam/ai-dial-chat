import { channel } from 'node:diagnostics_channel';
import { EventEmitter } from 'node:events';
import { context, metrics, SpanKind, trace } from '@opentelemetry/api';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import {
  MeterProvider,
  MetricReader,
  type MetricData,
} from '@opentelemetry/sdk-metrics';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import type { Request, RequestHandler, Response } from 'express';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  stopUpstreamRequestTiming,
  withAnalyticsRequestTiming,
  withCoreRequestTiming,
} from '../upstream-request-timing';

class TestMetricReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {
    /* Tests collect in-memory data directly. */
  }

  protected async onShutdown(): Promise<void> {
    /* No external resources. */
  }
}

const exporter = new InMemorySpanExporter();
const metricReader = new TestMetricReader();
let meterProvider: MeterProvider;
let createRequestTimingMiddleware: (env?: NodeJS.ProcessEnv) => RequestHandler;

const makeRequest = (url = '/api/v1/files/private-file?secret=value') => {
  const req = Object.assign(new EventEmitter(), {
    url,
    method: 'GET',
    route: { path: '/api/v1/files/:path' },
  }) as unknown as Request;
  const res = Object.assign(new EventEmitter(), {
    headersSent: true,
    statusCode: 200,
  }) as unknown as Response;
  return { req, res };
};

describe('request timing trace', () => {
  beforeAll(async () => {
    context.setGlobalContextManager(new AsyncHooksContextManager().enable());
    trace.setGlobalTracerProvider(
      new BasicTracerProvider({
        spanProcessors: [new SimpleSpanProcessor(exporter)],
      }),
    );
    meterProvider = new MeterProvider({ readers: [metricReader] });
    metrics.setGlobalMeterProvider(meterProvider);
    ({ createRequestTimingMiddleware } = await import('../request-timing'));
  });

  afterEach(() => {
    exporter.reset();
    stopUpstreamRequestTiming();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await meterProvider.shutdown();
    metrics.disable();
    trace.disable();
    context.disable();
  });

  const collectPhases = async (): Promise<Record<string, number>> => {
    const { resourceMetrics } = await metricReader.collect();
    return Object.fromEntries(
      resourceMetrics.scopeMetrics
        .flatMap((scope) => scope.metrics)
        .filter(
          (metric) =>
            metric.descriptor.name === 'dial.chat.http.request.phase.duration',
        )
        .flatMap<MetricData['dataPoints'][number]>(
          (metric) => metric.dataPoints,
        )
        .map((point) => {
          const value = point.value;
          if (typeof value === 'number' || !('sum' in value)) {
            throw new Error('Expected request phase histogram data');
          }
          return [
            String(point.attributes['dial.chat.http.phase']),
            value.sum ?? 0,
          ];
        }),
    );
  };

  it('ends once with matching total and phase attributes and no raw URL', async () => {
    let now = 10;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { req, res } = makeRequest();
    const middleware = createRequestTimingMiddleware({
      OTEL_SDK_DISABLED: 'false',
      OTEL_METRICS_EXPORTER: 'none',
      OTEL_TRACES_EXPORTER: 'otlp',
    });
    middleware(req, res, () => {
      const wireRequest = {};
      now = 20;
      withCoreRequestTiming(() =>
        channel('undici:request:create').publish({ request: wireRequest }),
      );
      const analyticsRequest = {};
      now = 25;
      withAnalyticsRequestTiming(() =>
        channel('undici:request:create').publish({ request: analyticsRequest }),
      );
      now = 30;
      channel('undici:request:trailers').publish({ request: wireRequest });
      now = 35;
      channel('undici:request:trailers').publish({ request: analyticsRequest });
      now = 40;
      res.emit('finish');
      now = 50;
      res.emit('close');
    });

    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0].kind).toBe(SpanKind.INTERNAL);
    expect(spans[0].name).toBe('request.timing GET /api/v1/files/:path');
    expect(spans[0].attributes).toEqual({
      'dial.chat.http.request.timing': true,
      'http.request.method': 'GET',
      'http.route': '/api/v1/files/:path',
      'dial.chat.http.outcome': 'completed',
      'dial.chat.http.transport_kind': 'ordinary',
      'http.response.status_code': 200,
      'dial.chat.http.duration.total': 0.03,
      'dial.chat.http.duration.core': 0.01,
      'dial.chat.http.duration.analytics': 0.01,
      /* Core 20..30 and Analytics 25..35 overlap: the union is 15 ms. */
      'dial.chat.http.duration.chat': expect.closeTo(0.015),
    });
    expect(await collectPhases()).toEqual({
      total: 0.03,
      core: 0.01,
      analytics: 0.01,
      chat: expect.closeTo(0.015),
    });
    expect(res.listenerCount('finish')).toBe(0);
    expect(req.listenerCount('aborted')).toBe(0);
  });

  it.each([
    { OTEL_SDK_DISABLED: 'true' },
    {
      OTEL_SDK_DISABLED: 'false',
      OTEL_METRICS_EXPORTER: 'none',
      OTEL_TRACES_EXPORTER: 'none',
    },
  ])('does nothing when request signals are disabled (%j)', (env) => {
    const { req, res } = makeRequest();
    const next = vi.fn();
    createRequestTimingMiddleware(env)(req, res, next);
    res.emit('finish');

    expect(next).toHaveBeenCalledOnce();
    expect(exporter.getFinishedSpans()).toHaveLength(0);
    expect(res.listenerCount('close')).toBe(0);
  });

  it('excludes probe paths from request timing', () => {
    const { req, res } = makeRequest('/api/health');
    createRequestTimingMiddleware({ OTEL_SDK_DISABLED: 'false' })(
      req,
      res,
      () => res.emit('finish'),
    );

    expect(exporter.getFinishedSpans()).toHaveLength(0);
  });
});
