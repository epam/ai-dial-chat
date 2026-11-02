import { ProjectWatchAction } from '@epam/ai-dial-chat-api-client';
import { useEffect, useRef } from 'react';
import { runProjectWatch } from './project-watch-stream';
import type { ProjectsApiClient } from './projects-api-client';

/** What `useProjectWatch` reports to the page that shows one project. */
export interface ProjectWatchOptions {
  /** The loaded snapshot's aggregate ETag; the watch opens once it is known, and an event carrying it is skipped. */
  etag: string | undefined;
  /** Silent refresh of everything the page shows; at most one runs at a time, and a rejection is ignored. */
  onChange: () => Promise<void>;
  /** The project was deleted elsewhere; called at most once per project id. */
  onDelete: () => void;
}

/**
 * Keeps a page showing one project current: it watches that project, runs
 * `onChange` for each change the page has not loaded yet — one at a time,
 * plus one trailing run for whatever arrived meanwhile — and `onDelete` once
 * when the project is deleted. A dropped stream is reopened with a bounded
 * backoff and followed by one `onChange`; a watch that cannot be opened is
 * not retried for the rest of the visit.
 *
 * @param client - Configured project requests, from `createProjectsApiClient`; it must be referentially stable, because a new object resubscribes.
 * @param projectId - The watched project's DIAL id, or `null` while none is known.
 * @param options - The loaded ETag and the page's callbacks; read at event time, so new identities never resubscribe.
 */
export const useProjectWatch = (
  client: Pick<ProjectsApiClient, 'watchProjects'>,
  projectId: string | null,
  options: ProjectWatchOptions,
): void => {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });
  /* The project whose watch could not be opened; another project tries again. */
  const unavailableProjectIdRef = useRef<string | null>(null);
  const isLoaded = options.etag != null;
  const { watchProjects } = client;

  useEffect(() => {
    if (
      watchProjects == null ||
      projectId == null ||
      !isLoaded ||
      unavailableProjectIdRef.current === projectId
    ) {
      return;
    }

    const controller = new AbortController();
    let isRefreshing = false;
    let isRefreshPending = false;

    /* One refresh in flight; events during it collapse into one trailing run. */
    const requestRefresh = () => {
      if (controller.signal.aborted) return;
      if (isRefreshing) {
        isRefreshPending = true;
        return;
      }
      isRefreshing = true;
      const run = async () => {
        try {
          await optionsRef.current.onChange();
        } catch {
          /* The page keeps what it shows; the next event tries again. */
        } finally {
          isRefreshing = false;
          if (isRefreshPending) {
            isRefreshPending = false;
            requestRefresh();
          }
        }
      };
      void run();
    };

    runProjectWatch({
      watchProjects,
      ids: [projectId],
      signal: controller.signal,
      onEvent: (event) => {
        if (event.id !== projectId || controller.signal.aborted) return;
        if (event.action === ProjectWatchAction.Delete) {
          isRefreshPending = false;
          controller.abort();
          optionsRef.current.onDelete();
          return;
        }
        if (event.etag != null && event.etag === optionsRef.current.etag) {
          return;
        }
        requestRefresh();
      },
      onReconnected: requestRefresh,
      onUnavailable: () => {
        unavailableProjectIdRef.current = projectId;
      },
    });
    return () => controller.abort();
  }, [watchProjects, projectId, isLoaded]);
};
