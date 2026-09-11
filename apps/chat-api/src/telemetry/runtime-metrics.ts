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

const activeSubscriptions: Record<SseSubscriptionKind, number> = {
  [SseSubscriptionKind.ClientChannel]: 0,
  [SseSubscriptionKind.ConversationWatch]: 0,
  [SseSubscriptionKind.GenerationAttach]: 0,
};
let activeGenerations = 0;

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

export const trackGeneration = (): (() => void) => {
  activeGenerations += 1;
  let finished = false;

  return () => {
    if (finished) return;
    finished = true;
    activeGenerations -= 1;
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
        'Conversation generations retained by the process until registry removal.',
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
    result.observe(generations, activeGenerations);
  };

  meter.addBatchObservableCallback(collect, observables);

  return () => meter.removeBatchObservableCallback(collect, observables);
};
