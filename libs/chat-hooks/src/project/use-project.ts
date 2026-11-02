import type { ProjectDetailsDto } from '@epam/ai-dial-chat-api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiErrorStatus } from '../api-error/api-error';
import { ProjectRefreshOutcome } from './project-refresh';
import type { ProjectsApiClient } from './projects-api-client';

interface ProjectResult {
  /** The id and reload token the result answers; anything else means a request is in flight. */
  key: string;
  project: ProjectDetailsDto | null;
  hasError: boolean;
  isNotFound: boolean;
}

/**
 * Loads one project's details. Loading is derived from whether a result
 * answers the current id and reload token, so a page never renders a stale
 * project for a new id. A `404` is a not-found result, every other failure an
 * error; the request is aborted on unmount and on an id change. `refresh`
 * re-reads the loaded project without the loading state, for live updates.
 *
 * @param client - Configured project requests, from `createProjectsApiClient`; it must be referentially stable, because a new object reloads.
 * @param id - The project's DIAL id, or `null` when the route names none.
 * @param enabled - Whether the page is enabled; no request is sent while `false`.
 */
export const useProject = (
  client: Pick<ProjectsApiClient, 'getProject'>,
  id: string | null,
  enabled: boolean,
) => {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<ProjectResult | undefined>();
  const key = `${reloadToken}:${id ?? ''}`;

  useEffect(() => {
    if (!enabled || id == null) return;

    const controller = new AbortController();
    const load = async () => {
      try {
        const project = await client.getProject(id, controller.signal);
        if (controller.signal.aborted) return;
        setResult({ key, project, hasError: false, isNotFound: false });
      } catch (err) {
        if (controller.signal.aborted) return;
        const isNotFound = getApiErrorStatus(err) === 404;
        setResult({ key, project: null, hasError: !isNotFound, isNotFound });
      }
    };

    void load();
    return () => controller.abort();
  }, [client, enabled, id, key]);

  const retry = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const settled = result?.key === key ? result : undefined;
  const loadedProject = settled?.project ?? null;
  const refreshControllerRef = useRef<AbortController | null>(null);

  /* A newer refresh and an id change supersede an older one. */
  useEffect(
    () => () => {
      refreshControllerRef.current?.abort();
      refreshControllerRef.current = null;
    },
    [key],
  );

  const refresh = useCallback(async (): Promise<ProjectRefreshOutcome> => {
    if (loadedProject == null || id == null) {
      return ProjectRefreshOutcome.Skipped;
    }
    refreshControllerRef.current?.abort();
    const controller = new AbortController();
    refreshControllerRef.current = controller;
    try {
      const project = await client.getProject(id, controller.signal);
      if (controller.signal.aborted) return ProjectRefreshOutcome.Skipped;
      setResult((current) =>
        current?.key === key ? { ...current, project } : current,
      );
      return ProjectRefreshOutcome.Updated;
    } catch (err) {
      if (controller.signal.aborted) return ProjectRefreshOutcome.Skipped;
      return getApiErrorStatus(err) === 404
        ? ProjectRefreshOutcome.NotFound
        : ProjectRefreshOutcome.Failed;
    }
  }, [client, id, key, loadedProject]);

  return {
    project: loadedProject,
    isLoading: enabled && id != null && settled == null,
    hasError: settled?.hasError ?? false,
    isNotFound: settled?.isNotFound ?? false,
    retry,
    refresh,
  };
};
