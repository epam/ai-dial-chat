import { describe, expect, it, vi } from 'vitest';
import { shutdownOpenTelemetry } from '../otel-sdk';

describe('shutdownOpenTelemetry', () => {
  it('resolves promptly when the underlying shutdown is fast', async () => {
    const fastShutdown = vi.fn().mockResolvedValue(undefined);

    const start = Date.now();
    await shutdownOpenTelemetry(5000, fastShutdown);
    const elapsed = Date.now() - start;

    expect(fastShutdown).toHaveBeenCalledOnce();
    expect(elapsed).toBeLessThan(1000);
  });

  it('resolves once the bounded timeout elapses, without waiting for a hung shutdown', async () => {
    const hungShutdown = vi.fn().mockReturnValue(
      new Promise<void>(() => {
        /* never resolves — simulates a hung exporter */
      }),
    );

    const start = Date.now();
    await shutdownOpenTelemetry(50, hungShutdown);
    const elapsed = Date.now() - start;

    expect(hungShutdown).toHaveBeenCalledOnce();
    expect(elapsed).toBeGreaterThanOrEqual(50);
    expect(elapsed).toBeLessThan(1000);
  });
});
