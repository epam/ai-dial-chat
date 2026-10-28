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
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
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
});
