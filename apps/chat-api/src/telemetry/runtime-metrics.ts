import {
  metrics,
  type BatchObservableCallback,
  type Meter,
} from '@opentelemetry/api';
import packageJson from '../../package.json';

export enum SseSubscriptionKind {
  ClientChannel = 'client_channel',
  ConversationWatch = 'conversation_watch',
  GenerationAttach = 'generation_attach',
}

/*
 * Mirrors the four non-released values of
 * `ConversationGenerationService`'s `GenerationLifecycleState` — declared
 * locally rather than imported, so this infrastructure module does not
 * depend back on the domain service that already depends on it. `released`
 * is deliberately absent: a released entry contributes nothing to the gauge
 * (`observability-telemetry`).
 */
export enum GenerationGaugeState {
  Active = 'active',
  CancelRequested = 'cancel_requested',
  Finalizing = 'finalizing',
  Settling = 'settling',
}

const activeSubscriptions: Record<SseSubscriptionKind, number> = {
  [SseSubscriptionKind.ClientChannel]: 0,
  [SseSubscriptionKind.ConversationWatch]: 0,
  [SseSubscriptionKind.GenerationAttach]: 0,
};
const activeGenerationsByState: Record<GenerationGaugeState, number> = {
  [GenerationGaugeState.Active]: 0,
  [GenerationGaugeState.CancelRequested]: 0,
  [GenerationGaugeState.Finalizing]: 0,
  [GenerationGaugeState.Settling]: 0,
};

/*
 * Only fixed counters live here. An operation owns its completion callback, so
 * instrumentation never retains requests, credentials, streams, or per-user keys.
 */
export const trackSseSubscription = (
  kind: SseSubscriptionKind,
): (() => void) => {
  activeSubscriptions[kind] += 1;
  let finished = false;

  return () => {
    if (finished) return;
    finished = true;
    activeSubscriptions[kind] -= 1;
  };
};

export interface GenerationTracker {
  /** Moves the entry's retained count from its current state to `state`. */
  setState: (state: GenerationGaugeState) => void;
  /** Releases the entry's retained count. Idempotent. */
  finish: () => void;
}

export const trackGeneration = (
  initialState: GenerationGaugeState = GenerationGaugeState.Active,
): GenerationTracker => {
  let currentState = initialState;
  activeGenerationsByState[currentState] += 1;
  let finished = false;

  return {
    setState: (state: GenerationGaugeState) => {
      if (finished || state === currentState) return;
      activeGenerationsByState[currentState] -= 1;
      currentState = state;
      activeGenerationsByState[currentState] += 1;
    },
    finish: () => {
      if (finished) return;
      finished = true;
      activeGenerationsByState[currentState] -= 1;
    },
  };
};

export const initializeRuntimeMetrics = (
  meter: Meter = metrics.getMeter('dial-chat-api', packageJson.version),
): (() => void) => {
  const memory = meter.createObservableGauge('dial.chat.process.memory', {
    description: 'Memory used or reserved by the NestJS Node.js process.',
    unit: 'B',
  });
  const subscriptions = meter.createObservableGauge('dial.chat.sse.active', {
    description: 'Active SSE subscriptions, including pending upstream setup.',
  });
  const generations = meter.createObservableGauge(
    'dial.chat.generations.active',
    {
      description:
        'Conversation generations retained by the process until registry removal, broken down by lifecycle state. A falling value is not evidence of durable persistence — see docs/observability.md.',
    },
  );
  const observables = [memory, subscriptions, generations];

  const collect: BatchObservableCallback = (result) => {
    const usage = process.memoryUsage();
    result.observe(memory, usage.rss, { kind: 'rss' });
    result.observe(memory, usage.heapUsed, { kind: 'heap_used' });
    result.observe(memory, usage.heapTotal, { kind: 'heap_total' });
    result.observe(memory, usage.external, { kind: 'external' });
    result.observe(memory, usage.arrayBuffers, { kind: 'array_buffers' });

    for (const kind of Object.values(SseSubscriptionKind)) {
      result.observe(subscriptions, activeSubscriptions[kind], { kind });
    }
    for (const state of Object.values(GenerationGaugeState)) {
      result.observe(generations, activeGenerationsByState[state], { state });
    }
  };

  meter.addBatchObservableCallback(collect, observables);

  return () => meter.removeBatchObservableCallback(collect, observables);
};
