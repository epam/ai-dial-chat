import {
  context,
  metrics,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import type { RequestHandler } from 'express';
import packageJson from '../../package.json';
import { initializeCoreRequestTiming } from './core-request-timing';
import { isExcludedFromTelemetry } from './excluded-paths';
import {
  HttpLifecycleOutcome,
  resolveHttpMethod,
  resolveTransportKind,
} from './http-lifecycle-metrics';
import { resolveRouteTemplate } from './http-metrics';
import { parseOtelConfig } from './otel-config';
import {
  RequestTimingPhase,
  RequestTimingState,
  requestTimingStorage,
} from './request-timing-state';

export const REQUEST_PHASE_DURATION_BOUNDARIES = [
  0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 10, 30, 60,
  120, 300, 600, 1800, 3600,
];

const meter = metrics.getMeter('dial-chat-api', packageJson.version);
const tracer = trace.getTracer('dial-chat-api', packageJson.version);
const requestPhaseDuration = meter.createHistogram(
  'dial.chat.http.request.phase.duration',
  {
    description:
      'Request wall time from the first Express middleware to HTTP settlement, split into total, the union of Core wire intervals, and time outside Core.',
    unit: 's',
    advice: { explicitBucketBoundaries: REQUEST_PHASE_DURATION_BOUNDARIES },
  },
);

/*
 * Register before cookies, body parsing and guards. This is a separate timing
 * population from the raw Node lifecycle metric: each request that reaches
 * this middleware contributes three values at the same terminal boundary.
 * AsyncLocalStorage.run isolates concurrent requests without enterWith leakage.
 */
export const createRequestTimingMiddleware = (
  env: NodeJS.ProcessEnv = process.env,
): RequestHandler => {
  const config = parseOtelConfig(env);
  if (
    config.disabled ||
    (config.metricsExporters.length === 0 && config.tracesExporter === 'none')
  ) {
    return (_req, _res, next) => next();
  }
  initializeCoreRequestTiming();

  return (req, res, next) => {
    if (isExcludedFromTelemetry(req.url)) {
      next();
      return;
    }

    const timing = new RequestTimingState();
    const method = resolveHttpMethod(req.method);
    const span = tracer.startSpan('request.timing', {
      kind: SpanKind.INTERNAL,
      attributes: { 'dial.chat.http.request.timing': true },
    });
    let settled = false;

    const settle = (outcome: HttpLifecycleOutcome): void => {
      if (settled) return;
      settled = true;
      const durations = timing.settle();
      const route = resolveRouteTemplate(req);
      const attributes: Record<string, string | number> = {
        'http.request.method': method,
        'http.route': route,
        'dial.chat.http.outcome': outcome,
        'dial.chat.http.transport_kind': resolveTransportKind(route),
      };
      if (res.headersSent) {
        attributes['http.response.status_code'] = res.statusCode;
      }

      for (const phase of Object.values(RequestTimingPhase)) {
        requestPhaseDuration.record(durations[phase], {
          ...attributes,
          'dial.chat.http.phase': phase,
        });
      }

      span.updateName(`request.timing ${method} ${route}`);
      span.setAttributes({
        ...attributes,
        'dial.chat.http.duration.total': durations.total,
        'dial.chat.http.duration.core': durations.core,
        'dial.chat.http.duration.chat': durations.chat,
      });
      if (outcome !== HttpLifecycleOutcome.Completed || res.statusCode >= 500) {
        span.setStatus({ code: SpanStatusCode.ERROR });
      }
      span.end();

      res.off('finish', onFinish);
      res.off('close', onAbort);
      res.off('error', onError);
      req.off('aborted', onAbort);
      req.off('error', onError);
    };
    const onFinish = (): void => settle(HttpLifecycleOutcome.Completed);
    const onAbort = (): void =>
      settle(
        res.headersSent
          ? HttpLifecycleOutcome.AbortedDuringResponse
          : HttpLifecycleOutcome.AbortedBeforeResponse,
      );
    const onError = (): void => settle(HttpLifecycleOutcome.Error);

    res.once('finish', onFinish);
    res.once('close', onAbort);
    res.once('error', onError);
    req.once('aborted', onAbort);
    req.once('error', onError);

    context.with(trace.setSpan(context.active(), span), () =>
      requestTimingStorage.run(timing, next),
    );
  };
};
