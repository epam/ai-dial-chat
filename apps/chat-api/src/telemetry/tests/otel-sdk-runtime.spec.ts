import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeOpenTelemetry, shutdownOpenTelemetry } from '../otel-sdk';

const { start, shutdown, stopRuntimeMetrics, initializeRuntimeMetrics } =
  vi.hoisted(() => {
    const stopRuntimeMetrics = vi.fn();
    return {
      start: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined),
      stopRuntimeMetrics,
      initializeRuntimeMetrics: vi.fn().mockReturnValue(stopRuntimeMetrics),
    };
  });

vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: class {
    start = start;
    shutdown = shutdown;
  },
}));
vi.mock('../runtime-metrics', () => ({ initializeRuntimeMetrics }));

const metricsOnlyEnv = {
  OTEL_SDK_DISABLED: 'false',
  OTEL_TRACES_EXPORTER: 'none',
  OTEL_LOGS_EXPORTER: 'none',
  OTEL_METRICS_EXPORTER: 'otlp',
};

describe('runtime metric SDK lifecycle', () => {
  afterEach(async () => {
    await shutdownOpenTelemetry(0);
    vi.clearAllMocks();
  });

  it('registers runtime observations only after the SDK installs its meter provider', () => {
    initializeOpenTelemetry(metricsOnlyEnv);

    expect(start).toHaveBeenCalledOnce();
    expect(initializeRuntimeMetrics).toHaveBeenCalledOnce();
    expect(start.mock.invocationCallOrder[0]).toBeLessThan(
      initializeRuntimeMetrics.mock.invocationCallOrder[0],
    );
  });

  it.each(['none', 'prometheus,none', 'unsupported'])(
    'does not register runtime observations with metrics exporter %s',
    (exporter) => {
      initializeOpenTelemetry({
        ...metricsOnlyEnv,
        OTEL_METRICS_EXPORTER: exporter,
      });

      expect(start).toHaveBeenCalledOnce();
      expect(initializeRuntimeMetrics).not.toHaveBeenCalled();
    },
  );

  it('does not register runtime observations when the SDK is disabled', () => {
    initializeOpenTelemetry({ ...metricsOnlyEnv, OTEL_SDK_DISABLED: 'true' });

    expect(start).not.toHaveBeenCalled();
    expect(initializeRuntimeMetrics).not.toHaveBeenCalled();
  });

  it('removes runtime callbacks once before shutting down exporters', async () => {
    initializeOpenTelemetry(metricsOnlyEnv);
    await shutdownOpenTelemetry(0);
    await shutdownOpenTelemetry(0);

    expect(stopRuntimeMetrics).toHaveBeenCalledOnce();
    expect(stopRuntimeMetrics.mock.invocationCallOrder[0]).toBeLessThan(
      shutdown.mock.invocationCallOrder[0],
    );
  });
});
