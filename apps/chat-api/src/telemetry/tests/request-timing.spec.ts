import { channel } from 'node:diagnostics_channel';
import { EventEmitter } from 'node:events';
import { context, SpanKind, trace } from '@opentelemetry/api';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
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
  stopCoreRequestTiming,
  withCoreRequestTiming,
} from '../core-request-timing';

const exporter = new InMemorySpanExporter();
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
    ({ createRequestTimingMiddleware } = await import('../request-timing'));
  });

  afterEach(() => {
    exporter.reset();
    stopCoreRequestTiming();
    vi.restoreAllMocks();
  });

  afterAll(() => {
    trace.disable();
    context.disable();
  });

  it('ends once with matching total and phase attributes and no raw URL', () => {
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
      now = 30;
      channel('undici:request:trailers').publish({ request: wireRequest });
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
      'dial.chat.http.duration.chat': expect.closeTo(0.02),
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
