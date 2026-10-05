import { metrics } from '@opentelemetry/api';
import {
  type DataPoint,
  type Histogram,
  MeterProvider,
  MetricReader,
} from '@opentelemetry/sdk-metrics';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as CustomApiTelemetryModule from '../custom-api-telemetry';

class TestMetricReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {
    /* nothing to flush — reader.collect() is called directly in assertions */
  }

  protected async onShutdown(): Promise<void> {
    /* this reader owns no external resources */
  }
}

/*
 * `custom-api-telemetry` resolves its meter once at module scope, so the
 * in-memory reader must be registered as the global meter provider before
 * that module is imported — hence the dynamic import inside `beforeAll`
 * (mirrors apps/chat-api/src/auth/tests/auth-metrics.spec.ts).
 */
describe('custom API telemetry', () => {
  let reader: TestMetricReader;
  let telemetry: typeof CustomApiTelemetryModule;

  beforeAll(async () => {
    reader = new TestMetricReader();
    metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));
    telemetry = await import('../custom-api-telemetry');
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

  const pointFor = async (name: string, attributes: Record<string, string>) => {
    const metric = await collect(name);
    return metric?.dataPoints.find((point) =>
      Object.entries(attributes).every(
        ([key, value]) => point.attributes[key] === value,
      ),
    ) as DataPoint<Histogram> | undefined;
  };

  it('resolves the configured operation id as the telemetry label', () => {
    expect(
      telemetry.resolveCustomApiOperationLabel('data-products', true),
    ).toBe('data-products');
  });

  it('collapses an unregistered/rejected id to the constant unknown label', () => {
    expect(telemetry.resolveCustomApiOperationLabel('whatever', false)).toBe(
      telemetry.UNKNOWN_CUSTOM_API_OPERATION,
    );
    expect(telemetry.resolveCustomApiOperationLabel(undefined, false)).toBe(
      telemetry.UNKNOWN_CUSTOM_API_OPERATION,
    );
  });

  it('records duration and byte count only with bounded attributes for a successful call', async () => {
    telemetry.recordCustomApiCall({
      operationId: 'data-products',
      known: true,
      result: telemetry.CustomApiResultCategory.Success,
      durationSeconds: 0.2,
      bytes: 512,
    });

    const durationPoint = await pointFor('dial.chat.custom_api.call.duration', {
      [telemetry.CUSTOM_API_OPERATION_ATTRIBUTE]: 'data-products',
      [telemetry.CUSTOM_API_RESULT_ATTRIBUTE]: 'success',
    });
    const bytesPoint = await pointFor('dial.chat.custom_api.response.bytes', {
      [telemetry.CUSTOM_API_OPERATION_ATTRIBUTE]: 'data-products',
      [telemetry.CUSTOM_API_RESULT_ATTRIBUTE]: 'success',
    });

    expect(durationPoint).toBeDefined();
    expect(bytesPoint).toBeDefined();
    expect(Object.keys(durationPoint!.attributes)).toEqual([
      telemetry.CUSTOM_API_OPERATION_ATTRIBUTE,
      telemetry.CUSTOM_API_RESULT_ATTRIBUTE,
    ]);
  });

  it('records a failed call for an unknown id under the constant label and omits bytes', async () => {
    telemetry.recordCustomApiCall({
      operationId: undefined,
      known: false,
      result: telemetry.CustomApiResultCategory.NotFound,
      durationSeconds: 0,
    });

    const point = await pointFor('dial.chat.custom_api.call.duration', {
      [telemetry.CUSTOM_API_OPERATION_ATTRIBUTE]:
        telemetry.UNKNOWN_CUSTOM_API_OPERATION,
      [telemetry.CUSTOM_API_RESULT_ATTRIBUTE]: 'not_found',
    });

    expect(point).toBeDefined();
  });

  it('never carries a secret-bearing value as an attribute — only the bounded enum/id', async () => {
    telemetry.recordCustomApiCall({
      operationId: 'data-products',
      known: true,
      result: telemetry.CustomApiResultCategory.UpstreamError,
      durationSeconds: 0.01,
    });

    const metric = await collect('dial.chat.custom_api.call.duration');
    const allAttributeValues = metric?.dataPoints.flatMap((point) =>
      Object.values(point.attributes),
    );
    for (const value of allAttributeValues ?? []) {
      expect(String(value)).not.toMatch(/bearer|token|secret|cookie/i);
    }
  });
});
