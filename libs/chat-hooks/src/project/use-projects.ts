import type { ListProjectsResponseDto } from '@epam/ai-dial-chat-api-client';
import type { ProjectItem, ProjectSource } from '@epam/ai-dial-projects';
import { useCallback, useEffect, useRef, useState } from 'react';
import { applyProjectEvent } from './project-events';
import { mapProjectDtoToItem, mapProjectSource } from './project-mapping';
import { runProjectWatch } from './project-watch-stream';
import type { ProjectsApiClient } from './projects-api-client';

/** Most project ids one watch subscribes to; the same bound the BFF enforces. */
const PROJECTS_WATCH_MAX_IDS = 1000;

/* Project ids are path-like and never contain a newline. */
const WATCH_KEY_SEPARATOR = '\n';

interface ProjectsResult {
  /** The reload token the result answers; a different current token means a request is in flight. */
  reloadToken: number;
  projects: ProjectItem[];
  incompleteSources: ProjectSource[];
  hasError: boolean;
  /** Sorted, joined ids the watch follows; fixed by a load, so a live delete does not resubscribe. */
  watchKey: string;
}

const toLoadedResult = (
  { items, incompleteSources }: ListProjectsResponseDto,
  reloadToken: number,
): ProjectsResult => {
  const projects = items.map(mapProjectDtoToItem);
  return {
    reloadToken,
    projects,
    incompleteSources: incompleteSources.map(mapProjectSource),
    hasError: false,
    watchKey: projects
      .slice(0, PROJECTS_WATCH_MAX_IDS)
      .map(({ id }) => id)
      .sort()
      .join(WATCH_KEY_SEPARATOR),
  };
};

/**
 * Loads the projects the session user can see, mapped to the Projects lib's
 * cards, and keeps them current while mounted. Loading is derived from
 * whether a result answers the current reload token, so an enabled page is
 * loading from its very first render. The request is aborted on unmount or
 * when `enabled` turns false.
 *
 * When the client offers `watchProjects`, a successful load opens one watch
 * stream for the listed projects: an update moves a card's `updatedAt`
 * forward and a delete removes it. A stream that drops is reopened with a
 * bounded backoff and followed by a silent reload, so changes made during
 * the gap are not lost; a watch that cannot be opened at all is not retried
 * for the rest of the visit.
 *
 * @param client - Configured project requests, from `createProjectsApiClient`; it must be referentially stable, because a new object reloads.
 * @param enabled - Whether the page is enabled; no request is sent while `false`.
 */
export const useProjects = (
  client: Pick<ProjectsApiClient, 'listProjects' | 'watchProjects'>,
  enabled: boolean,
) => {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<ProjectsResult | undefined>();
  const isWatchUnavailableRef = useRef(false);
  const refreshControllerRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    const load = async () => {
      try {
        const listing = await client.listProjects(controller.signal);
        if (controller.signal.aborted) return;
        setResult(toLoadedResult(listing, reloadToken));
      } catch {
        if (controller.signal.aborted) return;
        setResult({
          reloadToken,
          projects: [],
          incompleteSources: [],
          hasError: true,
          watchKey: '',
        });
      }
    };

    void load();
    return () => controller.abort();
  }, [client, enabled, reloadToken]);

  /* Replaces the list without the loading state; a failure keeps the list. */
  const refreshSilently = useCallback(async () => {
    refreshControllerRef.current?.abort();
    const controller = new AbortController();
    refreshControllerRef.current = controller;
    try {
      const listing = await client.listProjects(controller.signal);
      if (controller.signal.aborted) return;
      setResult((current) =>
        current == null || current.hasError
          ? current
          : toLoadedResult(listing, current.reloadToken),
      );
    } catch {
      /* The current list stays; the next drop or a reload tries again. */
    }
  }, [client]);

  useEffect(() => () => refreshControllerRef.current?.abort(), []);

  const settled = result?.reloadToken === reloadToken ? result : undefined;
  const watchKey = enabled ? (settled?.watchKey ?? '') : '';
  const { watchProjects } = client;

  useEffect(() => {
    if (
      watchProjects == null ||
      watchKey === '' ||
      isWatchUnavailableRef.current
    ) {
      return;
    }

    const controller = new AbortController();
    runProjectWatch({
      watchProjects,
      ids: watchKey.split(WATCH_KEY_SEPARATOR),
      signal: controller.signal,
      onEvent: (event) =>
        setResult((current) => {
          if (current == null) return current;
          const projects = applyProjectEvent(current.projects, event);
          return projects === current.projects
            ? current
            : { ...current, projects };
        }),
      onReconnected: () => {
        void refreshSilently();
      },
      onUnavailable: () => {
        isWatchUnavailableRef.current = true;
      },
    });
    return () => controller.abort();
  }, [watchProjects, watchKey, refreshSilently]);

  const retry = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  return {
    projects: settled?.projects ?? [],
    incompleteSources: settled?.incompleteSources ?? [],
    isLoading: enabled && settled == null,
    hasError: settled?.hasError ?? false,
    retry,
  };
};
