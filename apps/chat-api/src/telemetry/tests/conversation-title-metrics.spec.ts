import {
  metrics,
  type MeterProvider as ApiMeterProvider,
} from '@opentelemetry/api';
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type * as CacheModule from '../../conversations/listing/conversation-title-cache.service';
import type * as TitleMetricsModule from '../conversation-title-metrics';

class TestMetricReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {
    /* reader.collect() is called directly in assertions */
  }

  protected async onShutdown(): Promise<void> {
    /* no resources to release */
  }
}

const READ = 'dial.chat.conversation_titles.read.duration';
const QUEUE = 'dial.chat.conversation_titles.queue.duration';
const FIRST = 'dial.chat.conversation_titles.first_result.duration';
const RESULTS = 'dial.chat.conversation_titles.results';
const id = 'conversations/bucket/gpt-4o__Chat';
const summary = { name: 'Chat', llmNamingDone: true };

/*
 * The module under test binds its meter at import, so the in-memory reader is
 * registered first and the modules are imported dynamically — the same
 * ordering concern as `http-lifecycle-metrics.spec.ts`.
 */
describe('conversation-title-metrics', () => {
  let reader: TestMetricReader;
  let titleMetrics: typeof TitleMetricsModule;
  let cacheModule: typeof CacheModule;

  beforeAll(async () => {
    vi.resetModules();
    reader = new TestMetricReader();
    metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));
    titleMetrics = await import('../conversation-title-metrics');
    cacheModule =
      await import('../../conversations/listing/conversation-title-cache.service');
  });

  afterAll(() => {
    metrics.disable();
  });

  const collect = async (name: string) => {
    const { resourceMetrics } = await reader.collect();
    return resourceMetrics.scopeMetrics
      .flatMap((scope) => scope.metrics)
      .find((metric) => metric.descriptor.name === name);
  };
  const histogramCount = async (name: string, outcome: string) => {
    const metric = await collect(name);
    const point = metric?.dataPoints.find(
      (candidate) => candidate.attributes.outcome === outcome,
    );
    return (point?.value as { count: number } | undefined)?.count ?? 0;
  };

  it('records one read and one admission for reads coalesced by two consumers', async () => {
    const cache = new cacheModule.ConversationTitleCacheService();
    const read = vi.fn(async () => summary);
    const readsBefore = await histogramCount(READ, 'success');
    const admissionsBefore = await histogramCount(QUEUE, 'admitted');

    await Promise.all([
      cache.load('token', id, read),
      cache.load('token', id, read),
    ]);

    expect(read).toHaveBeenCalledOnce();
    expect(await histogramCount(READ, 'success')).toBe(readsBefore + 1);
    expect(await histogramCount(QUEUE, 'admitted')).toBe(admissionsBefore + 1);
  });

  it('records a read abandoned by its last consumer as cancelled', async () => {
    const cache = new cacheModule.ConversationTitleCacheService();
    const consumer = new AbortController();
    const before = await histogramCount(READ, 'cancelled');
    const pending = cache
      .load(
        'token',
        `${id}-cancelled`,
        (signal) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
          }),
        consumer.signal,
      )
      .catch(() => undefined);
    consumer.abort();
    await pending;
    await vi.waitFor(async () =>
      expect(await histogramCount(READ, 'cancelled')).toBe(before + 1),
    );
  });

  it('uses explicit seconds buckets so sub-second latencies are not lumped together', async () => {
    titleMetrics.recordConversationTitleFirstResult(0.03);
    const first = await collect(FIRST);
    const point = first?.dataPoints[0].value as {
      buckets: { boundaries: number[] };
    };
    expect(point.buckets.boundaries).toEqual(
      titleMetrics.CONVERSATION_TITLE_DURATION_BOUNDARIES,
    );
  });

  it('uses seconds, fixed outcome labels and no identifiers', async () => {
    const {
      ConversationTitleResultOutcome,
      recordConversationTitleFirstResult,
      recordConversationTitleResult,
    } = titleMetrics;
    recordConversationTitleFirstResult(0.25);
    for (const outcome of Object.values(ConversationTitleResultOutcome)) {
      recordConversationTitleResult(outcome);
    }

    const first = await collect(FIRST);
    const results = await collect(RESULTS);
    expect(first?.descriptor.unit).toBe('s');
    expect(first?.dataPoints[0].attributes).toEqual({});
    expect(
      results?.dataPoints.map((point) => point.attributes.outcome).sort(),
    ).toEqual(['failed', 'resolved', 'unavailable']);
    for (const name of [READ, QUEUE, FIRST, RESULTS]) {
      const metric = await collect(name);
      const keys = new Set(
        metric?.dataPoints.flatMap((point) => Object.keys(point.attributes)),
      );
      expect([...keys].every((key) => key === 'outcome')).toBe(true);
      expect(JSON.stringify(metric?.dataPoints)).not.toContain(id);
    }
  });
});

describe('conversation-title-metrics — exporter disabled or failing', () => {
  afterAll(() => {
    metrics.disable();
  });

  const recordEverything = (module: typeof TitleMetricsModule) => {
    module.recordConversationTitleFirstResult(1);
    module.recordConversationTitleRead(
      1,
      module.ConversationTitleReadOutcome.Success,
    );
    module.recordConversationTitleQueue(
      1,
      module.ConversationTitleQueueOutcome.Admitted,
    );
    module.recordConversationTitleResult(
      module.ConversationTitleResultOutcome.Resolved,
    );
  };

  it('is a no-op while OpenTelemetry metrics are disabled', async () => {
    metrics.disable();
    vi.resetModules();
    const module = await import('../conversation-title-metrics');
    expect(() => recordEverything(module)).not.toThrow();
  });

  it('never lets a failing metrics SDK reach the request', async () => {
    metrics.disable();
    const failing = () => {
      throw new Error('exporter failed');
    };
    metrics.setGlobalMeterProvider({
      getMeter: () => ({
        createHistogram: () => ({ record: failing }),
        createCounter: () => ({ add: failing }),
      }),
    } as unknown as ApiMeterProvider);
    vi.resetModules();
    const module = await import('../conversation-title-metrics');
    expect(() => recordEverything(module)).not.toThrow();
  });
});
