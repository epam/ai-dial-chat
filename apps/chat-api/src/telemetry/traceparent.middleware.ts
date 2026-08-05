import {
  context,
  isSpanContextValid,
  propagation,
  trace,
} from '@opentelemetry/api';
import type { NextFunction, Request, Response } from 'express';

/*
 * Reads the active OpenTelemetry span and returns its `traceparent` string, or `undefined` when
 * no valid span is active — e.g. `/api/health`/`/metrics` (excluded from tracing by
 * otel-sdk.ts's `ignoreIncomingRequestHook`) or when telemetry is disabled entirely. Shared by
 * `traceparentMiddleware` (response header) and `TraceparentErrorFilter` (JSON error body) so
 * both read the same source of truth and can never diverge.
 */
export const getActiveTraceparent = (): string | undefined => {
  const activeSpan = trace.getSpan(context.active());

  if (!activeSpan || !isSpanContextValid(activeSpan.spanContext())) {
    return undefined;
  }

  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);

  return carrier.traceparent;
};

/*
 * Reflects the active trace context back to the caller as a `traceparent` response header, on
 * both success and error responses (registered early in main.ts, before routing, so it runs
 * inside the same active span Nest's exception filters write the final response through).
 * No-op when no valid span is active.
 */
export const traceparentMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const traceparent = getActiveTraceparent();

  if (traceparent) {
    res.setHeader('traceparent', traceparent);
  }

  next();
};
