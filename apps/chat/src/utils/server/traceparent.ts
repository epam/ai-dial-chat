import { context, propagation, trace } from '@opentelemetry/api';

const TRACEPARENT_REGEX = new RegExp(
  /^([0-9a-f]{2})-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/,
);

export const getCurrentTraceparent = (): string | undefined => {
  const carrier: Record<string, string> = {};

  propagation.inject(context.active(), carrier);

  if (carrier.traceparent) {
    return carrier.traceparent;
  }

  const activeSpan = trace.getSpan(context.active());
  const spanContext = activeSpan?.spanContext();

  if (!spanContext?.traceId || !spanContext?.spanId) {
    return undefined;
  }

  const traceFlags = spanContext.traceFlags.toString(16).padStart(2, '0');

  return `00-${spanContext.traceId}-${spanContext.spanId}-${traceFlags}`;
};

export const setTraceparentHeader = (res: {
  setHeader: (name: string, value: string) => void;
}): string | undefined => {
  const traceparent = getCurrentTraceparent();

  if (traceparent) {
    res.setHeader('traceparent', traceparent);
  }

  return traceparent;
};

export const getTraceIdFromTraceparent = (traceparent?: string) => {
  return traceparent && TRACEPARENT_REGEX.test(traceparent)
    ? traceparent.split('-')[1]
    : undefined;
};
