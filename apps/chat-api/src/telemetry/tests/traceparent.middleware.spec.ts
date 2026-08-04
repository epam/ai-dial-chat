import { context, propagation, trace } from '@opentelemetry/api';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import type { Response } from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { traceparentMiddleware } from '../traceparent.middleware';

const createResponse = (): Response =>
  ({
    setHeader: vi.fn(),
  }) as unknown as Response;

describe('traceparentMiddleware', () => {
  beforeAll(() => {
    /* Mirrors what otel-sdk.ts's NodeSDK registers globally in production; a fresh test process
     * has neither a real context manager nor a propagator registered by default, so
     * `context.with(...)` wouldn't actually switch the active context and `propagation.inject`
     * would be a no-op. */
    context.setGlobalContextManager(new AsyncHooksContextManager().enable());
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  });

  /*
   * Deregister the global context manager and propagator this spec installed — see
   * `http-metrics.spec.ts` for why every OTel-global-mutating spec cleans up after itself.
   */
  afterAll(() => {
    context.disable();
    propagation.disable();
  });

  it('sets a W3C-format traceparent header when a valid span is active', () => {
    const tracerProvider = new BasicTracerProvider();
    const tracer = tracerProvider.getTracer('test');
    const span = tracer.startSpan('test-span');
    const res = createResponse();
    const next = vi.fn();

    context.with(trace.setSpan(context.active(), span), () => {
      traceparentMiddleware(undefined as never, res, next);
    });
    span.end();

    expect(res.setHeader).toHaveBeenCalledOnce();
    const [headerName, headerValue] = vi.mocked(res.setHeader).mock.calls[0];
    expect(headerName).toBe('traceparent');
    expect(headerValue).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/);
    expect(next).toHaveBeenCalledOnce();
  });

  it('does not set a traceparent header when no span is active (e.g. /api/health, /metrics)', () => {
    const res = createResponse();
    const next = vi.fn();

    traceparentMiddleware(undefined as never, res, next);

    expect(res.setHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });
});
