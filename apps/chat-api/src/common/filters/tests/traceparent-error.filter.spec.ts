import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { context, propagation, trace } from '@opentelemetry/api';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import type { Response } from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { TraceparentErrorFilter } from '../traceparent-error.filter';

const createHost = (response: Response): ArgumentsHost =>
  ({
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  }) as unknown as ArgumentsHost;

const createResponse = (headersSent = false): Response => {
  const res = {
    headersSent,
    status: vi.fn(),
    json: vi.fn(),
  } as unknown as Response;
  vi.mocked(res.status).mockReturnValue(res);
  return res;
};

describe('TraceparentErrorFilter', () => {
  const filter = new TraceparentErrorFilter();

  /*
   * Mirrors traceparent.middleware.spec.ts: a fresh test process has neither a real context
   * manager nor a propagator registered by default, so `context.with(...)`/`propagation.inject`
   * need the same globals `otel-sdk.ts` registers in production.
   */
  beforeAll(() => {
    context.setGlobalContextManager(new AsyncHooksContextManager().enable());
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  });

  afterAll(() => {
    context.disable();
    propagation.disable();
  });

  const withActiveSpan = (fn: () => void): void => {
    const tracerProvider = new BasicTracerProvider();
    const tracer = tracerProvider.getTracer('test');
    const span = tracer.startSpan('test-span');
    context.with(trace.setSpan(context.active(), span), fn);
    span.end();
  };

  it('adds traceparent to a mapped HttpException body when a valid span is active', () => {
    const response = createResponse();

    withActiveSpan(() => {
      filter.catch(
        new NotFoundException('Resource not found'),
        createHost(response),
      );
    });

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const body = vi.mocked(response.json).mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(body.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(body.message).toBe('Resource not found');
    expect(body.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/);
  });

  it('keeps the mapped status/message for DIAL Core-mapped errors and adds traceparent', () => {
    const response = createResponse();

    withActiveSpan(() => {
      filter.catch(
        new BadGatewayException('DIAL Core returned a server error'),
        createHost(response),
      );
    });

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_GATEWAY);
    const body = vi.mocked(response.json).mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(body.message).toBe('DIAL Core returned a server error');
    expect(body.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/);
  });

  it('maps an unmapped error to a generic 500 body and adds traceparent', () => {
    const response = createResponse();

    withActiveSpan(() => {
      filter.catch(new Error('boom'), createHost(response));
    });

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    const body = vi.mocked(response.json).mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(body.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body.message).toBe('Internal server error');
    expect(body.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/);
  });

  it('logs the stack trace for an unmapped exception (replacing Nest default filter behavior)', () => {
    const response = createResponse();
    const loggerSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const error = new Error('boom');
    filter.catch(error, createHost(response));

    expect(loggerSpy).toHaveBeenCalledWith(error.stack);
    loggerSpy.mockRestore();
  });

  it('does not log an HttpException (already surfaced via its own status/message)', () => {
    const response = createResponse();
    const loggerSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    filter.catch(
      new NotFoundException('Resource not found'),
      createHost(response),
    );

    expect(loggerSpy).not.toHaveBeenCalled();
    loggerSpy.mockRestore();
  });

  it('adds no traceparent property when no valid span is active', () => {
    const response = createResponse();

    filter.catch(
      new HttpException('Bad request', HttpStatus.BAD_REQUEST),
      createHost(response),
    );

    const body = vi.mocked(response.json).mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(body).not.toHaveProperty('traceparent');
  });

  it('does not attempt to write a response once headers have already been sent', () => {
    const response = createResponse(true);

    withActiveSpan(() => {
      filter.catch(new NotFoundException(), createHost(response));
    });

    expect(response.status).not.toHaveBeenCalled();
    expect(response.json).not.toHaveBeenCalled();
  });
});
