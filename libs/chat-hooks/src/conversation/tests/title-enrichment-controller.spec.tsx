import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ConversationTitleRequestEnd,
  useConversationTitleEnrichmentController,
  type ConversationTitleItem,
  type ConversationTitleEnrichmentOptions,
} from '../useConversationTitleEnrichmentController';

const row = (id: string): ConversationTitleItem => ({
  id,
  title: id,
  isTitlePending: true,
});
const config = (
  getTitles: ConversationTitleEnrichmentOptions['getTitles'],
): ConversationTitleEnrichmentOptions => ({
  getTitles,
  batchSize: 25,
  maxIds: 100,
  maxBytes: 10000,
  flushMs: 1,
  maxPendingUpdates: 100,
  protectionMs: 100,
  now: () => 0,
});
const useController = (
  scope: string,
  options: ConversationTitleEnrichmentOptions,
) => {
  const [items, setItems] = useState<ConversationTitleItem[]>([]);
  return {
    items,
    ...useConversationTitleEnrichmentController(scope, setItems, options),
  };
};
describe('title enrichment controller', () => {
  it('supports sequential JSON batches with exact encoded identities', async () => {
    const getTitles = vi.fn(async (ids: string[]) => ({
      items: ids.map((id) => ({ id, title: 'Title ' + id })),
    }));
    const options = config(getTitles);
    const { result } = renderHook(() => useController('a', options));
    const ids = [
      'a%2Fb',
      'a/b',
      ...Array.from({ length: 25 }, (_, i) => String(i)),
    ];
    act(() => result.current.applyConversationList(ids.map(row), 0));
    await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
    expect(getTitles.mock.calls.map(([ids]) => ids.length)).toEqual([25, 2]);
    expect(result.current.items.map((item) => item.title)).toEqual(
      ids.map((id) => 'Title ' + id),
    );
  });
  it('stops remaining batches on failure', async () => {
    const getTitles = vi.fn().mockRejectedValue(new Error('offline'));
    const options = config(getTitles);
    const { result } = renderHook(() => useController('a', options));
    act(() =>
      result.current.applyConversationList(
        Array.from({ length: 60 }, (_, i) => row(String(i))),
        0,
      ),
    );
    await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
    expect(getTitles).toHaveBeenCalledTimes(1);
  });
  it('isolates instances and protects local writes and pending deletions from stale snapshots', () => {
    const options = config(vi.fn().mockResolvedValue({ items: [] }));
    const { result } = renderHook(() => ({
      first: useController('a', options),
      second: useController('a', options),
    }));
    act(() => {
      result.current.first.rememberTitle('a', 'Local');
      result.current.first.forgetTitle('b', true);
      result.current.first.applyConversationList([row('a'), row('b')], 0);
      result.current.second.applyConversationList(
        [{ id: 'a', title: 'Other' }],
        0,
      );
    });
    expect(result.current.first.items).toEqual([
      { ...row('a'), title: 'Local', isTitlePending: false },
    ]);
    expect(result.current.second.items[0].title).toBe('Other');
    act(() => {
      result.current.first.restoreTitle('b', 'Restored');
      result.current.first.applyConversationList(
        [row('b')],
        result.current.first.getTitleRevision(),
      );
    });
    expect(result.current.first.items[0].title).toBe('Restored');
  });
  it('discards an old identity response even if transport ignores abort', async () => {
    let resolve!: (value: { items: { id: string; title: string }[] }) => void;
    const getTitles = vi.fn(
      () =>
        new Promise<{ items: { id: string; title: string }[] }>((done) => {
          resolve = done;
        }),
    );
    const options = config(getTitles);
    const { result, rerender } = renderHook(
      ({ scope }) => useController(scope, options),
      { initialProps: { scope: 'a' } },
    );
    act(() => result.current.applyConversationList([row('id')], 0));
    await waitFor(() => expect(getTitles).toHaveBeenCalledOnce());
    rerender({ scope: 'b' });
    act(() =>
      result.current.applyConversationList(
        [{ id: 'id', title: 'New identity' }],
        0,
      ),
    );
    await act(async () =>
      resolve({ items: [{ id: 'id', title: 'Old identity' }] }),
    );
    expect(result.current.items[0].title).toBe('New identity');
  });
});

describe('incremental title policy', () => {
  it.each([
    [2, 1000],
    [100, 9],
  ])(
    'prioritizes visible IDs with count %s and byte bound %s',
    async (maxIds, maxBytes) => {
      const streamTitles = vi.fn<
        NonNullable<ConversationTitleEnrichmentOptions['streamTitles']>
      >(async (ids, _signal, emit) => {
        ids.forEach((id) => emit(id, 'Resolved ' + id));
        return { end: ConversationTitleRequestEnd.Complete, settledIds: ids };
      });
      const options = {
        ...config(vi.fn()),
        streamTitles,
        maxIds,
        maxBytes,
      };
      const { result } = renderHook(() => useController('a', options));
      act(() => {
        result.current.setVisibleConversationIds('view', ['c']);
        result.current.applyConversationList(['a', 'b', 'c'].map(row), 0);
      });
      await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
      expect(streamTitles.mock.calls.map(([ids]) => ids)).toEqual([
        ['c', 'a'],
        ['b'],
      ]);
      expect(result.current.items.every((item) => !item.isTitlePending)).toBe(
        true,
      );
    },
  );
  it('uses the same revision guards when an unsupported stream falls back to JSON', async () => {
    const getTitles = vi.fn(async (ids: string[]) => ({
      items: ids.map((id) => ({ id, title: 'Remote' })),
    }));
    const streamTitles = vi.fn<
      NonNullable<ConversationTitleEnrichmentOptions['streamTitles']>
    >(async () => ({
      end: ConversationTitleRequestEnd.Unsupported,
      settledIds: [],
    }));
    const options = { ...config(getTitles), streamTitles };
    const { result } = renderHook(() => useController('a', options));
    act(() => result.current.applyConversationList([row('a')], 0));
    await waitFor(() => expect(result.current.items[0].title).toBe('Remote'));
    act(() => {
      result.current.rememberTitle('a', 'Local');
      result.current.applyConversationList([row('a')], 0);
    });
    expect(result.current.items[0].title).toBe('Local');
    expect(streamTitles).toHaveBeenCalledOnce();
    expect(getTitles).toHaveBeenCalledOnce();
  });
  it('expires local protection without changing stable callbacks', () => {
    let now = 0;
    const options = { ...config(vi.fn()), now: () => now };
    const { result, rerender } = renderHook(() => useController('a', options));
    const apply = result.current.applyConversationList;
    act(() => {
      result.current.rememberTitle('a', 'Local');
      result.current.applyConversationList([{ id: 'a', title: 'Remote' }], 1);
    });
    expect(result.current.items[0].title).toBe('Local');
    now = 101;
    act(() =>
      result.current.applyConversationList([{ id: 'a', title: 'Remote' }], 1),
    );
    expect(result.current.items[0].title).toBe('Remote');
    rerender();
    expect(result.current.applyConversationList).toBe(apply);
  });
  it('discards buffered titles and old emissions after scope replacement and unmount', async () => {
    let emit!: (id: string, title: string) => void;
    let signal!: AbortSignal;
    const streamTitles = vi.fn<
      NonNullable<ConversationTitleEnrichmentOptions['streamTitles']>
    >((_ids, s, onTitle) => {
      emit = onTitle;
      signal = s;
      return new Promise(() => {
        /* Keep the transport pending until the host retires it. */
      });
    });
    const options = { ...config(vi.fn()), streamTitles, flushMs: 100 };
    const { result, rerender, unmount } = renderHook(
      ({ scope }) => useController(scope, options),
      { initialProps: { scope: 'a' } },
    );
    act(() => result.current.applyConversationList([row('id')], 0));
    await waitFor(() => expect(streamTitles).toHaveBeenCalledOnce());
    act(() => emit('id', 'Buffered'));
    rerender({ scope: 'b' });
    expect(signal.aborted).toBe(true);
    act(() => {
      result.current.applyConversationList([{ id: 'id', title: 'New' }], 0);
      emit('id', 'Stale');
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
    });
    expect(result.current.items[0].title).toBe('New');
    unmount();
    act(() => emit('id', 'After unmount'));
  });
  it('flushes at the configured buffer bound and keeps partial results on interruption', async () => {
    const streamTitles = vi.fn<
      NonNullable<ConversationTitleEnrichmentOptions['streamTitles']>
    >(async (_ids, _signal, emit) => {
      emit('a', 'Partial');
      return { end: ConversationTitleRequestEnd.Stopped, settledIds: ['a'] };
    });
    const options = { ...config(vi.fn()), streamTitles, maxPendingUpdates: 1 };
    const { result } = renderHook(() => useController('a', options));
    act(() => result.current.applyConversationList([row('a'), row('b')], 0));
    await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
    expect(result.current.items.map((item) => item.title)).toEqual([
      'Partial',
      'b',
    ]);
    expect(streamTitles).toHaveBeenCalledOnce();
  });
});
