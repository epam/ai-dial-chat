import { metrics } from '@opentelemetry/api';
import packageJson from '../../../package.json';

const meter = metrics.getMeter('dial-chat-api', packageJson.version);

/**
 * How a downstream completion response ended. A bounded four-value set so the
 * counter's only attribute can never grow cardinality, matching the fixed
 * `kind`/`outcome` attributes the telemetry and generation instruments use.
 */
export enum CompletionResponseTermination {
  /**
   * Ended by the handler once it stopped consuming the generator — a normal
   * finish, or a mid-stream failure after the status was already committed.
   * How the *generation* itself ended is `generation.requests{outcome}`; this
   * counter is about the response's lifecycle.
   */
  Completed = 'completed',
  /** The client disconnected; Node had already destroyed the response. */
  ClientClosed = 'client_closed',
  /** Detached for backpressure, then flushed and ended inside the bound. */
  BackpressureEnded = 'backpressure_ended',
  /** Detached for backpressure, then destroyed because it never flushed. */
  BackpressureDestroyed = 'backpressure_destroyed',
}

/*
 * One point per completion response that reached the streaming phase, tagged
 * only with how it ended — never with the user, conversation, deployment, or
 * session it belonged to.
 *
 * A gauge of open completion responses is deliberately absent: it would
 * duplicate `dial.chat.http.requests.active`, which already counts a response
 * for exactly as long as it stays unfinished. So is any aggregate of their
 * buffered `writableLength`, which would require this module to retain live
 * `Response` objects — the one thing `telemetry/runtime-metrics.ts` rules out
 * ("instrumentation never retains requests, credentials, streams, or per-user
 * keys"). `backpressure_destroyed` answers the operational question those
 * would have: graceful release did not complete within its bound.
 *
 * A no-op when OpenTelemetry metrics are disabled, matching
 * `generation/generation-metrics.ts`.
 */
export const completionResponseTerminations = meter.createCounter(
  'dial.chat.completion.response.terminations',
  {
    description:
      'Number of downstream completion responses that reached a terminal state, by how they ended.',
    unit: '{response}',
  },
);
