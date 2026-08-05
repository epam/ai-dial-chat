import http from 'http';
import type { AddressInfo } from 'net';
import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { context, propagation, trace } from '@opentelemetry/api';
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
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

  beforeAll(async () => {
    context.setGlobalContextManager(new AsyncHooksContextManager().enable());
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());

    const exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    trace.setGlobalTracerProvider(provider);

    registerInstrumentations({
      instrumentations: [
        new HttpInstrumentation({
          ignoreIncomingRequestHook: (req) =>
            req.url === '/api/health' || req.url === '/metrics',
        }),
        new UndiciInstrumentation(),
      ],
    });

    upstreamServer = http.createServer((req, res) => {
      receivedUpstreamTraceparent = req.headers.traceparent as
        | string
        | undefined;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{}');
    });
    await new Promise<void>((resolve) => {
      upstreamServer.listen(0, resolve);
    });
    upstreamPort = (upstreamServer.address() as AddressInfo).port;

    @Controller('ping')
    class PingController {
      @Get()
      async ping() {
        await fetch(`http://localhost:${upstreamPort}/upstream`);
        return { ok: true };
      }
    }

    @Module({ controllers: [PingController] })
    class TracePropagationTestModule {}

    app = await NestFactory.create(TracePropagationTestModule, {
      logger: false,
    });
    app.use(traceparentMiddleware);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await new Promise<void>((resolve) => {
      upstreamServer.close(() => resolve());
    });
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
      | string
      | undefined;
    expect(responseTraceparent).toBeDefined();
    expect(responseTraceparent?.split('-')[1]).toBe(inboundTraceId);

    expect(receivedUpstreamTraceparent).toBeDefined();
    expect(receivedUpstreamTraceparent?.split('-')[1]).toBe(inboundTraceId);
  });
});
