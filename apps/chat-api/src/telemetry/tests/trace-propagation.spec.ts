import http from 'http';
import type { AddressInfo } from 'net';
import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { context, propagation, SpanKind, trace } from '@opentelemetry/api';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { traceparentMiddleware } from '../traceparent.middleware';

/*
 * End-to-end proof that a real OpenTelemetry-instrumented app (a) creates a server span for an
 * inbound request continuing the caller's trace, (b) reflects that trace id back via the
 * traceparent response header, and (c) propagates it into an outbound call — using only
 * in-memory/local exporters and a local stand-in "upstream" server, never a live collector.
 */
describe('trace propagation', () => {
  let app: INestApplication;
  let upstreamServer: http.Server;
  let upstreamPort: number;
  let receivedUpstreamTraceparent: string | undefined;
  let exporter: InMemorySpanExporter;
  let provider: BasicTracerProvider;
  let unregisterInstrumentations: () => void;
  const upstreamRequests: {
    path: string | undefined;
    traceparent: string | undefined;
  }[] = [];

  beforeAll(async () => {
    context.setGlobalContextManager(new AsyncHooksContextManager().enable());
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());

    exporter = new InMemorySpanExporter();
    provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    trace.setGlobalTracerProvider(provider);

    unregisterInstrumentations = registerInstrumentations({
      instrumentations: [
        new HttpInstrumentation({
          ignoreIncomingRequestHook: (req) =>
            req.url === '/api/health' || req.url === '/metrics',
        }),
        new UndiciInstrumentation(),
      ],
    });

    const { createRequestTimingMiddleware } = await import('../request-timing');
    const { withCoreRequestTiming } = await import('../core-request-timing');

    upstreamServer = http.createServer((req, res) => {
      receivedUpstreamTraceparent = req.headers.traceparent as
        string | undefined;
      upstreamRequests.push({
        path: req.url,
        traceparent: receivedUpstreamTraceparent,
      });
      if (req.url === '/redirect') {
        res.writeHead(302, { location: '/upstream' });
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.write('{');
      setTimeout(() => res.end('}'), 25);
    });
    await new Promise<void>((resolve) => {
      upstreamServer.listen(0, resolve);
    });
    upstreamPort = (upstreamServer.address() as AddressInfo).port;

    @Controller('ping')
    class PingController {
      @Get()
      async ping() {
        const response = await withCoreRequestTiming(() =>
          fetch(`http://localhost:${upstreamPort}/upstream`),
        );
        await response.text();
        return { ok: true };
      }

      @Get('redirect')
      async redirect() {
        const response = await withCoreRequestTiming(() =>
          fetch(`http://localhost:${upstreamPort}/redirect`),
        );
        await response.text();
        return { ok: true };
      }
    }

    @Module({ controllers: [PingController] })
    class TracePropagationTestModule {}

    app = await NestFactory.create(TracePropagationTestModule, {
      logger: false,
    });
    app.use(
      createRequestTimingMiddleware({
        OTEL_SDK_DISABLED: 'false',
        OTEL_METRICS_EXPORTER: 'none',
        OTEL_TRACES_EXPORTER: 'otlp',
      }),
    );
    app.use(traceparentMiddleware);
    await app.init();
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app?.close();
    await new Promise<void>((resolve) => {
      upstreamServer.close(() => resolve());
    });
    const { stopCoreRequestTiming } = await import('../core-request-timing');
    stopCoreRequestTiming();
    unregisterInstrumentations?.();
    await provider?.shutdown();
    /*
     * Deregister the global context manager, propagator, and tracer provider this spec
     * installed — see `http-metrics.spec.ts` for why every OTel-global-mutating spec cleans up
     * after itself.
     */
    context.disable();
    propagation.disable();
    trace.disable();
  });

  it('reflects the inbound trace id in the response header and propagates it to the outbound call', async () => {
    const inboundTraceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const inboundTraceparent = `00-${inboundTraceId}-00f067aa0ba902b7-01`;

    const response = await request(app.getHttpServer())
      .get('/ping')
      .set('traceparent', inboundTraceparent)
      .expect(200);

    const responseTraceparent = response.headers['traceparent'] as
      string | undefined;
    expect(responseTraceparent).toBeDefined();
    expect(responseTraceparent?.split('-')[1]).toBe(inboundTraceId);

    expect(receivedUpstreamTraceparent).toBeDefined();
    expect(receivedUpstreamTraceparent?.split('-')[1]).toBe(inboundTraceId);

    await vi.waitFor(() => {
      const spans = exporter
        .getFinishedSpans()
        .filter((span) => span.spanContext().traceId === inboundTraceId);
      const inbound = spans.find(
        (span) =>
          span.kind === SpanKind.SERVER &&
          span.parentSpanContext?.spanId === '00f067aa0ba902b7',
      );
      const timing = spans.find(
        (span) => span.attributes['dial.chat.http.request.timing'] === true,
      );
      const core = spans.find(
        (span) =>
          span.kind === SpanKind.CLIENT &&
          span.parentSpanContext?.spanId === timing?.spanContext().spanId,
      );
      expect(inbound).toBeDefined();
      expect(timing?.parentSpanContext?.spanId).toBe(
        inbound?.spanContext().spanId,
      );
      expect(core).toBeDefined();
      expect(receivedUpstreamTraceparent?.split('-')[2]).toBe(
        core?.spanContext().spanId,
      );
      expect(responseTraceparent?.split('-')[2]).toBe(
        timing?.spanContext().spanId,
      );
      expect(timing?.attributes).toMatchObject({
        'http.request.method': 'GET',
        'http.route': '/ping',
        'dial.chat.http.outcome': 'completed',
        'dial.chat.http.transport_kind': 'ordinary',
        'http.response.status_code': 200,
      });
      const total = Number(timing?.attributes['dial.chat.http.duration.total']);
      const coreTime = Number(
        timing?.attributes['dial.chat.http.duration.core'],
      );
      const chat = Number(timing?.attributes['dial.chat.http.duration.chat']);
      expect(coreTime).toBeGreaterThan(0.015);
      expect(chat).toBeGreaterThanOrEqual(0);
      expect(total).toBeCloseTo(coreTime + chat, 10);
    });
  });

  it('preserves trace correlation and Core body timing across an upstream redirect', async () => {
    const inboundTraceId = '5bf92f3577b34da6a3ce929d0e0e4736';
    upstreamRequests.length = 0;
    await request(app.getHttpServer())
      .get('/ping/redirect')
      .set('traceparent', `00-${inboundTraceId}-00f067aa0ba902b7-01`)
      .expect(200, { ok: true });

    expect(upstreamRequests.map(({ path }) => path)).toEqual([
      '/redirect',
      '/upstream',
    ]);
    expect(
      upstreamRequests.every(
        ({ traceparent }) => traceparent?.split('-')[1] === inboundTraceId,
      ),
    ).toBe(true);

    await vi.waitFor(() => {
      const spans = exporter
        .getFinishedSpans()
        .filter((span) => span.spanContext().traceId === inboundTraceId);
      const timings = spans.filter(
        (span) => span.attributes['dial.chat.http.request.timing'] === true,
      );
      expect(timings).toHaveLength(1);
      const timing = timings[0];
      const outbound = spans.filter(
        (span) =>
          span.kind === SpanKind.CLIENT &&
          span.parentSpanContext?.spanId === timing.spanContext().spanId,
      );
      expect(outbound).toHaveLength(2);
      expect(
        upstreamRequests.map(({ traceparent }) => traceparent?.split('-')[2]),
      ).toEqual(outbound.map((span) => span.spanContext().spanId));
      const total = Number(timing.attributes['dial.chat.http.duration.total']);
      const coreTime = Number(
        timing.attributes['dial.chat.http.duration.core'],
      );
      const chat = Number(timing.attributes['dial.chat.http.duration.chat']);
      expect(coreTime).toBeGreaterThan(0.015);
      expect(coreTime).toBeLessThanOrEqual(total);
      expect(chat).toBeGreaterThanOrEqual(0);
      expect(total).toBeCloseTo(coreTime + chat, 10);
    });
  });
});
