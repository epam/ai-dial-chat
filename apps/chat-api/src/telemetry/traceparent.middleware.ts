import {
  context,
  isSpanContextValid,
  propagation,
  trace,
} from '@opentelemetry/api';
import type { NextFunction, Request, Response } from 'express';

/*
 * Reflects the active trace context back to the caller as a `traceparent` response header, on
 * both success and error responses (registered early in main.ts, before routing, so it runs
 * inside the same active span Nest's exception filters write the final response through).
 * No-op when no valid span is active — e.g. `/api/health`/`/metrics` (excluded from tracing by
 * otel-sdk.ts's `ignoreIncomingRequestHook`) or when telemetry is disabled entirely.
 */
export const traceparentMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const activeSpan = trace.getSpan(context.active());

  if (activeSpan && isSpanContextValid(activeSpan.spanContext())) {
    const carrier: Record<string, string> = {};
    propagation.inject(context.active(), carrier);

    if (carrier.traceparent) {
      res.setHeader('traceparent', carrier.traceparent);
    }
  }

  next();
};
