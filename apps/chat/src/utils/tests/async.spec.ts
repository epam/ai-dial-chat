import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runWithConcurrency } from '../async';

describe('runWithConcurrency', () => {
  it('runs every item and collects results', async () => {
    const results = await runWithConcurrency(
      [1, 2, 3, 4],
      2,
      async (n) => n * 2,
    );
    expect(results.sort((a, b) => a - b)).toEqual([2, 4, 6, 8]);
  });

  it('caps concurrent workers at the given limit', async () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    let inFlight = 0;
    let maxInFlight = 0;
    const resolvers: Array<() => void> = [];

    const runPromise = runWithConcurrency(items, 3, (item) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise<number>((resolve) => {
        resolvers.push(() => {
          inFlight -= 1;
          resolve(item);
        });
      });
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(maxInFlight).toBe(3);

    while (resolvers.length > 0) {
      resolvers.shift()?.();
      await Promise.resolve();
    }

    await runPromise;
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it('omits undefined worker results from the output', async () => {
    const results = await runWithConcurrency([1, 2, 3], 2, async (n) =>
      n === 2 ? undefined : n,
    );
    expect(results.sort((a, b) => a - b)).toEqual([1, 3]);
  });

  it('resolves immediately for an empty items array', async () => {
    const results = await runWithConcurrency<number, number>(
      [],
      5,
      async (n) => n,
    );
    expect(results).toEqual([]);
  });

  describe('when a worker throws', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('skips the failing item and still collects the rest', async () => {
      const results = await runWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      });
      expect(results.sort((a, b) => a - b)).toEqual([1, 3]);
    });

    it('lets the other concurrent items keep running instead of aborting the batch', async () => {
      const completed: number[] = [];
      const results = await runWithConcurrency(
        [1, 2, 3, 4],
        4,
        async (n) => {
          if (n === 1) throw new Error('boom');
          completed.push(n);
          return n;
        },
      );
      expect(completed.sort((a, b) => a - b)).toEqual([2, 3, 4]);
      expect(results.sort((a, b) => a - b)).toEqual([2, 3, 4]);
    });

    it('logs the error via console.error', async () => {
      const error = new Error('boom');
      await runWithConcurrency([1], 1, async () => {
        throw error;
      });
      expect(console.error).toHaveBeenCalledWith(
        'runWithConcurrency: worker failed for item',
        error,
      );
    });
  });
});
