import type { ProjectConversationItemDto } from '@epam/ai-dial-chat-api-client';
import type { ProjectConversationListItem } from '@epam/ai-dial-projects';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyViewedMark, type ViewedMarks } from './project-viewed-marks';
import type { ProjectsApiClient } from './projects-api-client';

interface ProjectConversationsState {
  /** Every conversation of the project, newest first. */
  rows: ConversationRow[];
  /** How many of `rows` the list shows. */
  visibleCount: number;
  isLoading: boolean;
  hasError: boolean;
  /** The titles of the next rows are being read. */
  isLoadingMore: boolean;
}

/** A listed conversation with what the hook needs to resolve its title later. */
interface ConversationRow extends ProjectConversationListItem {
  /** File name under the project `conversations/` folder. */
  name: string;
  /** The title is the file-name one until the body is read. */
  isTitlePending: boolean;
}

/* The design's page of chats before See more. */
const PAGE_SIZE = 20;
/* The most names one titles request resolves. */
const TITLES_BATCH_SIZE = 100;

const INITIAL_STATE: ProjectConversationsState = {
  rows: [],
  visibleCount: PAGE_SIZE,
  isLoading: true,
  hasError: false,
  isLoadingMore: false,
};

const EMPTY_STATE: ProjectConversationsState = {
  ...INITIAL_STATE,
  isLoading: false,
};

/* A row marked viewed stays read until a read reports a newer `updatedAt` (see `applyViewedMark`). */
const toRows = (
  items: ProjectConversationItemDto[],
  viewed: ViewedMarks,
): ConversationRow[] =>
  items.map((item) => {
    const { id, name, title, author, isTitlePending } = item;
    return {
      id,
      name,
      title,
      authorName: author,
      isTitlePending: isTitlePending === true,
      ...(applyViewedMark(viewed, item) ? { isUnread: true } : {}),
    };
  });

/* Replaces the rows a titles read resolved, keeping every other row as it is. */
const mergeResolved = (
  rows: ConversationRow[],
  resolved: ConversationRow[],
): ConversationRow[] => {
  if (resolved.length === 0) return rows;
  const byId = new Map(resolved.map((row) => [row.id, row]));
  return rows.map((row) => byId.get(row.id) ?? row);
};

const toListItem = ({
  id,
  title,
  authorName,
  isUnread,
}: ConversationRow): ProjectConversationListItem => ({
  id,
  title,
  authorName,
  ...(isUnread ? { isUnread: true } : {}),
});

/**
 * Loads a project's conversations for its Chats list and keeps them in local
 * state. DIAL Core cannot page them in display order, so the whole list is
 * read once per project (and on retry) and paged here: the list shows the
 * first 20, and `loadMore` shows 20 more after reading the titles the list
 * left pending. `refresh` silently re-reads the whole list for live updates,
 * and rename, delete and `markViewed` update it in place. Requests are
 * aborted when the project changes or the view unmounts. Rename, delete and
 * `loadMore` reject on failure for the caller's toast.
 *
 * @param client - Configured project requests, from `createProjectsApiClient`; it must be referentially stable, because a new object reloads the list.
 * @param projectId - The project's DIAL id, or `null` while none is known.
 */
export const useProjectConversations = (
  client: Pick<
    ProjectsApiClient,
    | 'listProjectConversations'
    | 'getProjectConversationTitles'
    | 'renameProjectConversation'
    | 'deleteProjectConversation'
    | 'markProjectConversationViewed'
  >,
  projectId: string | null,
) => {
  const [state, setState] = useState(INITIAL_STATE);
  const [reloadToken, setReloadToken] = useState(0);
  /* Aborts the project's reads when the project changes, the list reloads or the view unmounts. */
  const pageControllerRef = useRef<AbortController | null>(null);
  const refreshControllerRef = useRef<AbortController | null>(null);
  /* Set synchronously, so a second See more before the next render is ignored. */
  const isLoadingMoreRef = useRef(false);
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

  /* Reads the pending titles among `rows`; resolves the rows it read. */
  const resolvePending = useCallback(
    async (
      rows: ConversationRow[],
      signal: AbortSignal,
    ): Promise<ConversationRow[]> => {
      if (projectId == null) return [];
      const names = rows
        .filter((row) => row.isTitlePending)
        .map((row) => row.name);
      const resolved: ProjectConversationItemDto[] = [];
      for (let start = 0; start < names.length; start += TITLES_BATCH_SIZE) {
        const { items } = await client.getProjectConversationTitles(
          projectId,
          names.slice(start, start + TITLES_BATCH_SIZE),
          signal,
        );
        resolved.push(...items);
      }
      remember(resolved);
      return toRows(resolved, viewedRef.current);
    },
    [client, projectId, remember],
  );

  /* Silently fills titles a delete or refresh brought into view; a failure keeps the file-name titles. */
  const fillPending = useCallback(
    async (rows: ConversationRow[], count: number, signal: AbortSignal) => {
      try {
        const resolved = await resolvePending(rows.slice(0, count), signal);
        if (signal.aborted) return;
        setState((prev) => ({
          ...prev,
          rows: mergeResolved(prev.rows, resolved),
        }));
      } catch {
        /* The next refresh tries again. */
      }
    },
    [resolvePending],
  );

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
        const { items } = await client.listProjectConversations(
          projectId,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        remember(items);
        setState({
          ...EMPTY_STATE,
          rows: toRows(items, viewedRef.current),
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
    const current = stateRef.current;
    if (projectId == null || controller == null || isLoadingMoreRef.current) {
      return;
    }
    isLoadingMoreRef.current = true;
    const nextCount = current.visibleCount + PAGE_SIZE;
    const nextRows = current.rows.slice(current.visibleCount, nextCount);
    /* The next rows show once their titles are read, so none flashes its file name. */
    setState((prev) => ({ ...prev, isLoadingMore: true }));
    try {
      const resolved = await resolvePending(nextRows, controller.signal);
      if (controller.signal.aborted) return;
      setState((prev) => ({
        ...prev,
        rows: mergeResolved(prev.rows, resolved),
        visibleCount: Math.max(prev.visibleCount, nextCount),
        isLoadingMore: false,
      }));
    } catch (error) {
      if (controller.signal.aborted) return;
      setState((prev) => ({ ...prev, isLoadingMore: false }));
      throw error;
    } finally {
      isLoadingMoreRef.current = false;
    }
  }, [projectId, resolvePending]);

  const refresh = useCallback(async () => {
    const current = stateRef.current;
    if (projectId == null || current.isLoading || current.hasError) return;
    refreshControllerRef.current?.abort();
    const controller = new AbortController();
    refreshControllerRef.current = controller;
    let rows: ConversationRow[];
    try {
      const { items } = await client.listProjectConversations(
        projectId,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      remember(items);
      rows = toRows(items, viewedRef.current);
    } catch {
      /* The rows stay; the next change or a reload tries again. */
      return;
    }
    setState((prev) => ({ ...prev, rows }));
    await fillPending(rows, stateRef.current.visibleCount, controller.signal);
  }, [client, fillPending, projectId, remember]);

  useEffect(() => () => refreshControllerRef.current?.abort(), []);

  const markViewed = useCallback(
    (id: string) => {
      viewedRef.current.set(id, updatedAtRef.current.get(id));
      setState((prev) => ({
        ...prev,
        rows: prev.rows.map((row) =>
          row.id === id && row.isUnread ? { ...row, isUnread: false } : row,
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
        rows: prev.rows.map((row) =>
          row.id === id ? { ...row, title: name, isTitlePending: false } : row,
        ),
      }));
    },
    [client],
  );

  const remove = useCallback(
    async (id: string) => {
      await client.deleteProjectConversation(id);
      const { rows, visibleCount } = stateRef.current;
      const remaining = rows.filter((row) => row.id !== id);
      setState((prev) => ({
        ...prev,
        rows: prev.rows.filter((row) => row.id !== id),
      }));
      /* The row that slides into view may still carry its file-name title. */
      const controller = pageControllerRef.current;
      if (controller != null) {
        void fillPending(remaining, visibleCount, controller.signal);
      }
    },
    [client, fillPending],
  );

  const { rows, visibleCount, isLoading, hasError, isLoadingMore } = state;
  const items = useMemo(
    () => rows.slice(0, visibleCount).map(toListItem),
    [rows, visibleCount],
  );

  return {
    items,
    isLoading,
    hasError,
    /** More conversations exist after `items`. */
    hasMore: visibleCount < rows.length,
    /** The titles of the next conversations are being read. */
    isLoadingMore,
    retry,
    loadMore,
    rename,
    remove,
    refresh,
    markViewed,
  };
};
