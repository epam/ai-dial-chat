/**
 * Runs `fn` over every item in `items` at a steady rate of `maxPerMinute` calls per minute.
 * All calls run concurrently — the rate limit controls when each call starts, not how many are in flight.
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
