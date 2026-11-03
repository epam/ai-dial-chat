import {
  ProjectSource,
  ResponseError,
  type ProjectConversationItemDto,
  type ProjectDetailsDto,
} from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyViewedMark } from '../project-viewed-marks';
import type { ProjectsApiClient } from '../projects-api-client';
import {
  PINNED_PROJECT_CHATS_LIMIT,
  usePinnedProjectChats,
  type PinnedProjectChatsOptions,
} from '../use-pinned-project-chats';

const P = 'projects/a1b2c3/support';
const Q = 'projects/a1b2c3/research';

type Client = Parameters<typeof usePinnedProjectChats>[0];

const rejection = (status: number) =>
  new ResponseError(new Response('{}', { status }));

const details = (
  id: string,
  overrides: Partial<ProjectDetailsDto> = {},
): ProjectDetailsDto => ({
  id,
  name: id.split('/').pop() ?? id,
  bucket: 'a1b2c3',
  path: id,
  source: ProjectSource.Personal,
  description: '',
  instructions: '',
  contextFiles: [],
  etag: '"a1"',
  contentVersion: 'v1',
  conversationCount: 0,
  canEdit: true,
  ...overrides,
});

const chat = (
  projectId: string,
  n: number,
  overrides: Partial<ProjectConversationItemDto> = {},
): ProjectConversationItemDto => ({
  id: `${projectId}/conversations/c${n}`,
  name: `c${n}`,
  title: `Chat ${n}`,
  updatedAt: 100,
  isUnread: false,
  ...overrides,
});

const chats = (projectId: string, count: number) =>
  Array.from({ length: count }, (_, index) => chat(projectId, index + 1));

/** A watch stream the test feeds and closes. */
const createWatchStream = () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
    },
  });
  return {
    stream,
    send: (event: object) =>
      controller.enqueue(
        new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`),
      ),
    close: () => controller.close(),
  };
};

const update = (id: string, etag?: string) => ({
  id,
  action: 'UPDATE',
  timestamp: 1,
  ...(etag ? { etag } : {}),
});

/** A promise the test settles by hand. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

describe('usePinnedProjectChats', () => {
  let getProject: ReturnType<typeof vi.fn<Client['getProject']>>;
  let listProjectConversations: ReturnType<
    typeof vi.fn<Client['listProjectConversations']>
  >;
  let getProjectConversationTitles: ReturnType<
    typeof vi.fn<Client['getProjectConversationTitles']>
  >;
  let watchProjects: ReturnType<
    typeof vi.fn<NonNullable<ProjectsApiClient['watchProjects']>>
  >;
  let client: Client;

  beforeEach(() => {
    getProject = vi.fn<Client['getProject']>(async (id) => details(id));
    listProjectConversations = vi.fn<Client['listProjectConversations']>(
      async (id) => ({ items: chats(id, 2) }),
    );
    getProjectConversationTitles = vi.fn<
      Client['getProjectConversationTitles']
    >(async () => ({ items: [] }));
    watchProjects = vi.fn<NonNullable<ProjectsApiClient['watchProjects']>>(
      async () => createWatchStream().stream,
    );
    client = {
      getProject,
      listProjectConversations,
      getProjectConversationTitles,
      watchProjects,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderPinned = (
    ids: string[] = [P],
    options: Partial<PinnedProjectChatsOptions> = {},
  ) => {
    const onProjectDeleted = vi.fn();
    const initial = { enabled: true, onProjectDeleted, ...options };
    const view = renderHook(
      ({ projectIds, opts }) => usePinnedProjectChats(client, projectIds, opts),
      { initialProps: { projectIds: ids, opts: initial } },
    );
    return { ...view, onProjectDeleted: initial.onProjectDeleted, initial };
  };

  const loaded = async (result: { current: { isLoading: boolean } }) =>
    waitFor(() => expect(result.current.isLoading).toBe(false));

  describe('loading', () => {
    it('keeps the first ten of twelve chats and reports more', async () => {
      listProjectConversations.mockResolvedValue({ items: chats(P, 12) });
      const { result } = renderPinned();
      await loaded(result);

      const [project] = result.current.projects;
      expect(project.chats).toHaveLength(PINNED_PROJECT_CHATS_LIMIT);
      expect(project.chats.map(({ title }) => title)).toEqual(
        chats(P, 10).map(({ title }) => title),
      );
      expect(project.hasMore).toBe(true);
    });

    it('reports no more for exactly ten chats', async () => {
      listProjectConversations.mockResolvedValue({ items: chats(P, 10) });
      const { result } = renderPinned();
      await loaded(result);

      expect(result.current.projects[0].chats).toHaveLength(10);
      expect(result.current.projects[0].hasMore).toBe(false);
    });

    it('reads the details and the listing in parallel', async () => {
      const listing = deferred<{ items: ProjectConversationItemDto[] }>();
      listProjectConversations.mockReturnValue(listing.promise);
      renderPinned();

      await waitFor(() => expect(getProject).toHaveBeenCalledOnce());
      expect(listProjectConversations).toHaveBeenCalledOnce();
      listing.resolve({ items: [] });
    });

    it('resolves the pending titles of the kept chats only', async () => {
      const items = chats(P, 12).map((item, index) =>
        index === 2 || index === 11 ? { ...item, isTitlePending: true } : item,
      );
      listProjectConversations.mockResolvedValue({ items });
      getProjectConversationTitles.mockResolvedValue({
        items: [{ ...items[2], title: 'Resolved 3', isTitlePending: false }],
      });
      const { result } = renderPinned();
      await loaded(result);

      expect(getProjectConversationTitles).toHaveBeenCalledOnce();
      expect(getProjectConversationTitles).toHaveBeenCalledWith(
        P,
        ['c3'],
        expect.any(AbortSignal),
      );
      expect(result.current.projects[0].chats[2].title).toBe('Resolved 3');
    });

    it('keeps the file-name titles when the titles read fails', async () => {
      listProjectConversations.mockResolvedValue({
        items: [chat(P, 1, { title: 'c1.json', isTitlePending: true })],
      });
      getProjectConversationTitles.mockRejectedValue(new Error('boom'));
      const { result } = renderPinned();
      await loaded(result);

      expect(result.current.projects[0].chats[0].title).toBe('c1.json');
    });

    it('drops a pin of a project that no longer exists and reports it once', async () => {
      getProject.mockImplementation(async (id) => {
        if (id === Q) throw rejection(404);
        return details(id);
      });
      const { result, onProjectDeleted } = renderPinned([P, Q]);
      await loaded(result);

      expect(result.current.projects.map(({ project }) => project.id)).toEqual([
        P,
      ]);
      expect(onProjectDeleted).toHaveBeenCalledOnce();
      expect(onProjectDeleted).toHaveBeenCalledWith(Q);
    });

    it('drops a project whose details fail silently on any other error', async () => {
      getProject.mockRejectedValue(rejection(500));
      const { result, onProjectDeleted } = renderPinned();
      await loaded(result);

      expect(result.current.projects).toEqual([]);
      expect(onProjectDeleted).not.toHaveBeenCalled();
    });

    it('retries a first load that failed and shows the project once it loads', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      getProject.mockRejectedValueOnce(rejection(500));
      const { result } = renderPinned();
      await loaded(result);
      expect(result.current.projects).toEqual([]);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      await waitFor(() => expect(result.current.projects).toHaveLength(1));
      expect(getProject).toHaveBeenCalledTimes(2);
    });

    it('stops retrying a failed first load after the bounded backoff', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      getProject.mockRejectedValue(rejection(403));
      const { result } = renderPinned();
      await loaded(result);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(120_000);
      });

      expect(getProject).toHaveBeenCalledTimes(6);
      expect(result.current.projects).toEqual([]);
    });

    it('cancels a pending retry for an id that leaves', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      getProject.mockRejectedValueOnce(rejection(500));
      const { result, rerender, initial } = renderPinned();
      await loaded(result);

      rerender({ projectIds: [], opts: initial });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });

      expect(getProject).toHaveBeenCalledOnce();
    });

    it('keeps the project row with no chats when the listing fails', async () => {
      listProjectConversations.mockRejectedValue(rejection(500));
      const { result } = renderPinned();
      await loaded(result);

      expect(result.current.projects[0].chats).toEqual([]);
      expect(result.current.projects[0].hasMore).toBe(false);
    });

    it('sends nothing and returns nothing while disabled', () => {
      const { result } = renderPinned([P], { enabled: false });

      expect(getProject).not.toHaveBeenCalled();
      expect(listProjectConversations).not.toHaveBeenCalled();
      expect(watchProjects).not.toHaveBeenCalled();
      expect(result.current.projects).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('re-sorts the projects on a reorder without a request', async () => {
      const { result, rerender, initial } = renderPinned([P, Q]);
      await loaded(result);
      getProject.mockClear();

      rerender({ projectIds: [Q, P], opts: initial });

      expect(result.current.projects.map(({ project }) => project.id)).toEqual([
        Q,
        P,
      ]);
      expect(getProject).not.toHaveBeenCalled();
    });

    it('loads only an added id and drops a removed one without a request', async () => {
      const { result, rerender, initial } = renderPinned([P]);
      await loaded(result);
      getProject.mockClear();

      rerender({ projectIds: [P, Q], opts: initial });
      await waitFor(() => expect(result.current.projects).toHaveLength(2));
      expect(getProject).toHaveBeenCalledOnce();
      expect(getProject).toHaveBeenCalledWith(Q, expect.any(AbortSignal));

      getProject.mockClear();
      rerender({ projectIds: [Q], opts: initial });
      expect(result.current.projects.map(({ project }) => project.id)).toEqual([
        Q,
      ]);
      expect(getProject).not.toHaveBeenCalled();
    });

    it('aborts the requests on unmount and for an id that leaves', async () => {
      const pending = deferred<ProjectDetailsDto>();
      getProject.mockReturnValue(pending.promise);
      const { rerender, initial, unmount } = renderPinned([P, Q]);
      await waitFor(() => expect(getProject).toHaveBeenCalledTimes(2));
      const signalOf = (id: string) =>
        getProject.mock.calls.find(([calledId]) => calledId === id)?.[1];
      const pSignal = signalOf(P);
      const qSignal = signalOf(Q);

      rerender({ projectIds: [P], opts: initial });
      expect(qSignal?.aborted).toBe(true);
      expect(pSignal?.aborted).toBe(false);

      unmount();
      expect(pSignal?.aborted).toBe(true);
    });

    it('aborts the requests when the tree is disabled', async () => {
      const pending = deferred<ProjectDetailsDto>();
      getProject.mockReturnValue(pending.promise);
      const { rerender, initial, result } = renderPinned([P]);
      await waitFor(() => expect(getProject).toHaveBeenCalledOnce());
      const [[, signal]] = getProject.mock.calls;

      rerender({ projectIds: [P], opts: { ...initial, enabled: false } });

      expect(signal?.aborted).toBe(true);
      expect(result.current.projects).toEqual([]);
    });
  });

  describe('watch', () => {
    const openWatch = async (ids: string[] = [P]) => {
      const watch = createWatchStream();
      watchProjects.mockResolvedValueOnce(watch.stream);
      const view = renderPinned(ids);
      await waitFor(() => expect(watchProjects).toHaveBeenCalledOnce());
      getProject.mockClear();
      listProjectConversations.mockClear();
      return { ...view, watch };
    };

    it('opens one stream over the sorted ids once the first load settles', async () => {
      const pending = deferred<ProjectDetailsDto>();
      getProject.mockImplementationOnce(() => pending.promise);
      renderPinned([P, Q]);
      await waitFor(() => expect(getProject).toHaveBeenCalledTimes(2));
      expect(watchProjects).not.toHaveBeenCalled();

      pending.resolve(details(P));

      await waitFor(() => expect(watchProjects).toHaveBeenCalledOnce());
      expect(watchProjects).toHaveBeenCalledWith(
        [Q, P].sort(),
        expect.any(AbortSignal),
      );
    });

    it('refreshes only the changed project on a new answer, without a loading state', async () => {
      const { result, watch } = await openWatch([P, Q]);
      listProjectConversations.mockImplementation(async (id) => ({
        items: [chat(id, 9, { title: 'New answer', isUnread: true })],
      }));

      act(() => watch.send(update(P, '"b2"')));

      await waitFor(() =>
        expect(result.current.projects[0].chats[0].title).toBe('New answer'),
      );
      expect(result.current.isLoading).toBe(false);
      expect(getProject).toHaveBeenCalledOnce();
      expect(getProject).toHaveBeenCalledWith(P, expect.any(AbortSignal));
      expect(listProjectConversations).toHaveBeenCalledOnce();
      expect(result.current.projects[1].chats[0].title).toBe('Chat 1');
    });

    it('skips an event for the loaded version', async () => {
      const { watch } = await openWatch();

      act(() => watch.send(update(P, '"a1"')));
      act(() => watch.send(update('projects/a1b2c3/unknown', '"x"')));
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(getProject).not.toHaveBeenCalled();
      expect(listProjectConversations).not.toHaveBeenCalled();
    });

    it('never skips an event without an etag', async () => {
      const { watch } = await openWatch();

      act(() => watch.send(update(P)));

      await waitFor(() => expect(getProject).toHaveBeenCalledOnce());
    });

    it('coalesces a burst into one trailing refresh', async () => {
      const { watch } = await openWatch();
      const first = deferred<ProjectDetailsDto>();
      getProject.mockImplementationOnce(() => first.promise);

      act(() => watch.send(update(P, '"b1"')));
      await waitFor(() => expect(getProject).toHaveBeenCalledOnce());
      for (const etag of ['"b2"', '"b3"', '"b4"', '"b5"', '"b6"']) {
        act(() => watch.send(update(P, etag)));
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(getProject).toHaveBeenCalledOnce();

      await act(async () => first.resolve(details(P, { etag: '"b1"' })));

      await waitFor(() => expect(getProject).toHaveBeenCalledTimes(2));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(getProject).toHaveBeenCalledTimes(2);
    });

    it('drops a project deleted elsewhere and reports it once', async () => {
      const { result, watch, onProjectDeleted } = await openWatch();

      act(() => watch.send({ id: P, action: 'DELETE', timestamp: 2 }));

      await waitFor(() => expect(result.current.projects).toEqual([]));
      act(() => watch.send({ id: P, action: 'DELETE', timestamp: 3 }));
      expect(onProjectDeleted).toHaveBeenCalledOnce();
      expect(onProjectDeleted).toHaveBeenCalledWith(P);
    });

    it('handles a 404 on refresh as a delete', async () => {
      const { result, watch, onProjectDeleted } = await openWatch();
      getProject.mockRejectedValueOnce(rejection(404));

      act(() => watch.send(update(P, '"b2"')));

      await waitFor(() => expect(result.current.projects).toEqual([]));
      expect(onProjectDeleted).toHaveBeenCalledWith(P);
    });

    it('keeps the previous snapshot when a refresh fails', async () => {
      const { result, watch } = await openWatch();
      getProject.mockRejectedValueOnce(rejection(500));

      act(() => watch.send(update(P, '"b2"')));

      await waitFor(() => expect(getProject).toHaveBeenCalledOnce());
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(result.current.projects[0].chats).toHaveLength(2);
    });

    it('does not retry a watch that cannot be opened and keeps the tree', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      watchProjects.mockRejectedValue(new Error('no events'));
      const { result } = renderPinned();
      await waitFor(() => expect(watchProjects).toHaveBeenCalledOnce());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });

      expect(watchProjects).toHaveBeenCalledOnce();
      expect(result.current.projects).toHaveLength(1);
    });

    it('leaves a project whose first load failed out of the stream', async () => {
      getProject.mockImplementation(async (id) => {
        if (id === Q) throw rejection(403);
        return details(id);
      });
      renderPinned([P, Q]);

      await waitFor(() => expect(watchProjects).toHaveBeenCalledOnce());
      expect(watchProjects).toHaveBeenCalledWith([P], expect.any(AbortSignal));
    });

    it('follows a project once its retried first load succeeds', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      getProject.mockImplementationOnce(async () => {
        throw rejection(500);
      });
      renderPinned([Q, P]);
      await waitFor(() => expect(watchProjects).toHaveBeenCalledOnce());
      expect(watchProjects).toHaveBeenLastCalledWith(
        [P],
        expect.any(AbortSignal),
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      await waitFor(() => expect(watchProjects).toHaveBeenCalledTimes(2));
      expect(watchProjects).toHaveBeenLastCalledWith(
        [P, Q].sort(),
        expect.any(AbortSignal),
      );
    });

    it('stops following a project deleted elsewhere', async () => {
      const { watch } = await openWatch([P, Q]);

      act(() => watch.send({ id: Q, action: 'DELETE', timestamp: 2 }));

      await waitFor(() => expect(watchProjects).toHaveBeenCalledTimes(2));
      expect(watchProjects).toHaveBeenLastCalledWith(
        [P],
        expect.any(AbortSignal),
      );
    });

    it('tries a watch that could not be opened again for a new set', async () => {
      watchProjects.mockRejectedValueOnce(new Error('denied'));
      const { rerender, initial } = renderPinned([P, Q]);
      await waitFor(() => expect(watchProjects).toHaveBeenCalledOnce());

      rerender({ projectIds: [P], opts: initial });

      await waitFor(() => expect(watchProjects).toHaveBeenCalledTimes(2));
      expect(watchProjects).toHaveBeenLastCalledWith(
        [P],
        expect.any(AbortSignal),
      );
    });

    it('refreshes every project once after a reconnect', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { watch } = await openWatch([P, Q]);

      act(() => watch.close());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      await waitFor(() => expect(watchProjects).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(getProject).toHaveBeenCalledTimes(2));
      expect(getProject.mock.calls.map(([id]) => id).sort()).toEqual(
        [P, Q].sort(),
      );
    });

    it('reopens one stream for the new set when another project is pinned', async () => {
      const { rerender, initial, result } = await openWatch();
      const [[, oldSignal]] = watchProjects.mock.calls;

      rerender({ projectIds: [P, Q], opts: initial });

      await waitFor(() => expect(oldSignal?.aborted).toBe(true));
      await waitFor(() => expect(watchProjects).toHaveBeenCalledTimes(2));
      expect(watchProjects).toHaveBeenLastCalledWith(
        [P, Q].sort(),
        expect.any(AbortSignal),
      );
      expect(result.current.projects).toHaveLength(2);
    });

    it('keeps following the loaded projects while a new pin loads', async () => {
      const { rerender, initial, watch } = await openWatch();
      const [[, oldSignal]] = watchProjects.mock.calls;
      const pending = deferred<ProjectDetailsDto>();
      getProject.mockImplementationOnce(() => pending.promise);

      rerender({ projectIds: [P, Q], opts: initial });
      await waitFor(() =>
        expect(getProject).toHaveBeenCalledWith(Q, expect.any(AbortSignal)),
      );
      expect(oldSignal?.aborted).toBe(false);
      act(() => watch.send(update(P, '"b2"')));

      await waitFor(() =>
        expect(getProject).toHaveBeenCalledWith(P, expect.any(AbortSignal)),
      );
      await act(async () => pending.resolve(details(Q)));
      await waitFor(() => expect(oldSignal?.aborted).toBe(true));
    });

    it('does not reopen the stream for a new onProjectDeleted identity', async () => {
      const { rerender, initial } = await openWatch();

      rerender({
        projectIds: [P],
        opts: { ...initial, onProjectDeleted: vi.fn() },
      });
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(watchProjects).toHaveBeenCalledOnce();
    });
  });

  describe('viewed marks', () => {
    const unreadChat = chat(P, 1, { isUnread: true, updatedAt: 100 });

    it('clears the unread state at once without a request', async () => {
      listProjectConversations.mockResolvedValue({ items: [unreadChat] });
      const { result } = renderPinned();
      await loaded(result);
      expect(result.current.projects[0].chats[0].isUnread).toBe(true);
      getProject.mockClear();
      listProjectConversations.mockClear();

      act(() => result.current.markViewed(unreadChat.id));

      expect(result.current.projects[0].chats[0].isUnread).toBeUndefined();
      expect(getProject).not.toHaveBeenCalled();
      expect(listProjectConversations).not.toHaveBeenCalled();
    });

    it('keeps a chat read when a refresh read before the mark settles', async () => {
      const watch = createWatchStream();
      watchProjects.mockResolvedValueOnce(watch.stream);
      listProjectConversations.mockResolvedValue({ items: [unreadChat] });
      const { result } = renderPinned();
      await waitFor(() => expect(watchProjects).toHaveBeenCalledOnce());
      const stale = deferred<{ items: ProjectConversationItemDto[] }>();
      listProjectConversations.mockReturnValueOnce(stale.promise);

      act(() => watch.send(update(P, '"b2"')));
      await waitFor(() =>
        expect(listProjectConversations).toHaveBeenCalledTimes(2),
      );
      act(() => result.current.markViewed(unreadChat.id));
      await act(async () => stale.resolve({ items: [unreadChat] }));

      await waitFor(() => expect(getProject).toHaveBeenCalledTimes(2));
      expect(result.current.projects[0].chats[0].isUnread).toBeUndefined();
    });

    it('turns the chat unread again when a newer answer is read', async () => {
      const watch = createWatchStream();
      watchProjects.mockResolvedValueOnce(watch.stream);
      listProjectConversations.mockResolvedValue({ items: [unreadChat] });
      const { result } = renderPinned();
      await waitFor(() => expect(watchProjects).toHaveBeenCalledOnce());
      act(() => result.current.markViewed(unreadChat.id));
      listProjectConversations.mockResolvedValue({
        items: [{ ...unreadChat, updatedAt: 200 }],
      });

      act(() => watch.send(update(P, '"b2"')));

      await waitFor(() =>
        expect(result.current.projects[0].chats[0].isUnread).toBe(true),
      );
    });

    it('refreshes one project on demand', async () => {
      const { result } = renderPinned();
      await loaded(result);
      getProject.mockClear();

      act(() => result.current.refresh(P));

      await waitFor(() => expect(getProject).toHaveBeenCalledOnce());
    });
  });
});

describe('applyViewedMark', () => {
  const item = { id: 'c1', updatedAt: 100, isUnread: true };

  it('keeps the listing state without a mark', () => {
    expect(applyViewedMark(new Map(), item)).toBe(true);
  });

  it('reads a marked chat as read until a newer version', () => {
    const marks = new Map([['c1', 100]]);
    expect(applyViewedMark(marks, item)).toBe(false);
    expect(marks.has('c1')).toBe(true);
  });

  it('drops a mark that a newer version outdated', () => {
    const marks = new Map([['c1', 100]]);
    expect(applyViewedMark(marks, { ...item, updatedAt: 200 })).toBe(true);
    expect(marks.has('c1')).toBe(false);
  });
});
