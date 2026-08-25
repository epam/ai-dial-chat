/**
 * Runs `worker` over `items` with at most `limit` concurrent invocations.
 * Preserves no particular result order beyond "worker completed"; a worker
 * that returns `undefined`, or throws, contributes nothing to the result
 * array (used to skip failed/invalid items without aborting the whole
 * batch) — a throwing worker is caught here so the other concurrent items
 * keep being tracked instead of continuing unobserved in the background.
 */
export const runWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R | undefined>,
): Promise<R[]> => {
  const results: R[] = [];
  let nextIndex = 0;

  const runNext = async (): Promise<void> => {
    const currentIndex = nextIndex;
    nextIndex += 1;
    if (currentIndex >= items.length) return;
    try {
      const result = await worker(items[currentIndex]);
      if (result !== undefined) results.push(result);
    } catch (error) {
      console.error('runWithConcurrency: worker failed for item', error);
    }
    await runNext();
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, runNext),
  );
  return results;
};
