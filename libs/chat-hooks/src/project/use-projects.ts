import type { ProjectItem, ProjectSource } from '@epam/ai-dial-projects';
import { useCallback, useEffect, useState } from 'react';
import { mapProjectDtoToItem, mapProjectSource } from './project-mapping';
import type { ProjectsApiClient } from './projects-api-client';

interface ProjectsResult {
  /** The reload token the result answers; a different current token means a request is in flight. */
  reloadToken: number;
  projects: ProjectItem[];
  incompleteSources: ProjectSource[];
  hasError: boolean;
}

/**
 * Loads the projects the session user can see, mapped to the Projects lib's
 * cards. Loading is derived from whether a result answers the current reload
 * token, so an enabled page is loading from its very first render. The
 * request is aborted on unmount or when `enabled` turns false.
 *
 * @param client - Configured project requests, from `createProjectsApiClient`; it must be referentially stable, because a new object reloads.
 * @param enabled - Whether the page is enabled; no request is sent while `false`.
 */
export const useProjects = (
  client: Pick<ProjectsApiClient, 'listProjects'>,
  enabled: boolean,
) => {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<ProjectsResult | undefined>();

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    const load = async () => {
      try {
        const { items, incompleteSources } = await client.listProjects(
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setResult({
          reloadToken,
          projects: items.map(mapProjectDtoToItem),
          incompleteSources: incompleteSources.map(mapProjectSource),
          hasError: false,
        });
      } catch {
        if (controller.signal.aborted) return;
        setResult({
          reloadToken,
          projects: [],
          incompleteSources: [],
          hasError: true,
        });
      }
    };

    void load();
    return () => controller.abort();
  }, [client, enabled, reloadToken]);

  const retry = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const settled = result?.reloadToken === reloadToken ? result : undefined;

  return {
    projects: settled?.projects ?? [],
    incompleteSources: settled?.incompleteSources ?? [],
    isLoading: enabled && settled == null,
    hasError: settled?.hasError ?? false,
    retry,
  };
};
