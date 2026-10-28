import type { ProjectItem, ProjectSource } from '@epam/ai-dial-projects';
import { useCallback, useEffect, useState } from 'react';
import { listProjects } from '../../server-api/projects.api';
import {
  mapProjectDtoToItem,
  mapProjectSource,
} from '../../utils/map-project-dto';

interface ProjectsResult {
  /** The reload token the result answers; a different current token means a request is in flight. */
  reloadToken: number;
  projects: ProjectItem[];
  incompleteSources: ProjectSource[];
  hasError: boolean;
}

/**
 * Loads the projects the session user can see for the Projects page.
 * The page is the only consumer, so the list lives in this hook instead of a
 * context. Loading is derived from whether a result answers the current
 * reload token, so an enabled page is loading from its very first render —
 * never momentarily empty before the request starts. The request is aborted
 * on unmount or when `enabled` turns false, and nothing is fetched while the
 * feature flag keeps the page disabled.
 *
 * @param enabled - Whether the page is enabled; no request is sent while `false`.
 */
export const useProjects = (enabled: boolean) => {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<ProjectsResult | undefined>();

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    const load = async () => {
      try {
        const { items, incompleteSources } = await listProjects({
          signal: controller.signal,
        });
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
  }, [enabled, reloadToken]);

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
