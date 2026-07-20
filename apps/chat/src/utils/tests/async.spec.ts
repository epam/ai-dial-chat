import { describe, expect, it } from 'vitest';
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
});
