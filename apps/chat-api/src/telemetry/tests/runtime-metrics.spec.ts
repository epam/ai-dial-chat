import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initializeRuntimeMetrics,
  SseSubscriptionKind,
  trackGeneration,
  trackSseSubscription,
} from '../runtime-metrics';

class TestMetricReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {
    /* Collection is driven explicitly by each assertion. */
  }

  protected async onShutdown(): Promise<void> {
    /* This reader owns no external resources. */
  }
}

const memoryUsage: NodeJS.MemoryUsage = {
  rss: 500,
  heapUsed: 100,
  heapTotal: 200,
  external: 80,
  arrayBuffers: 40,
};

describe('runtime metrics', () => {
  let reader: TestMetricReader;
  let provider: MeterProvider;
  let stopCollecting: () => void;
  let finishOperations: (() => void)[];

  beforeEach(() => {
    reader = new TestMetricReader();
    provider = new MeterProvider({ readers: [reader] });
    finishOperations = [];
    vi.spyOn(process, 'memoryUsage').mockReturnValue(memoryUsage);
    stopCollecting = initializeRuntimeMetrics(
      provider.getMeter('test-runtime'),
    );
  });

  afterEach(async () => {
    for (const finish of finishOperations) finish();
    stopCollecting();
    await provider.shutdown();
    vi.restoreAllMocks();
  });

  const collectMetrics = async () => {
    const { resourceMetrics } = await reader.collect();
    return resourceMetrics.scopeMetrics.flatMap((scope) => scope.metrics);
  };

  const collectValues = async (name: string) => {
    const collected = await collectMetrics();
    return collected
      .find((metric) => metric.descriptor.name === name)
      ?.dataPoints.map(({ value, attributes }) => ({ value, attributes }));
  };

  it('samples all memory fields once per collection with only fixed kind labels', async () => {
    expect(process.memoryUsage).not.toHaveBeenCalled();

    const collected = await collectMetrics();
    const memory = collected.find(
      (metric) => metric.descriptor.name === 'dial.chat.process.memory',
    );

    expect(process.memoryUsage).toHaveBeenCalledOnce();
    expect(memory?.descriptor.unit).toBe('B');
    expect(
      memory?.dataPoints.map(({ value, attributes }) => ({
        value,
        attributes,
      })),
    ).toEqual([
      { value: 500, attributes: { kind: 'rss' } },
      { value: 100, attributes: { kind: 'heap_used' } },
      { value: 200, attributes: { kind: 'heap_total' } },
      { value: 80, attributes: { kind: 'external' } },
      { value: 40, attributes: { kind: 'array_buffers' } },
    ]);

    vi.mocked(process.memoryUsage).mockReturnValue({
      ...memoryUsage,
      heapUsed: 150,
    });
    expect(await collectValues('dial.chat.process.memory')).toContainEqual({
      value: 150,
      attributes: { kind: 'heap_used' },
    });
    expect(process.memoryUsage).toHaveBeenCalledTimes(2);
  });

  it('exports explicit zero series before any subscriptions or generations exist', async () => {
    expect(await collectValues('dial.chat.sse.active')).toEqual(
      Object.values(SseSubscriptionKind).map((kind) => ({
        value: 0,
        attributes: { kind },
      })),
    );
    expect(await collectValues('dial.chat.generations.active')).toEqual([
      { value: 0, attributes: {} },
    ]);
  });

  it('counts concurrent subscriptions independently by kind and ignores repeated completion', async () => {
    const finishClient = trackSseSubscription(
      SseSubscriptionKind.ClientChannel,
    );
    const finishOtherClient = trackSseSubscription(
      SseSubscriptionKind.ClientChannel,
    );
    const finishWatch = trackSseSubscription(
      SseSubscriptionKind.ConversationWatch,
    );
    const finishAttach = trackSseSubscription(
      SseSubscriptionKind.GenerationAttach,
    );
    finishOperations.push(
      finishClient,
      finishOtherClient,
      finishWatch,
      finishAttach,
    );

    expect(await collectValues('dial.chat.sse.active')).toEqual([
      { value: 2, attributes: { kind: SseSubscriptionKind.ClientChannel } },
      { value: 1, attributes: { kind: SseSubscriptionKind.ConversationWatch } },
      { value: 1, attributes: { kind: SseSubscriptionKind.GenerationAttach } },
    ]);

    finishClient();
    finishClient();
    finishWatch();
    finishAttach();

    expect(await collectValues('dial.chat.sse.active')).toEqual([
      { value: 1, attributes: { kind: SseSubscriptionKind.ClientChannel } },
      { value: 0, attributes: { kind: SseSubscriptionKind.ConversationWatch } },
      { value: 0, attributes: { kind: SseSubscriptionKind.GenerationAttach } },
    ]);
  });

  it('counts active generations independently of attached clients without operation labels', async () => {
    const finishFirst = trackGeneration();
    const finishSecond = trackGeneration();
    const finishAttach = trackSseSubscription(
      SseSubscriptionKind.GenerationAttach,
    );
    finishOperations.push(finishFirst, finishSecond, finishAttach);
    finishAttach();

    expect(await collectValues('dial.chat.generations.active')).toEqual([
      { value: 2, attributes: {} },
    ]);
    finishFirst();
    finishFirst();
    expect(await collectValues('dial.chat.generations.active')).toEqual([
      { value: 1, attributes: {} },
    ]);
    finishSecond();
    expect(await collectValues('dial.chat.generations.active')).toEqual([
      { value: 0, attributes: {} },
    ]);
  });

  it('stops memory sampling when callbacks are removed and preserves live counts on reinitialization', async () => {
    const finish = trackGeneration();
    finishOperations.push(finish);
    await collectMetrics();
    vi.mocked(process.memoryUsage).mockClear();

    stopCollecting();
    stopCollecting();
    await collectMetrics();
    expect(process.memoryUsage).not.toHaveBeenCalled();

    stopCollecting = initializeRuntimeMetrics(
      provider.getMeter('test-runtime'),
    );
    expect(await collectValues('dial.chat.generations.active')).toEqual([
      { value: 1, attributes: {} },
    ]);
    expect(process.memoryUsage).toHaveBeenCalledOnce();
  });

  it('tracks operation lifetimes without sampling memory when collection is disabled', () => {
    stopCollecting();
    const finishSubscription = trackSseSubscription(
      SseSubscriptionKind.ClientChannel,
    );
    const finishGeneration = trackGeneration();
    finishOperations.push(finishSubscription, finishGeneration);
    finishSubscription();
    finishGeneration();

    expect(process.memoryUsage).not.toHaveBeenCalled();
  });
});
