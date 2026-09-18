import { metrics } from '@opentelemetry/api';
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as CompletionResponseMetricsModule from '../completion-response-metrics';

class TestMetricReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {
    /* nothing to flush — reader.collect() is called directly in assertions */
  }

  protected async onShutdown(): Promise<void> {
    /* no resources to release */
  }
}

const METRIC_NAME = 'dial.chat.completion.response.terminations';

/*
 * Same global-MeterProvider-ordering concern as `telemetry/tests/http-lifecycle-metrics.spec.ts`:
 * the module under test calls `metrics.getMeter(...)` at module scope, so the in-memory reader
 * must be registered before the module is (dynamically) imported.
 */
describe('completion-response-metrics', () => {
  let reader: TestMetricReader;
  let completionResponseMetrics: typeof CompletionResponseMetricsModule;

  beforeAll(async () => {
    reader = new TestMetricReader();
    metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));

    completionResponseMetrics = await import('../completion-response-metrics');
  });

  afterAll(() => {
    metrics.disable();
  });

  const collectTerminations = async () => {
    const { resourceMetrics } = await reader.collect();
    return resourceMetrics.scopeMetrics
      .flatMap((scope) => scope.metrics)
      .find((metric) => metric.descriptor.name === METRIC_NAME);
  };

  it('records one point per termination reason, with unit {response}', async () => {
    const { completionResponseTerminations, CompletionResponseTermination } =
      completionResponseMetrics;

    for (const reason of Object.values(CompletionResponseTermination)) {
      completionResponseTerminations.add(1, { reason });
    }

    const metric = await collectTerminations();

    expect(metric?.descriptor.unit).toBe('{response}');
    expect(metric?.dataPoints).toHaveLength(4);
    expect(metric?.dataPoints.map((point) => point.value)).toEqual([
      1, 1, 1, 1,
    ]);
  });

  it('exposes exactly the four bounded reasons and no unbounded identifier', async () => {
    const { CompletionResponseTermination } = completionResponseMetrics;

    expect(Object.values(CompletionResponseTermination)).toEqual([
      'completed',
      'client_closed',
      'backpressure_ended',
      'backpressure_destroyed',
    ]);

    const metric = await collectTerminations();
    const attributeKeys = metric?.dataPoints.flatMap((point) =>
      Object.keys(point.attributes),
    );

    expect(new Set(attributeKeys)).toEqual(new Set(['reason']));
  });
});
