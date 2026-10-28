import type { ProjectDetailsDto } from '@epam/ai-dial-chat-api-client';
import { getApiErrorStatus } from '@epam/ai-dial-chat-hooks';
import { useCallback, useEffect, useState } from 'react';
import { getProject } from '../../server-api/projects.api';

interface ProjectResult {
  /** The id and reload token the result answers; anything else means a request is in flight. */
  key: string;
  project: ProjectDetailsDto | null;
  hasError: boolean;
  isNotFound: boolean;
}

/**
 * Loads one project for the project view and edit pages. Only those pages
 * read it, so it lives in this hook instead of a context. Loading is derived
 * from whether a result answers the current id and reload token, so a page
 * never renders a stale project for a new id, nor an empty state before the
 * request starts. A `404` is a not-found result, every other failure an
 * error; the request is aborted on unmount and on an id change.
 *
 * @param id - The project's DIAL id, or `null` when the route names none.
 * @param enabled - Whether the page is enabled; no request is sent while `false`.
 */
export const useProject = (id: string | null, enabled: boolean) => {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<ProjectResult | undefined>();
  const key = `${reloadToken}:${id ?? ''}`;

  useEffect(() => {
    if (!enabled || id == null) return;

    const controller = new AbortController();
    const load = async () => {
      try {
        const project = await getProject(id, { signal: controller.signal });
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
  }, [enabled, id, key]);

  const retry = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const settled = result?.key === key ? result : undefined;

  return {
    project: settled?.project ?? null,
    isLoading: enabled && id != null && settled == null,
    hasError: settled?.hasError ?? false,
    isNotFound: settled?.isNotFound ?? false,
    retry,
  };
};
