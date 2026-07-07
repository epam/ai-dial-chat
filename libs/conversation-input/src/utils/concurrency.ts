/**
 * Runs `fn` over every item in `items` with at most `concurrency` calls in flight
 * at a time. Items are consumed from a shared queue by N concurrent workers, so
 * faster tasks don't leave workers idle waiting for a slow sibling.
 */
export const runConcurrent = async <T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> => {
  const queue = [...items];
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item != null) await fn(item);
      }
    },
  );
  await Promise.all(workers);
};

/**
 * Runs `fn` over every item in `items` at a steady rate of `maxPerMinute` calls
 * per minute. All calls run concurrently — the rate limit controls when each
 * call starts, not how many are in flight. This prevents bursting past a
 * server-side throttle window while still parallelising the work.
 *
 * Example: 200 items at 100/min → one call every 600 ms, all overlapping,
 * never more than 100 starts within any 60-second window.
 */
export const runAtRate = async <T>(
  items: T[],
  maxPerMinute: number,
  fn: (item: T) => Promise<void>,
): Promise<void> => {
  const intervalMs = 60000 / maxPerMinute;
  const promises: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    if (i > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
    }
    promises.push(fn(items[i]));
  }

  await Promise.allSettled(promises);
};
