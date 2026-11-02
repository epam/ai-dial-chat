import {
  type ConversationListItemDto,
  type ConversationTitleStreamEventDto,
  ResponseError,
} from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getConversationTitles,
  streamConversationTitles,
} from '../../../server-api/conversations.api';
import { useConversationTitleEnrichment } from '../useConversationTitleEnrichment';

vi.mock('../../../server-api/conversations.api', () => ({
  getConversationTitles: vi.fn(),
  streamConversationTitles: vi.fn(),
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

/* A title stream whose events the test releases one at a time. */
const controlledStream = () => {
  const queue: ConversationTitleStreamEventDto[] = [];
  let isEnded = false;
  let failure: unknown;
  let wake: (() => void) | undefined;
  const notify = () => {
    wake?.();
    wake = undefined;
  };
  const nextEvent = () =>
    new Promise<void>((resolve) => {
      wake = resolve;
    });
  const iterable: AsyncIterable<ConversationTitleStreamEventDto> = {
    async *[Symbol.asyncIterator]() {
      for (;;) {
        const event = queue.shift();
        if (event) {
          yield event;
          continue;
        }
        if (failure) throw failure;
        if (isEnded) return;
        await nextEvent();
      }
    },
  };
  return {
    iterable,
    push: async (...events: ConversationTitleStreamEventDto[]) => {
      queue.push(...events);
      await act(async () => notify());
    },
    end: async () => {
      isEnded = true;
      await act(async () => notify());
    },
    fail: async (error: unknown) => {
      failure = error;
      await act(async () => notify());
    },
  };
};

const title = (id: string, value: string): ConversationTitleStreamEventDto => ({
  type: 'title',
  id,
  title: value,
});
const done = (
  processed: number,
  total: number,
  reason: 'complete' | 'budget' = 'complete',
): ConversationTitleStreamEventDto => ({
  type: 'done',
  reason,
  processed,
  total,
});

/* Resolves every stream request with the given events, ending each one. */
const respondWith = (
  ...responses: Array<(ids: string[]) => ConversationTitleStreamEventDto[]>
) => {
  for (const respond of responses) {
    vi.mocked(streamConversationTitles).mockImplementationOnce(
      async (ids: string[]) => ({
        async *[Symbol.asyncIterator]() {
          yield* respond(ids);
        },
      }),
    );
  }
};

const useHarness = (userSub: string) => {
  const [items, setItems] = useState<ConversationListItemDto[]>([]);
  const enrichment = useConversationTitleEnrichment(userSub, setItems);
  return { items, setItems, ...enrichment };
};

const requestedIds = (call: number) =>
  vi.mocked(streamConversationTitles).mock.calls[call][0];
const requestSignal = (call: number) =>
  vi.mocked(streamConversationTitles).mock.calls[call][1];

describe('useConversationTitleEnrichment', () => {
  beforeEach(() => vi.resetAllMocks());

  afterEach(() => vi.useRealTimers());

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
    expect(streamConversationTitles).not.toHaveBeenCalled();
    vi.setSystemTime(1_315_001);
    act(() =>
      result.current.applyConversationList(
        [{ ...item, title: 'New remote title' }],
        result.current.getTitleRevision(),
      ),
    );
    expect(result.current.items[0].title).toBe('New remote title');
  });

  it('shows the initial list immediately and applies a fast title before its unresolved sibling', async () => {
    const stream = controlledStream();
    vi.mocked(streamConversationTitles).mockResolvedValue(stream.iterable);
    const { result } = renderHook(() => useHarness('user'));
    const initial = [
      pending('conversations/bucket/first'),
      pending('conversations/bucket/second'),
    ];
    await act(async () =>
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
          index === 1 ? { ...item, isPinned: true, isUnread: false } : item,
        ),
      ),
    );

    await stream.push(title(initial[1].id, 'Second current title'));
    await waitFor(() =>
      expect(result.current.items[1]).toMatchObject({
        title: 'Second current title',
        isPinned: true,
        isUnread: false,
        isTitlePending: false,
      }),
    );
    expect(result.current.items[0].title).toBe(initial[0].title);
    expect(result.current.isUpdatingTitles).toBe(true);

    await stream.push(title(initial[0].id, 'First current title'), done(2, 2));
    await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
    expect(result.current.items.map(({ id }) => id)).toEqual(
      initial.map(({ id }) => id),
    );
    expect(result.current.items[0].title).toBe('First current title');
    expect(streamConversationTitles).toHaveBeenCalledOnce();
  });

  it('ignores duplicate and unrequested IDs and stops on dishonest terminal counts', async () => {
    respondWith(() => [
      title('a', 'A'),
      title('a', 'A again'),
      title('other', 'Not requested'),
      done(3, 2, 'budget'),
    ]);
    const { result } = renderHook(() => useHarness('user'));
    await act(async () =>
      result.current.applyConversationList([pending('a'), pending('b')], 0),
    );
    await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
    expect(result.current.items.map(({ title }) => title)).toEqual([
      'A',
      'Filename b',
    ]);
    expect(streamConversationTitles).toHaveBeenCalledOnce();
  });

  it('continues a budget terminal with unattempted IDs only and never resends settled outcomes', async () => {
    respondWith(
      () => [
        { type: 'unavailable', id: 'a' },
        { type: 'item_error', id: 'b', code: 'timeout' },
        done(2, 3, 'budget'),
      ],
      () => [title('c', 'C'), done(1, 1)],
    );
    const { result } = renderHook(() => useHarness('user'));
    await act(async () =>
      result.current.applyConversationList(
        [pending('a'), pending('b'), pending('c')],
        0,
      ),
    );
    await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
    expect(requestedIds(0)).toEqual(['a', 'b', 'c']);
    expect(requestedIds(1)).toEqual(['c']);
    expect(result.current.items.map(({ title }) => title)).toEqual([
      'Filename a',
      'Filename b',
      'C',
    ]);
  });

  it('stops after a budget terminal that settled nothing', async () => {
    respondWith(() => [done(0, 1, 'budget')]);
    const { result } = renderHook(() => useHarness('user'));
    await act(async () =>
      result.current.applyConversationList([pending('a')], 0),
    );
    await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
    expect(streamConversationTitles).toHaveBeenCalledOnce();
  });

  it('splits a history larger than one request and makes every ID eligible', async () => {
    respondWith(
      (ids) => [
        ...ids.map((id) => title(id, 'T')),
        done(ids.length, ids.length),
      ],
      (ids) => [
        ...ids.map((id) => title(id, 'T')),
        done(ids.length, ids.length),
      ],
    );
    const initial = Array.from({ length: 501 }, (_, index) =>
      pending(`conversations/bucket/${index}%255F`),
    );
    const { result } = renderHook(() => useHarness('user'));
    await act(async () => result.current.applyConversationList(initial, 0));
    await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
    expect(requestedIds(0)).toEqual(initial.slice(0, 500).map(({ id }) => id));
    expect(requestedIds(1)).toEqual([initial[500].id]);
    expect(result.current.items.every(({ title }) => title === 'T')).toBe(true);
  });

  it.each([
    {
      name: 'a terminal error event',
      finish: (stream: ReturnType<typeof controlledStream>) =>
        stream.push({ type: 'error', status: 503, code: 'unavailable' }),
    },
    {
      name: 'EOF without a terminal event',
      finish: (stream: ReturnType<typeof controlledStream>) => stream.end(),
    },
    {
      name: 'a malformed frame',
      finish: (stream: ReturnType<typeof controlledStream>) =>
        stream.fail(new Error('protocol')),
    },
  ])(
    'keeps delivered titles and settles progress after $name without retrying',
    async ({ finish }) => {
      const stream = controlledStream();
      vi.mocked(streamConversationTitles).mockResolvedValue(stream.iterable);
      const { result } = renderHook(() => useHarness('user'));
      await act(async () =>
        result.current.applyConversationList([pending('a'), pending('b')], 0),
      );
      await stream.push(title('a', 'Delivered'));
      await finish(stream);
      await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
      expect(result.current.items.map(({ title }) => title)).toEqual([
        'Delivered',
        'Filename b',
      ]);
      expect(streamConversationTitles).toHaveBeenCalledOnce();
      expect(getConversationTitles).not.toHaveBeenCalled();
    },
  );

  it.each([401, 403, 429, 503])(
    'does not fall back to JSON when the stream is rejected with HTTP %i',
    async (status) => {
      vi.mocked(streamConversationTitles).mockRejectedValue(
        new ResponseError(new Response(null, { status })),
      );
      const { result } = renderHook(() => useHarness('user'));
      await act(async () =>
        result.current.applyConversationList(
          Array.from({ length: 51 }, (_, index) => pending(`id-${index}`)),
          0,
        ),
      );
      await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
      expect(streamConversationTitles).toHaveBeenCalledOnce();
      expect(getConversationTitles).not.toHaveBeenCalled();
      expect(result.current.items).toHaveLength(51);
    },
  );

  it('falls back to sequential JSON batches for an older backend and remembers it for the identity session', async () => {
    vi.mocked(streamConversationTitles).mockRejectedValue(
      new ResponseError(new Response(null, { status: 404 })),
    );
    vi.mocked(getConversationTitles).mockImplementation(async (ids) => ({
      items: ids.map((id) => ({ id, title: `JSON ${id}` })),
    }));
    const initial = Array.from({ length: 27 }, (_, index) =>
      pending(`conversations/bucket/${index}%255F`),
    );
    const { result, rerender } = renderHook(({ user }) => useHarness(user), {
      initialProps: { user: 'first' },
    });
    await act(async () => result.current.applyConversationList(initial, 0));
    await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
    expect(vi.mocked(getConversationTitles).mock.calls[0][0]).toEqual(
      initial.slice(0, 25).map(({ id }) => id),
    );
    expect(vi.mocked(getConversationTitles).mock.calls[1][0]).toEqual(
      initial.slice(25).map(({ id }) => id),
    );
    expect(result.current.items[26].title).toBe(`JSON ${initial[26].id}`);

    await act(async () =>
      result.current.applyConversationList([pending('again')], 0),
    );
    await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
    expect(streamConversationTitles).toHaveBeenCalledOnce();

    rerender({ user: 'second' });
    await act(async () =>
      result.current.applyConversationList([pending('again')], 0),
    );
    await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
    expect(streamConversationTitles).toHaveBeenCalledTimes(2);
  });

  it('prunes names that are no longer present in the accepted list snapshot', async () => {
    vi.mocked(streamConversationTitles).mockRejectedValue(new Error('offline'));
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

  it('cancels an old snapshot and ignores its late events', async () => {
    const oldStream = controlledStream();
    const newStream = controlledStream();
    vi.mocked(streamConversationTitles)
      .mockResolvedValueOnce(oldStream.iterable)
      .mockResolvedValueOnce(newStream.iterable);
    const { result } = renderHook(() => useHarness('user'));
    await act(async () =>
      result.current.applyConversationList([pending('id')], 0),
    );
    await waitFor(() =>
      expect(streamConversationTitles).toHaveBeenCalledOnce(),
    );
    await act(async () =>
      result.current.applyConversationList(
        [{ ...pending('id'), title: 'Newer filename' }],
        0,
      ),
    );
    expect(requestSignal(0)?.aborted).toBe(true);
    await oldStream.push(title('id', 'Stale title'), done(1, 1));
    expect(result.current.items[0].title).toBe('Newer filename');
    expect(result.current.isUpdatingTitles).toBe(true);
    await newStream.push(title('id', 'Current title'), done(1, 1));
    await waitFor(() =>
      expect(result.current.items[0].title).toBe('Current title'),
    );
  });

  it('does not overwrite a locally renamed or freshly opened title with an older event', async () => {
    const stream = controlledStream();
    vi.mocked(streamConversationTitles).mockResolvedValue(stream.iterable);
    const { result } = renderHook(() => useHarness('user'));
    await act(async () =>
      result.current.applyConversationList([pending('id')], 0),
    );
    act(() => {
      result.current.rememberTitle('id', 'Manual title');
      result.current.setItems((items) =>
        items.map((item) => ({ ...item, title: 'Manual title' })),
      );
    });
    await stream.push(title('id', 'Stale title'), done(1, 1));
    await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
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
    vi.mocked(streamConversationTitles).mockRejectedValue(new Error('offline'));
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
      result.current.rememberTitle('id', 'Saving rename', {
        isWriting: true,
      }),
    );
    vi.mocked(streamConversationTitles).mockClear();
    act(() =>
      result.current.applyConversationList(
        [pending('id')],
        result.current.getTitleRevision(),
      ),
    );
    expect(result.current.items[0].title).toBe('Saving rename');
    expect(streamConversationTitles).not.toHaveBeenCalled();
    expect(result.current.isUpdatingTitles).toBe(false);
  });

  it('does not restore deleted rows or confuse distinct encoded IDs', async () => {
    const stream = controlledStream();
    vi.mocked(streamConversationTitles).mockResolvedValue(stream.iterable);
    const { result } = renderHook(() => useHarness('user'));
    await act(async () =>
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
    await stream.push(
      title('bucket/name%5F', 'Deleted'),
      title('bucket/name_', 'Remaining'),
      done(2, 2),
    );
    await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].title).toBe('Remaining');
  });

  it('aborts on identity changes and unmount without leaking cached titles between users', async () => {
    const first = controlledStream();
    const second = controlledStream();
    vi.mocked(streamConversationTitles)
      .mockResolvedValueOnce(first.iterable)
      .mockResolvedValueOnce(second.iterable);
    const { result, rerender, unmount } = renderHook(
      ({ user }) => useHarness(user),
      { initialProps: { user: 'first' } },
    );
    await act(async () =>
      result.current.applyConversationList(
        [pending('shared-id')],
        result.current.getTitleRevision(),
      ),
    );
    await waitFor(() =>
      expect(streamConversationTitles).toHaveBeenCalledOnce(),
    );
    act(() =>
      result.current.rememberTitle('shared-id', 'Private first-user state'),
    );
    rerender({ user: 'second' });
    expect(requestSignal(0)?.aborted).toBe(true);
    await act(async () =>
      result.current.applyConversationList([pending('shared-id')], 0),
    );
    expect(result.current.items[0].title).toBe('Filename shared-id');
    await first.push(title('shared-id', 'Late first-user title'), done(1, 1));
    expect(result.current.items[0].title).toBe('Filename shared-id');
    await waitFor(() =>
      expect(streamConversationTitles).toHaveBeenCalledTimes(2),
    );
    unmount();
    expect(requestSignal(1)?.aborted).toBe(true);
    await second.push(title('shared-id', 'After unmount'), done(1, 1));
  });

  it('coalesces a burst of titles into one render update', async () => {
    const stream = controlledStream();
    vi.mocked(streamConversationTitles).mockResolvedValue(stream.iterable);
    const setItemsSpy = vi.fn();
    const { result } = renderHook(() => {
      const [items, setItems] = useState<ConversationListItemDto[]>([]);
      const enrichment = useConversationTitleEnrichment('user', (update) => {
        setItemsSpy();
        setItems(update);
      });
      return { items, ...enrichment };
    });
    await act(async () =>
      result.current.applyConversationList([pending('a'), pending('b')], 0),
    );
    setItemsSpy.mockClear();
    await stream.push(title('a', 'A'), title('b', 'B'));
    await waitFor(() =>
      expect(result.current.items.map(({ title }) => title)).toEqual([
        'A',
        'B',
      ]),
    );
    expect(setItemsSpy).toHaveBeenCalledOnce();
    await stream.push(done(2, 2));
  });

  describe('useConversationTitleEnrichment — viewport priority', () => {
    const completeAll = (ids: string[]) => [
      ...ids.map((id) => title(id, `T ${id}`)),
      done(ids.length, ids.length),
    ];

    it('requests visible IDs first when a view reports within the first frame', async () => {
      respondWith(completeAll);
      const { result } = renderHook(() => useHarness('user'));
      await act(async () => {
        result.current.applyConversationList(
          [pending('a'), pending('b'), pending('c')],
          0,
        );
        result.current.setVisibleConversationIds('view', ['c', 'missing']);
      });
      await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
      expect(requestedIds(0)).toEqual(['c', 'a', 'b']);
    });

    it('keeps metadata order when no view reports anything visible', async () => {
      respondWith(completeAll);
      const { result } = renderHook(() => useHarness('user'));
      act(() => result.current.setVisibleConversationIds('view', []));
      await act(async () =>
        result.current.applyConversationList(
          [pending('a'), pending('b'), pending('c')],
          0,
        ),
      );
      await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
      expect(requestedIds(0)).toEqual(['a', 'b', 'c']);
    });

    it('merges views and drops only the registration of a hidden view', async () => {
      respondWith(completeAll);
      const { result } = renderHook(() => useHarness('user'));
      act(() => {
        result.current.setVisibleConversationIds('drawer', ['c']);
        result.current.setVisibleConversationIds('sidebar', ['b']);
        result.current.setVisibleConversationIds('drawer', null);
      });
      await act(async () =>
        result.current.applyConversationList(
          [pending('a'), pending('b'), pending('c')],
          0,
        ),
      );
      await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
      expect(requestedIds(0)).toEqual(['b', 'a', 'c']);
    });

    it('applies a scroll to the next request without restarting the active stream', async () => {
      const stream = controlledStream();
      vi.mocked(streamConversationTitles).mockResolvedValueOnce(
        stream.iterable,
      );
      respondWith(completeAll);
      const { result } = renderHook(() => useHarness('user'));
      act(() => result.current.setVisibleConversationIds('view', ['a']));
      await act(async () =>
        result.current.applyConversationList(
          ['a', 'b', 'c', 'd'].map(pending),
          0,
        ),
      );
      await waitFor(() =>
        expect(streamConversationTitles).toHaveBeenCalledOnce(),
      );
      expect(requestedIds(0)).toEqual(['a', 'b', 'c', 'd']);

      act(() => result.current.setVisibleConversationIds('view', ['d']));
      expect(streamConversationTitles).toHaveBeenCalledOnce();
      expect(requestSignal(0)?.aborted).toBe(false);

      await stream.push(title('a', 'A'), done(1, 4, 'budget'));
      await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
      expect(requestedIds(1)).toEqual(['d', 'b', 'c']);
    });
  });

  it('does not open a stream for a snapshot superseded within the viewport window', async () => {
    respondWith((ids) => [
      ...ids.map((id) => title(id, 'Current')),
      done(ids.length, ids.length),
    ]);
    const { result } = renderHook(() => useHarness('user'));
    await act(async () => {
      result.current.applyConversationList([pending('old')], 0);
      result.current.applyConversationList([pending('new')], 0);
    });
    await waitFor(() => expect(result.current.isUpdatingTitles).toBe(false));
    expect(streamConversationTitles).toHaveBeenCalledOnce();
    expect(requestedIds(0)).toEqual(['new']);
  });
});
