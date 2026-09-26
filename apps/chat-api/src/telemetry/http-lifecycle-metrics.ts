import { metrics } from '@opentelemetry/api';
import packageJson from '../../package.json';
import { UNMATCHED_ROUTE } from './http-metrics';

const meter = metrics.getMeter('dial-chat-api', packageJson.version);

/*
 * Bounded HTTP method attribute value shared by all three instruments below — see design.md D4.
 * Any method Node accepts but this list doesn't name (e.g. a client sending `TRACE` or a typo'd
 * verb) collapses to `unknown` rather than growing the attribute's cardinality unboundedly.
 */
const KNOWN_HTTP_METHODS = new Set([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
]);

export const UNKNOWN_HTTP_METHOD = 'unknown';

export const resolveHttpMethod = (method: string | undefined): string =>
  method != null && KNOWN_HTTP_METHODS.has(method)
    ? method
    : UNKNOWN_HTTP_METHOD;

/*
 * Terminal outcome of a monitored request's HTTP transport lifecycle — see design.md D3. A
 * bounded 4-value enum instead of a free-form status so `dial.chat.http.outcome` never grows an
 * unbounded set of values, and so "client left before we could answer" / "client left mid-stream"
 * / "the transport itself failed" stay distinguishable instead of collapsing into one bucket.
 */
export enum HttpLifecycleOutcome {
  Completed = 'completed',
  AbortedBeforeResponse = 'aborted_before_response',
  AbortedDuringResponse = 'aborted_during_response',
  Error = 'error',
}

/*
 * Coarse transport shape resolved from the matched route template at settle time — see
 * design.md D5. Lets the dashboard filter one histogram into "ordinary REST" vs "long-lived
 * streaming" views by attribute instead of needing a second metric name.
 */
export enum TransportKind {
  Ordinary = 'ordinary',
  Streaming = 'streaming',
  Unmatched = 'unmatched',
}

/*
 * Fixed, explicit list of long-lived SSE route templates — verified against
 * `conversation.controller.ts` and `client-channel.controller.ts` (design.md D5). A new
 * streaming route added later without updating this list still records correctly, just under
 * `ordinary` instead of `streaming` — an imprecise bucket, not a correctness bug (design.md
 * Risks).
 */
const STREAMING_ROUTE_TEMPLATES = new Set([
  '/api/v1/conversations/completions',
  '/api/v1/conversations/completions/attach',
  '/api/v1/conversations/watch',
  '/api/v1/client-channel/subscribe',
]);

export const resolveTransportKind = (route: string): TransportKind => {
  if (route === UNMATCHED_ROUTE) return TransportKind.Unmatched;
  return STREAMING_ROUTE_TEMPLATES.has(route)
    ? TransportKind.Streaming
    : TransportKind.Ordinary;
};

export const httpRequestsStarted = meter.createCounter(
  'dial.chat.http.requests.started',
  {
    description:
      'HTTP requests that have entered the monitored transport scope, counted at arrival.',
    unit: '{request}',
  },
);

export const httpRequestsActive = meter.createUpDownCounter(
  'dial.chat.http.requests.active',
  {
    description:
      'HTTP requests currently in flight in the monitored transport scope.',
    unit: '{request}',
  },
);

/*
 * Explicit sub-second-aware bucket boundaries (design.md D5) — the OTel SDK's default boundaries
 * start at 0/5/10s, which is unusable for typical sub-second BFF latency. Spans both ordinary
 * REST and longer-lived streaming durations so one histogram serves both regimes; see D5's
 * bucket-boundary compatibility policy before ever editing this array in place.
 */
export const HTTP_RESPONSE_DURATION_BOUNDARIES = [
  0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 10, 30, 60,
];

export const httpResponseDuration = meter.createHistogram(
  'dial.chat.http.response.duration',
  {
    description:
      'Terminal duration of the raw HTTP transport lifecycle, from request arrival to settlement (finish, abort, or error) — recorded exactly once per monitored request, independent of Nest handler settlement.',
    unit: 's',
    advice: {
      explicitBucketBoundaries: HTTP_RESPONSE_DURATION_BOUNDARIES,
    },
  },
);
