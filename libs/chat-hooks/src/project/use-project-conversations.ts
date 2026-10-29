import type { ProjectConversationListItem } from '@epam/ai-dial-projects';
import { useCallback, useEffect, useState } from 'react';
import type { ProjectsApiClient } from './projects-api-client';

interface ProjectConversationsState {
  items: ProjectConversationListItem[];
  isLoading: boolean;
  hasError: boolean;
}

const INITIAL_STATE: ProjectConversationsState = {
  items: [],
  isLoading: true,
  hasError: false,
};

/**
 * Loads a project's conversations for its Chats list and keeps them in local
 * state: there is no live subscription, so the list is read once per project
 * (and on retry), and rename and delete update it in place. The request is
 * aborted when the project changes or the view unmounts. Rename and delete
 * reject on failure for the caller's toast.
 *
 * @param client - Configured project requests, from `createProjectsApiClient`.
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

  useEffect(() => {
    if (projectId == null) return;
    const controller = new AbortController();
    const load = async () => {
      setState((prev) => ({ ...prev, isLoading: true, hasError: false }));
      try {
        const { items } = await client.listProjectConversations(
          projectId,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setState({
          items: items.map(({ id, title, author }) => ({
            id,
            title,
            authorName: author,
          })),
          isLoading: false,
          hasError: false,
        });
      } catch {
        if (controller.signal.aborted) return;
        setState({ items: [], isLoading: false, hasError: true });
      }
    };
    void load();
    return () => controller.abort();
  }, [client, projectId, reloadToken]);

  const retry = useCallback(() => setReloadToken((token) => token + 1), []);

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

  return { ...state, retry, rename, remove };
};
