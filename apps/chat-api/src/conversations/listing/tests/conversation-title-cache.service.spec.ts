import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONVERSATION_TITLE_CACHE_MAX_ENTRIES,
  CONVERSATION_TITLE_CACHE_TTL_MS,
  CONVERSATION_TITLE_QUEUE_WAIT_MS,
  ConversationTitleCacheService,
  ConversationTitleSummary,
} from '../conversation-title-cache.service';

const id = 'conversations/bucket/gpt-4o__Original';
const summary = { name: 'Renamed', llmNamingDone: true };
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};
const fillReadSlots = (cache: ConversationTitleCacheService) => {
  const gate = deferred<void>();
  const reads = Array.from({ length: 25 }, (_, index) =>
    cache.load('token', `conversations/bucket/busy-${index}`, async () => {
      await gate.promise;
      return summary;
    }),
  );
  return {
    release: async () => {
      gate.resolve();
      await Promise.all(reads);
    },
  };
};

describe('ConversationTitleCacheService', () => {
  afterEach(() => vi.useRealTimers());

  it('coalesces equivalent resource URLs for one token, while isolating tokens and buckets', async () => {
    const cache = new ConversationTitleCacheService();
    const pending = deferred<ConversationTitleSummary>();
    const read = vi.fn(() => pending.promise);
    const first = cache.load('token', `${id}%20chat`, read);
    const duplicate = cache.load('token', `${id} chat`, read);
    const otherUser = cache.load('other-token', `${id}%20chat`, read);
    const publicCopy = cache.load(
      'token',
      'conversations/public/gpt-4o__Original%20chat',
      read,
    );
    expect(read).toHaveBeenCalledTimes(3);

    pending.resolve(summary);
    expect(
      await Promise.all([first, duplicate, otherUser, publicCopy]),
    ).toEqual([summary, summary, summary, summary]);
    expect(await cache.load('token', `${id}%20chat`, read)).toEqual(summary);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('expires summaries and marks a changed metadata version stale', () => {
    vi.useFakeTimers();
    const cache = new ConversationTitleCacheService();
    cache.set('token', id, summary);
    expect(cache.get('token', id, 10)).toEqual(summary);
    expect(cache.get('token', id, 20)).toBeUndefined();
    cache.set('token', id, summary);
    vi.advanceTimersByTime(CONVERSATION_TITLE_CACHE_TTL_MS);
    expect(cache.get('token', id)).toBeUndefined();
  });

  it('retains only projected fields and evicts the least recently used summary', () => {
    const cache = new ConversationTitleCacheService();
    cache.set('token', id, {
      ...summary,
      messages: ['not cached'],
    } as ConversationTitleSummary);
    expect(cache.get('token', id)).toEqual(summary);
    for (let index = 0; index < CONVERSATION_TITLE_CACHE_MAX_ENTRIES; index++) {
      cache.set('token', `conversations/bucket/other-${index}`, summary);
    }
    expect(cache.get('token', id)).toBeUndefined();
    expect(
      cache.get(
        'token',
        `conversations/bucket/other-${CONVERSATION_TITLE_CACHE_MAX_ENTRIES - 1}`,
      ),
    ).toEqual(summary);
  });

  it('does not let an old title request overwrite a newer successful save', async () => {
    const cache = new ConversationTitleCacheService();
    const oldRead = deferred<ConversationTitleSummary>();
    const pending = cache.load('token', id, () => oldRead.promise);
    cache.set('token', id, summary);
    oldRead.resolve({ name: 'Old', llmNamingDone: true });
    expect(await pending).toEqual(summary);
    expect(cache.get('token', id)).toEqual(summary);
  });

  it.each([42, { nested: 'invalid' }, 'x'.repeat(4097)])(
    'discards malformed or oversized names before they can reach a listing',
    (name) => {
      const cache = new ConversationTitleCacheService();
      cache.set('token', id, {
        name,
        llmNamingDone: true,
      } as ConversationTitleSummary);
      expect(cache.get('token', id)).toEqual({
        name: undefined,
        llmNamingDone: true,
      });
    },
  );

  it('keeps warm titles when scanning more uncached metadata than the cache capacity', () => {
    const cache = new ConversationTitleCacheService();
    cache.set('token', id, summary);
    for (
      let index = 0;
      index < CONVERSATION_TITLE_CACHE_MAX_ENTRIES + 1;
      index++
    ) {
      expect(
        cache.get('token', `conversations/bucket/missing-${index}`, 10),
      ).toBeUndefined();
    }
    expect(cache.get('token', id)).toEqual(summary);
  });

  it('does not restore a deleted entry after an old title request completes', async () => {
    const cache = new ConversationTitleCacheService();
    const oldRead = deferred<ConversationTitleSummary>();
    const pending = cache.load('token', id, () => oldRead.promise);
    cache.invalidate('token', id);
    oldRead.resolve(summary);
    expect(await pending).toBeUndefined();
    expect(cache.get('token', id)).toBeUndefined();
  });

  it('fences successful and missing direct reads against a newer save', () => {
    const cache = new ConversationTitleCacheService();
    const oldSuccess = cache.reader('token', id);
    const oldMissing = cache.reader('token', id);
    cache.set('token', id, summary);
    oldSuccess({ name: 'Old', llmNamingDone: true });
    oldMissing();
    expect(cache.get('token', id)).toEqual(summary);
  });

  it('bounds concurrent body reads across separate requests and resumes waiting reads', async () => {
    const cache = new ConversationTitleCacheService();
    const gate = deferred<void>();
    let active = 0;
    let peak = 0;
    const read = vi.fn(async () => {
      peak = Math.max(peak, ++active);
      await gate.promise;
      active--;
      return summary;
    });
    const reads = Array.from({ length: 40 }, (_, index) =>
      cache.load('token', `conversations/bucket/${index}`, read),
    );
    expect(read).toHaveBeenCalledTimes(25);
    gate.resolve();
    await Promise.all(reads);
    expect(peak).toBe(25);
    expect(read).toHaveBeenCalledTimes(40);
  });

  it('rejects excess queued work instead of retaining an unbounded backlog', async () => {
    const cache = new ConversationTitleCacheService();
    const gate = deferred<void>();
    const reads = Array.from({ length: 276 }, (_, index) =>
      cache.load('token', `conversations/bucket/${index}`, async () => {
        await gate.promise;
        return summary;
      }),
    );
    const settled = Promise.allSettled(reads);
    gate.resolve();
    const results = await settled;
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
  });

  it('removes timed out queued reads without starting their SDK work', async () => {
    vi.useFakeTimers();
    const cache = new ConversationTitleCacheService();
    const gate = deferred<void>();
    const active = Array.from({ length: 25 }, (_, index) =>
      cache.load('token', `conversations/bucket/${index}`, async () => {
        await gate.promise;
        return summary;
      }),
    );
    const queuedRead = vi.fn(async () => summary);
    const queued = cache.load('token', id, queuedRead).catch((error) => error);
    await vi.advanceTimersByTimeAsync(CONVERSATION_TITLE_QUEUE_WAIT_MS);
    expect((await queued).getStatus()).toBe(503);
    gate.resolve();
    await Promise.all(active);
    expect(queuedRead).not.toHaveBeenCalled();
  });

  describe('consumer-owned cancellation', () => {
    it('keeps a shared read alive while another consumer still owns it', async () => {
      const cache = new ConversationTitleCacheService();
      const pending = deferred<ConversationTitleSummary>();
      let readSignal: AbortSignal | undefined;
      const read = vi.fn((signal: AbortSignal) => {
        readSignal = signal;
        return pending.promise;
      });
      const stream = new AbortController();
      const json = new AbortController();
      const streamResult = cache
        .load('token', id, read, stream.signal)
        .catch((error: unknown) => error);
      const jsonResult = cache.load('token', id, read, json.signal);
      expect(read).toHaveBeenCalledOnce();

      stream.abort();
      expect(((await streamResult) as Error).name).toBe('AbortError');
      expect(readSignal?.aborted).toBe(false);

      pending.resolve(summary);
      expect(await jsonResult).toEqual(summary);
      expect(cache.get('token', id)).toEqual(summary);
    });

    it('aborts the SDK read only when the last consumer leaves', async () => {
      const cache = new ConversationTitleCacheService();
      const pending = deferred<ConversationTitleSummary>();
      let readSignal: AbortSignal | undefined;
      const read = vi.fn((signal: AbortSignal) => {
        readSignal = signal;
        return pending.promise;
      });
      const first = new AbortController();
      const second = new AbortController();
      const results = [
        cache.load('token', id, read, first.signal).catch(() => 'aborted'),
        cache.load('token', id, read, second.signal).catch(() => 'aborted'),
      ];
      first.abort();
      expect(readSignal?.aborted).toBe(false);
      second.abort();
      expect(readSignal?.aborted).toBe(true);
      expect(await Promise.all(results)).toEqual(['aborted', 'aborted']);

      pending.resolve(summary);
      await Promise.resolve();
      expect(cache.get('token', id)).toBeUndefined();
    });

    it('removes queued work when its last consumer leaves before admission', async () => {
      const cache = new ConversationTitleCacheService();
      const busy = fillReadSlots(cache);
      const consumer = new AbortController();
      const queuedRead = vi.fn(async () => summary);
      const queued = cache
        .load('token', id, queuedRead, consumer.signal)
        .catch((error: unknown) => error);
      consumer.abort();
      expect(((await queued) as Error).name).toBe('AbortError');

      const nextRead = vi.fn(async () => summary);
      const next = cache.load('token', `${id}-next`, nextRead);
      await busy.release();
      await next;
      expect(queuedRead).not.toHaveBeenCalled();
      expect(nextRead).toHaveBeenCalledOnce();
    });

    it('keeps the read slot occupied until a cancelled SDK call settles', async () => {
      const cache = new ConversationTitleCacheService();
      const cancelled = deferred<ConversationTitleSummary>();
      const consumer = new AbortController();
      const result = cache
        .load('token', id, () => cancelled.promise, consumer.signal)
        .catch(() => 'aborted');
      const gate = deferred<void>();
      const others = Array.from({ length: 24 }, (_, index) =>
        cache.load('token', `conversations/bucket/busy-${index}`, async () => {
          await gate.promise;
          return summary;
        }),
      );
      consumer.abort();
      expect(await result).toBe('aborted');

      const waitingRead = vi.fn(async () => summary);
      const waiting = cache.load('token', `${id}-waiting`, waitingRead);
      await Promise.resolve();
      expect(waitingRead).not.toHaveBeenCalled();

      cancelled.reject(new DOMException('aborted', 'AbortError'));
      expect(await waiting).toEqual(summary);
      expect(waitingRead).toHaveBeenCalledOnce();
      gate.resolve();
      await Promise.all(others);
    });

    it('starts a fresh read after a cancelled operation instead of joining it', async () => {
      const cache = new ConversationTitleCacheService();
      const cancelled = deferred<ConversationTitleSummary>();
      const consumer = new AbortController();
      const first = cache
        .load('token', id, () => cancelled.promise, consumer.signal)
        .catch(() => 'aborted');
      consumer.abort();
      const freshRead = vi.fn(async () => summary);
      expect(await cache.load('token', id, freshRead)).toEqual(summary);
      expect(freshRead).toHaveBeenCalledOnce();
      expect(await first).toBe('aborted');

      cancelled.resolve({ name: 'Stale', llmNamingDone: true });
      await Promise.resolve();
      expect(cache.get('token', id)).toEqual(summary);
    });

    it('rejects an already cancelled consumer without starting a read', async () => {
      const cache = new ConversationTitleCacheService();
      const read = vi.fn(async () => summary);
      await expect(
        cache.load('token', id, read, AbortSignal.abort()),
      ).rejects.toMatchObject({ name: 'AbortError' });
      expect(read).not.toHaveBeenCalled();
    });

    it('does not let a late success or 404 replace a newer write', async () => {
      const cache = new ConversationTitleCacheService();
      const lateSuccess = deferred<ConversationTitleSummary>();
      const success = cache.load('token', id, () => lateSuccess.promise);
      cache.set('token', id, summary);
      lateSuccess.resolve({ name: 'Old', llmNamingDone: true });
      expect(await success).toEqual(summary);

      const late404 = deferred<ConversationTitleSummary>();
      cache.invalidate('token', id);
      const missing = cache
        .load('token', id, () => late404.promise)
        .catch(() => 'missing');
      const newer = { name: 'Newer', llmNamingDone: true };
      cache.set('token', id, newer);
      late404.reject(new Error('404'));
      expect(await missing).toBe('missing');
      expect(cache.get('token', id)).toEqual(newer);
    });

    it('forgets an empty entry after a failed read so a retry starts cleanly', async () => {
      const cache = new ConversationTitleCacheService();
      await expect(
        cache.load('token', id, async () => {
          throw new Error('404');
        }),
      ).rejects.toThrow('404');
      const retry = vi.fn(async () => summary);
      expect(await cache.load('token', id, retry)).toEqual(summary);
      expect(retry).toHaveBeenCalledOnce();
    });
  });
});
