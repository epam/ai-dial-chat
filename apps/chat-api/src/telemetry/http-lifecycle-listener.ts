import type * as http from 'http';
import { isExcludedFromTelemetry } from './excluded-paths';
import {
  HttpLifecycleOutcome,
  httpRequestsActive,
  httpRequestsStarted,
  httpResponseDuration,
  resolveHttpMethod,
  resolveTransportKind,
} from './http-lifecycle-metrics';
import { resolveRouteTemplate } from './http-metrics';
import { parseOtelConfig } from './otel-config';

/*
 * Records the one terminal data point for a monitored request and releases its
 * `requests.active` contribution — see design.md D2. `settled` is the single guard shared by
 * every terminal event listener below: whichever of `finish`/`close`/`error`/`aborted` fires
 * first wins, and every later event on the same request/response pair is a no-op. This is what
 * guarantees "exactly one terminal recording" even though `'close'` always eventually follows
 * `'finish'` on a normal keep-alive teardown (Requirement 2).
 */
const settleRequest = (
  entryTime: bigint,
  entryAttributes: Record<string, string>,
  res: http.ServerResponse,
): ((outcome: HttpLifecycleOutcome) => void) => {
  let settled = false;

  return (outcome: HttpLifecycleOutcome) => {
    if (settled) return;
    settled = true;

    httpRequestsActive.add(-1, entryAttributes);

    const durationNs = process.hrtime.bigint() - entryTime;
    const durationSeconds = Number(durationNs) / 1e9;

    const route = resolveRouteTemplate(
      res.req as unknown as { route?: { path?: unknown } },
    );

    const attributes: Record<string, string | number> = {
      ...entryAttributes,
      'http.route': route,
      'dial.chat.http.outcome': outcome,
      'dial.chat.http.transport_kind': resolveTransportKind(route),
    };
    if (res.headersSent) {
      attributes['http.response.status_code'] = res.statusCode;
    }

    httpResponseDuration.record(durationSeconds, attributes);
  };
};

/*
 * Attaches the raw `http.Server` `'request'` listener that observes the complete HTTP transport
 * lifecycle (arrival → in-flight → terminal outcome) — see design.md D1. This fires before
 * Express body parsers, `helmet`, CORS, Nest guards/pipes, and routing ever touch the request, so
 * it sees guard rejections, body-parser failures, and unmatched routes that the existing
 * `MetricsInterceptor` (a Nest interceptor, running after all of that) never observes.
 */
export const attachHttpLifecycleListener = (
  server: http.Server,
  env: NodeJS.ProcessEnv = process.env,
): void => {
  const { disabled, metricsExporters } = parseOtelConfig(env);
  if (disabled || metricsExporters.length === 0) return;

  server.on(
    'request',
    (req: http.IncomingMessage, res: http.ServerResponse) => {
      if (isExcludedFromTelemetry(req.url)) return;

      const entryTime = process.hrtime.bigint();
      const entryAttributes = {
        'http.request.method': resolveHttpMethod(req.method),
      };

      httpRequestsStarted.add(1, entryAttributes);
      httpRequestsActive.add(1, entryAttributes);

      const settle = settleRequest(entryTime, entryAttributes, res);

      /*
       * `'close'` fires in addition to `'finish'` on a normal teardown, and instead of `'finish'`
       * on a genuine client abort — it must never, by itself, be read as "completed" (design.md
       * D2/D3). `res.headersSent` at the time `'close'` fires is what distinguishes "the client
       * left before we could answer" from "the client left mid-stream".
       */
      res.once('finish', () => settle(HttpLifecycleOutcome.Completed));
      res.once('close', () =>
        settle(
          res.headersSent
            ? HttpLifecycleOutcome.AbortedDuringResponse
            : HttpLifecycleOutcome.AbortedBeforeResponse,
        ),
      );
      res.once('error', () => settle(HttpLifecycleOutcome.Error));
      req.once('aborted', () =>
        settle(
          res.headersSent
            ? HttpLifecycleOutcome.AbortedDuringResponse
            : HttpLifecycleOutcome.AbortedBeforeResponse,
        ),
      );
      req.once('error', () => settle(HttpLifecycleOutcome.Error));
    },
  );
};
