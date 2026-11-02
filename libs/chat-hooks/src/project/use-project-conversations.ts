import type { ProjectConversationItemDto } from '@epam/ai-dial-chat-api-client';
import type { ProjectConversationListItem } from '@epam/ai-dial-projects';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectsApiClient } from './projects-api-client';

interface ProjectConversationsState {
  items: ProjectConversationListItem[];
  isLoading: boolean;
  hasError: boolean;
  /** More conversations exist after `items`. */
  hasMore: boolean;
  /** The next page is being read. */
  isLoadingMore: boolean;
}

const INITIAL_STATE: ProjectConversationsState = {
  items: [],
  isLoading: true,
  hasError: false,
  hasMore: false,
  isLoadingMore: false,
};

const EMPTY_STATE: ProjectConversationsState = {
  ...INITIAL_STATE,
  isLoading: false,
};

/* The BFF's default first page, and its largest one. */
const FIRST_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/** Conversation id → its `updatedAt` when the viewer opened it from the list. */
type ViewedMarks = Map<string, number | undefined>;

/*
 * A row marked viewed stays read until a read reports a newer `updatedAt`
 * than the one it had when marked, so a read already in flight cannot bring
 * back the dot the user just cleared.
 */
const toListItems = (
  items: ProjectConversationItemDto[],
  viewed: ViewedMarks,
): ProjectConversationListItem[] =>
  items.map(({ id, title, author, updatedAt, isUnread }) => {
    let isRowUnread = isUnread;
    if (viewed.has(id)) {
      const markedAt = viewed.get(id);
      if (updatedAt != null && markedAt != null && updatedAt > markedAt) {
        viewed.delete(id);
      } else {
        isRowUnread = false;
      }
    }
    return {
      id,
      title,
      authorName: author,
      ...(isRowUnread ? { isUnread: true } : {}),
    };
  });

/**
 * Loads a project's conversations for its Chats list and keeps them in local
 * state: the first page is read once per project (and on retry), `loadMore`
 * appends the next one, `refresh` silently re-reads the rows already shown
 * for live updates, and rename, delete and `markViewed` update the list in
 * place. Requests are aborted when the project changes or the view unmounts.
 * Rename, delete and `loadMore` reject on failure for the caller's toast.
 *
 * @param client - Configured project requests, from `createProjectsApiClient`; it must be referentially stable, because a new object reloads the list.
 * @param projectId - The project's DIAL id, or `null` while none is known.
 */
export const useProjectConversations = (
  client: Pick<
    ProjectsApiClient,
    | 'listProjectConversations'
    | 'renameProjectConversation'
    | 'deleteProjectConversation'
    | 'markProjectConversationViewed'
  >,
  projectId: string | null,
) => {
  const [state, setState] = useState(INITIAL_STATE);
  const [reloadToken, setReloadToken] = useState(0);
  /* Aborts a page read when the project changes, the list reloads or the view unmounts. */
  const pageControllerRef = useRef<AbortController | null>(null);
  const refreshControllerRef = useRef<AbortController | null>(null);
  /* Bumped by each refresh, so a `loadMore` that settles after one started is dropped. */
  const listVersionRef = useRef(0);
  const viewedRef = useRef<ViewedMarks>(new Map());
  const updatedAtRef = useRef(new Map<string, number | undefined>());
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const remember = useCallback((items: ProjectConversationItemDto[]) => {
    for (const { id, updatedAt } of items) {
      updatedAtRef.current.set(id, updatedAt);
    }
  }, []);

  useEffect(() => {
    viewedRef.current = new Map();
    updatedAtRef.current = new Map();
    if (projectId == null) {
      setState(EMPTY_STATE);
      return;
    }
    const controller = new AbortController();
    pageControllerRef.current = controller;
    const load = async () => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        hasError: false,
        isLoadingMore: false,
      }));
      try {
        const page = await client.listProjectConversations(
          projectId,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        remember(page.items);
        setState({
          items: toListItems(page.items, viewedRef.current),
          isLoading: false,
          hasError: false,
          hasMore: page.hasMore,
          isLoadingMore: false,
        });
      } catch {
        if (controller.signal.aborted) return;
        setState({ ...EMPTY_STATE, hasError: true });
      }
    };
    void load();
    return () => {
      controller.abort();
      refreshControllerRef.current?.abort();
    };
  }, [client, projectId, reloadToken, remember]);

  const retry = useCallback(() => setReloadToken((token) => token + 1), []);

  const loadMore = useCallback(async () => {
    const controller = pageControllerRef.current;
    if (projectId == null || controller == null) return;
    const listVersion = listVersionRef.current;
    setState((prev) => ({ ...prev, isLoadingMore: true }));
    try {
      const page = await client.listProjectConversations(
        projectId,
        controller.signal,
        { offset: state.items.length },
      );
      if (controller.signal.aborted) return;
      if (listVersion !== listVersionRef.current) {
        setState((prev) => ({ ...prev, isLoadingMore: false }));
        return;
      }
      remember(page.items);
      setState((prev) => {
        /* A delete since the last read shifts the order; never list a conversation twice. */
        const knownIds = new Set(prev.items.map((item) => item.id));
        return {
          ...prev,
          items: [
            ...prev.items,
            ...toListItems(page.items, viewedRef.current).filter(
              (item) => !knownIds.has(item.id),
            ),
          ],
          hasMore: page.hasMore,
          isLoadingMore: false,
        };
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      setState((prev) => ({ ...prev, isLoadingMore: false }));
      throw error;
    }
  }, [client, projectId, remember, state.items.length]);

  const refresh = useCallback(async () => {
    const current = stateRef.current;
    if (projectId == null || current.isLoading || current.hasError) return;
    refreshControllerRef.current?.abort();
    const controller = new AbortController();
    refreshControllerRef.current = controller;
    listVersionRef.current += 1;
    const target = Math.max(current.items.length, FIRST_PAGE_SIZE);
    const collected: ProjectConversationItemDto[] = [];
    let hasMore = true;
    try {
      while (collected.length < target && hasMore) {
        const page = await client.listProjectConversations(
          projectId,
          controller.signal,
          {
            offset: collected.length,
            limit: Math.min(MAX_PAGE_SIZE, target - collected.length),
          },
        );
        if (controller.signal.aborted) return;
        collected.push(...page.items);
        hasMore = page.hasMore;
        if (page.items.length === 0) break;
      }
    } catch {
      /* The rows stay; the next change or a reload tries again. */
      return;
    }
    if (controller.signal.aborted) return;
    remember(collected);
    const seen = new Set<string>();
    const items = toListItems(collected, viewedRef.current).filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    setState((prev) => ({ ...prev, items, hasMore, isLoadingMore: false }));
  }, [client, projectId, remember]);

  useEffect(() => () => refreshControllerRef.current?.abort(), []);

  const markViewed = useCallback(
    (id: string) => {
      viewedRef.current.set(id, updatedAtRef.current.get(id));
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === id && item.isUnread ? { ...item, isUnread: false } : item,
        ),
      }));
      const persist = async () => {
        try {
          await client.markProjectConversationViewed?.(id);
        } catch {
          /* The row stays read here; the next list read reports the truth. */
        }
      };
      void persist();
    },
    [client],
  );

  const rename = useCallback(
    async (id: string, newTitle: string) => {
      const { name } = await client.renameProjectConversation(id, newTitle);
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === id ? { ...item, title: name } : item,
        ),
      }));
    },
    [client],
  );

  const remove = useCallback(
    async (id: string) => {
      await client.deleteProjectConversation(id);
      setState((prev) => ({
        ...prev,
        items: prev.items.filter((item) => item.id !== id),
      }));
    },
    [client],
  );

  return {
    ...state,
    retry,
    loadMore,
    rename,
    remove,
    refresh,
    markViewed,
  };
};
