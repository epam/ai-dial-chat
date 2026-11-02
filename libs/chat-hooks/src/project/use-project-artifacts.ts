import type { ProjectArtifactItemDto } from '@epam/ai-dial-chat-api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectsApiClient } from './projects-api-client';

interface ProjectArtifactsState {
  /** The project's outputs, newest first, as the BFF lists them. */
  items: ProjectArtifactItemDto[];
  isLoading: boolean;
  hasError: boolean;
}

const INITIAL_STATE: ProjectArtifactsState = {
  items: [],
  isLoading: true,
  hasError: false,
};

const EMPTY_STATE: ProjectArtifactsState = {
  ...INITIAL_STATE,
  isLoading: false,
};

/**
 * Loads the files the agents of a project's chats saved under its
 * `artifacts/` folder, for the project view's Outputs section, and keeps them
 * in local state. The list is read once per project (and on retry), and
 * `refresh` silently re-reads it for live updates, keeping the shown outputs
 * when it fails. A `refresh` that arrives while a read is in flight is not
 * dropped: that read lists once more before it settles. A retry keeps
 * `hasError` until its read settles, so the host's error UI stays in place. A
 * request is aborted by a newer one, a project change or unmount.
 *
 * @param client - Configured project requests, from `createProjectsApiClient`; it must be referentially stable, because a new object reloads the list.
 * @param projectId - The project's DIAL id, or `null` while none is known.
 */
export const useProjectArtifacts = (
  client: Pick<ProjectsApiClient, 'listProjectArtifacts'>,
  projectId: string | null,
) => {
  const [state, setState] = useState(INITIAL_STATE);
  const [reloadToken, setReloadToken] = useState(0);
  const refreshControllerRef = useRef<AbortController | null>(null);
  /* A live update arrived while a read was in flight; that read may predate it. */
  const isRefreshPendingRef = useRef(false);
  /* The project the state belongs to; only a retry of the same project keeps its error while reading. */
  const stateProjectIdRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    const isSameProject = stateProjectIdRef.current === projectId;
    stateProjectIdRef.current = projectId;
    if (projectId == null) {
      setState(EMPTY_STATE);
      return;
    }
    const controller = new AbortController();
    isRefreshPendingRef.current = false;
    const load = async () => {
      setState((prev) =>
        isSameProject ? { ...prev, isLoading: true } : INITIAL_STATE,
      );
      try {
        let items: ProjectArtifactItemDto[];
        do {
          isRefreshPendingRef.current = false;
          ({ items } = await client.listProjectArtifacts(
            projectId,
            controller.signal,
          ));
          if (controller.signal.aborted) return;
        } while (isRefreshPendingRef.current);
        setState({ items, isLoading: false, hasError: false });
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
  }, [client, projectId, reloadToken]);

  const retry = useCallback(() => setReloadToken((token) => token + 1), []);

  const refresh = useCallback(async () => {
    const current = stateRef.current;
    if (projectId == null) return;
    if (current.isLoading) {
      isRefreshPendingRef.current = true;
      return;
    }
    if (current.hasError) return;
    refreshControllerRef.current?.abort();
    const controller = new AbortController();
    refreshControllerRef.current = controller;
    try {
      const { items } = await client.listProjectArtifacts(
        projectId,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setState((prev) => ({ ...prev, items }));
    } catch {
      /* A failed live refresh keeps the outputs already shown. */
    }
  }, [client, projectId]);

  return { ...state, retry, refresh };
};
