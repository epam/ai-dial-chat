import type { ConversationListItemDto } from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getConversationTitles } from '../../../server-api/conversations.api';
import { useConversationTitleEnrichment } from '../useConversationTitleEnrichment';

vi.mock('../../../server-api/conversations.api', () => ({
  getConversationTitles: vi.fn(),
}));

const pending = (id: string): ConversationListItemDto => ({
  id,
  title: `Filename ${id}`,
  updatedAt: 1,
  isPinned: false,
  isReadonly: false,
  isScheduledTask: false,
  sharedWithMe: false,
  publishedWithMe: false,
  isTitlePending: true,
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

type Titles = Awaited<ReturnType<typeof getConversationTitles>>;

const useHarness = (userSub: string) => {
  const [items, setItems] = useState<ConversationListItemDto[]>([]);
  const enrichment = useConversationTitleEnrichment(userSub, setItems);
  return { items, setItems, ...enrichment };
};

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.useRealTimers());

describe('useConversationTitleEnrichment', () => {
  it('keeps deletion tombstones across stale list responses and clears them for a later request', () => {
    const { result } = renderHook(() => useHarness('user'));
    const item = { ...pending('id'), isTitlePending: false };
    act(() => result.current.applyConversationList([item], 0));
    act(() => result.current.forgetTitle('id', true));
    act(() =>
      result.current.applyConversationList(
        [item],
        result.current.getTitleRevision(),
      ),
    );
    expect(result.current.items).toEqual([]);
    act(() => result.current.forgetTitle('id'));
    act(() => result.current.applyConversationList([item], 0));
    expect(result.current.items).toEqual([]);
    act(() => result.current.applyConversationList([item], 0));
    expect(result.current.items).toEqual([]);
    act(() =>
      result.current.applyConversationList(
        [item],
        result.current.getTitleRevision(),
      ),
    );
    expect(result.current.items).toEqual([item]);
  });

  it('clears a deletion tombstone when the delete failed', () => {
    const { result } = renderHook(() => useHarness('user'));
    const item = { ...pending('id'), isTitlePending: false };
    act(() => result.current.applyConversationList([item], 0));
    act(() => result.current.forgetTitle('id'));
    act(() => result.current.restoreTitle('id', item.title));
    act(() => result.current.applyConversationList([item], 0));
    expect(result.current.items).toEqual([item]);
  });

  it('protects a confirmed local title from another pod cache, then allows newer remote titles after the bounded window', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
    const { result } = renderHook(() => useHarness('user'));
    act(() => result.current.rememberTitle('id', 'Confirmed rename'));
    const item = {
      ...pending('id'),
      title: 'Other pod cached title',
      isTitlePending: false,
    };
    act(() =>
      result.current.applyConversationList(
        [item],
        result.current.getTitleRevision(),
      ),
    );
    expect(result.current.items[0].title).toBe('Confirmed rename');
    act(() =>
      result.current.applyConversationList(
        [pending('id')],
        result.current.getTitleRevision(),
      ),
    );
    expect(result.current.items[0].title).toBe('Confirmed rename');
    expect(getConversationTitles).not.toHaveBeenCalled();
    vi.setSystemTime(1_315_001);
    act(() =>
      result.current.applyConversationList(
        [{ ...item, title: 'New remote title' }],
        result.current.getTitleRevision(),
      ),
    );
    expect(result.current.items[0].title).toBe('New remote title');
  });

  it('stops the attempt after a request failure instead of sending every remaining batch', async () => {
    vi.mocked(getConversationTitles).mockRejectedValue(
      new Error('Unauthorized'),
    );
    const { result } = renderHook(() => useHarness('user'));
    await act(async () =>
      result.current.applyConversationList(
        Array.from({ length: 51 }, (_, index) => pending(`id-${index}`)),
        0,
      ),
    );
    expect(getConversationTitles).toHaveBeenCalledOnce();
    expect(result.current.items).toHaveLength(51);
    expect(result.current.isUpdatingTitles).toBe(false);
  });

  it('prunes names that are no longer present in the accepted list snapshot', async () => {
    vi.mocked(getConversationTitles).mockResolvedValue({ items: [] });
    const { result } = renderHook(() => useHarness('user'));
    act(() =>
      result.current.applyConversationList(
        [
          {
            ...pending('id'),
            title: 'Previously visible',
            isTitlePending: false,
          },
        ],
        0,
      ),
    );
    act(() => result.current.applyConversationList([], 0));
    await act(async () =>
      result.current.applyConversationList([pending('id')], 0),
    );
    expect(result.current.items[0].title).toBe('Filename id');
  });

  it('shows the initial list immediately and applies titles without resetting row state or order', async () => {
    const response = deferred<Titles>();
    vi.mocked(getConversationTitles).mockReturnValue(response.promise);
    const { result } = renderHook(() => useHarness('user'));
    const initial = [
      pending('conversations/bucket/first'),
      pending('conversations/bucket/second'),
    ];
    act(() =>
      result.current.applyConversationList(
        initial,
        result.current.getTitleRevision(),
      ),
    );
    expect(result.current.items).toEqual(initial);
    expect(result.current.isUpdatingTitles).toBe(true);
    act(() =>
      result.current.setItems((items) =>
        items.map((item, index) =>
          index === 0 ? { ...item, isPinned: true, isUnread: false } : item,
        ),
      ),
    );
    await act(async () =>
      response.resolve({
        items: [
          { id: initial[0].id, title: 'First current title' },
          { id: initial[1].id, title: 'Second current title' },
        ],
      }),
    );
    expect(result.current.items.map(({ id }) => id)).toEqual(
      initial.map(({ id }) => id),
    );
    expect(result.current.items[0]).toMatchObject({
      title: 'First current title',
      isPinned: true,
      isUnread: false,
      isTitlePending: false,
    });
    expect(result.current.isUpdatingTitles).toBe(false);
  });

  it('uses sequential batches of at most 25 exact resource IDs and settles incomplete failures', async () => {
    const first = deferred<Titles>();
    vi.mocked(getConversationTitles)
      .mockReturnValueOnce(first.promise)
      .mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useHarness('user'));
    const initial = Array.from({ length: 27 }, (_, index) =>
      pending(`conversations/bucket/${index}%255F`),
    );
    act(() => result.current.applyConversationList(initial, 0));
    expect(getConversationTitles).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getConversationTitles).mock.calls[0][0]).toEqual(
      initial.slice(0, 25).map(({ id }) => id),
    );
    await act(async () =>
      first.resolve({ items: [{ id: initial[0].id, title: 'Resolved' }] }),
    );
    await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
    expect(getConversationTitles).toHaveBeenCalledTimes(2);
    expect(vi.mocked(getConversationTitles).mock.calls[1][0]).toEqual(
      initial.slice(25).map(({ id }) => id),
    );
    expect(result.current.items).toHaveLength(27);
    expect(result.current.items[1].title).toBe(initial[1].title);
  });

  it('cancels an old snapshot and ignores its late response', async () => {
    const oldResponse = deferred<Titles>();
    const newResponse = deferred<Titles>();
    vi.mocked(getConversationTitles)
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(newResponse.promise);
    const { result } = renderHook(() => useHarness('user'));
    act(() => result.current.applyConversationList([pending('id')], 0));
    const oldSignal = vi.mocked(getConversationTitles).mock.calls[0][1];
    act(() =>
      result.current.applyConversationList(
        [{ ...pending('id'), title: 'Newer filename' }],
        0,
      ),
    );
    expect(oldSignal?.aborted).toBe(true);
    await act(async () =>
      oldResponse.resolve({ items: [{ id: 'id', title: 'Stale title' }] }),
    );
    expect(result.current.items[0].title).toBe('Newer filename');
    expect(result.current.isUpdatingTitles).toBe(true);
    await act(async () =>
      newResponse.resolve({ items: [{ id: 'id', title: 'Current title' }] }),
    );
    expect(result.current.items[0].title).toBe('Current title');
  });

  it('does not overwrite a locally renamed or freshly opened title with an older batch', async () => {
    const response = deferred<Titles>();
    vi.mocked(getConversationTitles).mockReturnValue(response.promise);
    const { result } = renderHook(() => useHarness('user'));
    act(() => result.current.applyConversationList([pending('id')], 0));
    act(() => {
      result.current.rememberTitle('id', 'Manual title');
      result.current.setItems((items) =>
        items.map((item) => ({ ...item, title: 'Manual title' })),
      );
    });
    await act(async () =>
      response.resolve({ items: [{ id: 'id', title: 'Stale title' }] }),
    );
    expect(result.current.items[0].title).toBe('Manual title');
    act(() =>
      result.current.applyConversationList(
        [{ ...pending('id'), title: 'Stale cache', isTitlePending: false }],
        0,
      ),
    );
    expect(result.current.items[0].title).toBe('Manual title');
  });

  it('preserves known names during a pending refresh and does not enrich an in-flight rename', async () => {
    vi.mocked(getConversationTitles).mockResolvedValue({ items: [] });
    const { result } = renderHook(() => useHarness('user'));
    act(() =>
      result.current.applyConversationList(
        [{ ...pending('id'), title: 'Known name', isTitlePending: false }],
        0,
      ),
    );
    await act(async () =>
      result.current.applyConversationList([pending('id')], 0),
    );
    expect(result.current.items[0].title).toBe('Known name');
    act(() =>
      result.current.rememberTitle('id', 'Saving rename', { isWriting: true }),
    );
    vi.mocked(getConversationTitles).mockClear();
    act(() =>
      result.current.applyConversationList(
        [pending('id')],
        result.current.getTitleRevision(),
      ),
    );
    expect(result.current.items[0].title).toBe('Saving rename');
    expect(getConversationTitles).not.toHaveBeenCalled();
    expect(result.current.isUpdatingTitles).toBe(false);
  });

  it('does not restore deleted rows or confuse distinct encoded IDs', async () => {
    const response = deferred<Titles>();
    vi.mocked(getConversationTitles).mockReturnValue(response.promise);
    const { result } = renderHook(() => useHarness('user'));
    act(() =>
      result.current.applyConversationList(
        [pending('bucket/name%5F'), pending('bucket/name_')],
        0,
      ),
    );
    act(() => {
      result.current.forgetTitle('bucket/name%5F');
      result.current.setItems((items) =>
        items.filter(({ id }) => id !== 'bucket/name%5F'),
      );
    });
    await act(async () =>
      response.resolve({
        items: [
          { id: 'bucket/name%5F', title: 'Deleted' },
          { id: 'bucket/name_', title: 'Remaining' },
        ],
      }),
    );
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].title).toBe('Remaining');
  });

  it('aborts on identity changes and unmount without leaking cached titles between users', async () => {
    const first = deferred<Titles>();
    const second = deferred<Titles>();
    vi.mocked(getConversationTitles)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result, rerender, unmount } = renderHook(
      ({ user }) => useHarness(user),
      { initialProps: { user: 'first' } },
    );
    act(() => {
      result.current.applyConversationList(
        [pending('shared-id')],
        result.current.getTitleRevision(),
      );
      result.current.rememberTitle('shared-id', 'Private first-user state');
    });
    const firstSignal = vi.mocked(getConversationTitles).mock.calls[0][1];
    rerender({ user: 'second' });
    expect(firstSignal?.aborted).toBe(true);
    act(() => result.current.applyConversationList([pending('shared-id')], 0));
    expect(result.current.items[0].title).toBe('Filename shared-id');
    await act(async () =>
      first.resolve({
        items: [{ id: 'shared-id', title: 'Late first-user title' }],
      }),
    );
    expect(result.current.items[0].title).toBe('Filename shared-id');
    const secondSignal = vi.mocked(getConversationTitles).mock.calls[1][1];
    unmount();
    expect(secondSignal?.aborted).toBe(true);
    await act(async () =>
      second.resolve({ items: [{ id: 'shared-id', title: 'After unmount' }] }),
    );
  });
});
