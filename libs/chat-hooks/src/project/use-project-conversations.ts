import type { ProjectConversationListResponseDto } from '@epam/ai-dial-chat-api-client';
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

const toListItems = ({
  items,
}: ProjectConversationListResponseDto): ProjectConversationListItem[] =>
  items.map(({ id, title, author }) => ({ id, title, authorName: author }));

/**
 * Loads a project's conversations for its Chats list and keeps them in local
 * state: there is no live subscription, so the first page is read once per
 * project (and on retry), `loadMore` appends the next one, and rename and
 * delete update the list in place. Requests are aborted when the project
 * changes or the view unmounts. Rename, delete and `loadMore` reject on
 * failure for the caller's toast.
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
  >,
  projectId: string | null,
) => {
  const [state, setState] = useState(INITIAL_STATE);
  const [reloadToken, setReloadToken] = useState(0);
  /* Aborts a page read when the project changes, the list reloads or the view unmounts. */
  const pageControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
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
        setState({
          items: toListItems(page),
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
    return () => controller.abort();
  }, [client, projectId, reloadToken]);

  const retry = useCallback(() => setReloadToken((token) => token + 1), []);

  const loadMore = useCallback(async () => {
    const controller = pageControllerRef.current;
    if (projectId == null || controller == null) return;
    setState((prev) => ({ ...prev, isLoadingMore: true }));
    try {
      const page = await client.listProjectConversations(
        projectId,
        controller.signal,
        { offset: state.items.length },
      );
      if (controller.signal.aborted) return;
      setState((prev) => {
        /* A delete since the last read shifts the order; never list a conversation twice. */
        const knownIds = new Set(prev.items.map((item) => item.id));
        return {
          ...prev,
          items: [
            ...prev.items,
            ...toListItems(page).filter((item) => !knownIds.has(item.id)),
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
  }, [client, projectId, state.items.length]);

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

  return { ...state, retry, loadMore, rename, remove };
};
