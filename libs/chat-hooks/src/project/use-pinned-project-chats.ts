import {
  ProjectWatchAction,
  type ProjectConversationItemDto,
  type ProjectDetailsDto,
} from '@epam/ai-dial-chat-api-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getApiErrorStatus } from '../api-error/api-error';
import { applyViewedMark, type ViewedMarks } from './project-viewed-marks';
import { runProjectWatch } from './project-watch-stream';
import type { ProjectsApiClient } from './projects-api-client';

/** Most chats listed under one pinned project. */
export const PINNED_PROJECT_CHATS_LIMIT = 10;

/* Most project ids one watch subscribes to; the same bound the BFF enforces. */
const PROJECTS_WATCH_MAX_IDS = 1000;

/* Delays before each retry of a first load that failed with anything but a `404`. */
const LOAD_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000];

/* Project ids are path-like and never contain a newline. */
const IDS_KEY_SEPARATOR = '\n';

/** What `usePinnedProjectChats` needs from the host besides the ids. */
export interface PinnedProjectChatsOptions {
  /** No request is sent and `projects` is empty while `false`. */
  enabled: boolean;
  /** The project no longer exists (a watch `DELETE`, or `404` on a read). Called at most once per id. */
  onProjectDeleted: (projectId: string) => void;
}

/** A chat listed under a pinned project. */
export interface PinnedProjectChat {
  /** The conversation's DIAL id. */
  id: string;
  /** Display title; the file-name title when its body could not be read. */
  title: string;
  /** The caller has not seen the conversation's current version. */
  isUnread?: boolean;
}

/** A loaded pinned project and its newest chats. */
export interface PinnedProjectChats {
  /** The project's details as last read; `canEdit`, `canManage`, `contentVersion` and `conversationCount` feed the host's actions. */
  project: ProjectDetailsDto;
  /** At most `PINNED_PROJECT_CHATS_LIMIT` chats, newest first. */
  chats: PinnedProjectChat[];
  /** The project has more chats than `chats` holds. */
  hasMore: boolean;
}

/** What `usePinnedProjectChats` returns. */
export interface PinnedProjectChatsResult {
  /** Loaded projects, in `projectIds` order; an id whose load failed is absent while it is retried. */
  projects: PinnedProjectChats[];
  /** True until every id of the current `projectIds` settled once. */
  isLoading: boolean;
  /** Clears a chat's unread state locally until a read reports a newer version. Sends no request. */
  markViewed: (conversationId: string) => void;
  /** Silently re-reads one loaded project, through the same per-project gate as a watch event. */
  refresh: (projectId: string) => void;
}

interface PinnedProjectsState {
  /** Loaded projects by id. */
  snapshots: Map<string, PinnedProjectChats>;
  /** Ids whose first load settled, loaded or not. */
  settled: Set<string>;
  /** Sorted, joined ids of the loaded projects the watch follows; it moves to a new set only once that whole set settled. */
  watchKey: string;
}

/* A project as read, before the viewed marks apply. */
interface FetchedProject {
  project: ProjectDetailsDto;
  /** The kept listing items, titles resolved where possible. */
  items: ProjectConversationItemDto[];
  hasMore: boolean;
}

/* One silent refresh in flight per project; events during it collapse into one trailing run. */
interface RefreshGate {
  isRefreshing: boolean;
  isPending: boolean;
  controller?: AbortController;
}

const EMPTY_STATE: PinnedProjectsState = {
  snapshots: new Map(),
  settled: new Set(),
  watchKey: '',
};

const NO_PROJECTS: PinnedProjectChats[] = [];

/*
 * The watch key of the loaded ids of `tracked` once every id of it settled, or
 * `fallback` while one is still loading, so the open stream keeps following
 * the loaded projects until the new set can replace it. An id without a
 * snapshot stays out: the BFF rejects the whole watch when one project is not
 * readable.
 */
const toWatchKey = (
  tracked: Set<string>,
  { settled, snapshots }: Pick<PinnedProjectsState, 'settled' | 'snapshots'>,
  fallback: string,
): string => {
  const ids = [...tracked].sort();
  if (!ids.every((id) => settled.has(id))) return fallback;
  return ids
    .filter((id) => snapshots.has(id))
    .slice(0, PROJECTS_WATCH_MAX_IDS)
    .join(IDS_KEY_SEPARATOR);
};

const withoutProject = (
  state: PinnedProjectsState,
  id: string,
): PinnedProjectsState => {
  if (!state.snapshots.has(id) && !state.settled.has(id)) return state;
  const snapshots = new Map(state.snapshots);
  snapshots.delete(id);
  const settled = new Set(state.settled);
  settled.delete(id);
  return { ...state, snapshots, settled };
};

/* Replaces the kept items whose titles were resolved, keeping every other item. */
const mergeTitles = (
  items: ProjectConversationItemDto[],
  resolved: ProjectConversationItemDto[],
): ProjectConversationItemDto[] => {
  if (resolved.length === 0) return items;
  const byId = new Map(resolved.map((item) => [item.id, item]));
  return items.map((item) => {
    const match = byId.get(item.id);
    return match
      ? { ...item, title: match.title, isTitlePending: false }
      : item;
  });
};

/**
 * Loads each pinned project's details and newest chats through the injected
 * client, and keeps them current with one watch stream over every pinned
 * project. A changed project is refreshed silently, one refresh at a time per
 * project plus one trailing run; a deleted one is dropped and reported. A
 * first load that fails with anything but a `404` is retried with a bounded
 * backoff, and the project stays out of the watch until it loads. A dropped
 * stream is reopened with a bounded backoff and followed by a refresh of every
 * project; a watch that cannot be opened is not retried for the same projects.
 * Requests are aborted on unmount, when `enabled` turns false, and for an id
 * that leaves `projectIds`.
 *
 * @param client - Configured project requests, from `createProjectsApiClient`; it must be referentially stable, because a new object reloads.
 * @param projectIds - The pinned project ids, in display order.
 * @param options - Whether the tree is enabled and the delete callback; the callback is read at event time, so a new identity never resubscribes.
 */
export const usePinnedProjectChats = (
  client: Pick<
    ProjectsApiClient,
    | 'getProject'
    | 'listProjectConversations'
    | 'getProjectConversationTitles'
    | 'watchProjects'
  >,
  projectIds: string[],
  { enabled, onProjectDeleted }: PinnedProjectChatsOptions,
): PinnedProjectChatsResult => {
  const [state, setState] = useState<PinnedProjectsState>(EMPTY_STATE);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });
  const onProjectDeletedRef = useRef(onProjectDeleted);
  useEffect(() => {
    onProjectDeletedRef.current = onProjectDeleted;
  });

  /* Ids with a load started for the current client; cleared on reset. */
  const trackedRef = useRef(new Set<string>());
  const loadControllersRef = useRef(new Map<string, AbortController>());
  const gatesRef = useRef(new Map<string, RefreshGate>());
  const deletedRef = useRef(new Set<string>());
  const viewedRef = useRef<ViewedMarks>(new Map());
  /* Conversation id → its `updatedAt` in the last listing, for a viewed mark. */
  const updatedAtRef = useRef(new Map<string, number | undefined>());
  /* The watch key whose stream could not be opened; a new set tries again. */
  const unavailableWatchKeyRef = useRef<string | null>(null);

  const idsKey = useMemo(
    () => [...new Set(projectIds)].sort().join(IDS_KEY_SEPARATOR),
    [projectIds],
  );

  /* Reads the project, its newest chats and their pending titles; rejects with the details' error. */
  const fetchSnapshot = useCallback(
    async (id: string, signal: AbortSignal): Promise<FetchedProject> => {
      const [details, listing] = await Promise.allSettled([
        client.getProject(id, signal),
        client.listProjectConversations(id, signal),
      ]);
      if (details.status === 'rejected') throw details.reason;
      const items = listing.status === 'fulfilled' ? listing.value.items : [];
      let kept = items.slice(0, PINNED_PROJECT_CHATS_LIMIT);
      const pendingNames = kept
        .filter((item) => item.isTitlePending)
        .map((item) => item.name);
      if (pendingNames.length > 0) {
        try {
          const { items: resolved } = await client.getProjectConversationTitles(
            id,
            pendingNames,
            signal,
          );
          kept = mergeTitles(kept, resolved);
        } catch {
          /* The file-name titles stay; the next refresh tries again. */
        }
      }
      return {
        project: details.value,
        items: kept,
        hasMore: items.length > PINNED_PROJECT_CHATS_LIMIT,
      };
    },
    [client],
  );

  /* Applies the viewed marks at settle time, so a mark set while the read was in flight wins. */
  const toSettledSnapshot = useCallback(
    ({ project, items, hasMore }: FetchedProject): PinnedProjectChats => {
      for (const { id, updatedAt } of items) {
        updatedAtRef.current.set(id, updatedAt);
      }
      return {
        project,
        hasMore,
        chats: items.map((item) => ({
          id: item.id,
          title: item.title,
          ...(applyViewedMark(viewedRef.current, item)
            ? { isUnread: true }
            : {}),
        })),
      };
    },
    [],
  );

  const reportDeleted = useCallback((id: string) => {
    if (deletedRef.current.has(id)) return;
    deletedRef.current.add(id);
    onProjectDeletedRef.current(id);
  }, []);

  const dropGate = useCallback((id: string) => {
    const gate = gatesRef.current.get(id);
    gate?.controller?.abort();
    gatesRef.current.delete(id);
  }, []);

  const dropProject = useCallback(
    (id: string) => {
      dropGate(id);
      setState((prev) => {
        if (!prev.snapshots.has(id)) return prev;
        const snapshots = new Map(prev.snapshots);
        snapshots.delete(id);
        return {
          ...prev,
          snapshots,
          watchKey: toWatchKey(
            trackedRef.current,
            { settled: prev.settled, snapshots },
            prev.watchKey,
          ),
        };
      });
    },
    [dropGate],
  );

  const requestRefresh = useCallback(
    (id: string) => {
      if (!stateRef.current.snapshots.has(id)) return;
      let gate = gatesRef.current.get(id);
      if (gate == null) {
        gate = { isRefreshing: false, isPending: false };
        gatesRef.current.set(id, gate);
      }
      if (gate.isRefreshing) {
        gate.isPending = true;
        return;
      }
      const currentGate = gate;
      const controller = new AbortController();
      currentGate.isRefreshing = true;
      currentGate.controller = controller;
      const run = async () => {
        try {
          const snapshot = await fetchSnapshot(id, controller.signal);
          if (controller.signal.aborted) return;
          const settled = toSettledSnapshot(snapshot);
          setState((prev) => {
            if (!prev.snapshots.has(id)) return prev;
            const snapshots = new Map(prev.snapshots);
            snapshots.set(id, settled);
            return { ...prev, snapshots };
          });
        } catch (error) {
          if (controller.signal.aborted) return;
          if (getApiErrorStatus(error) === 404) {
            dropProject(id);
            reportDeleted(id);
          }
          /* Any other failure keeps the previous snapshot. */
        } finally {
          currentGate.isRefreshing = false;
          if (
            currentGate.isPending &&
            !controller.signal.aborted &&
            gatesRef.current.get(id) === currentGate
          ) {
            currentGate.isPending = false;
            requestRefresh(id);
          }
        }
      };
      void run();
    },
    [dropProject, fetchSnapshot, reportDeleted, toSettledSnapshot],
  );

  /*
   * Runs the first load of `id` under `controller`, which stays registered
   * through every retry so that aborting it also cancels a pending one.
   */
  const loadProject = useCallback(
    (id: string, controller: AbortController, attempt = 0) => {
      const release = () => {
        if (loadControllersRef.current.get(id) === controller) {
          loadControllersRef.current.delete(id);
        }
      };
      const load = async () => {
        try {
          const snapshot = await fetchSnapshot(id, controller.signal);
          if (controller.signal.aborted) return;
          const settled = toSettledSnapshot(snapshot);
          setState((prev) => {
            const snapshots = new Map(prev.snapshots);
            snapshots.set(id, settled);
            const settledIds = new Set(prev.settled).add(id);
            return {
              snapshots,
              settled: settledIds,
              watchKey: toWatchKey(
                trackedRef.current,
                { settled: settledIds, snapshots },
                prev.watchKey,
              ),
            };
          });
          release();
        } catch (error) {
          if (controller.signal.aborted) return;
          setState((prev) => {
            if (prev.settled.has(id)) return prev;
            const settledIds = new Set(prev.settled).add(id);
            return {
              ...prev,
              settled: settledIds,
              watchKey: toWatchKey(
                trackedRef.current,
                { settled: settledIds, snapshots: prev.snapshots },
                prev.watchKey,
              ),
            };
          });
          const isNotFound = getApiErrorStatus(error) === 404;
          const delay = isNotFound ? undefined : LOAD_RETRY_DELAYS_MS[attempt];
          if (delay == null) {
            release();
            if (isNotFound) reportDeleted(id);
            return;
          }
          const timer = setTimeout(
            () => loadProject(id, controller, attempt + 1),
            delay,
          );
          controller.signal.addEventListener(
            'abort',
            () => clearTimeout(timer),
            { once: true },
          );
        }
      };
      void load();
    },
    [fetchSnapshot, reportDeleted, toSettledSnapshot],
  );

  /* Resets everything for a new client, a disabled tree and unmount. */
  useEffect(
    () => () => {
      for (const controller of loadControllersRef.current.values()) {
        controller.abort();
      }
      loadControllersRef.current.clear();
      for (const gate of gatesRef.current.values()) gate.controller?.abort();
      gatesRef.current.clear();
      trackedRef.current.clear();
      deletedRef.current.clear();
      viewedRef.current.clear();
      updatedAtRef.current.clear();
      setState(EMPTY_STATE);
    },
    [client, enabled],
  );

  /* Loads the ids that joined the set and drops the ones that left it. */
  useEffect(() => {
    if (!enabled) return;
    const wanted = new Set(
      idsKey === '' ? [] : idsKey.split(IDS_KEY_SEPARATOR),
    );
    for (const id of [...trackedRef.current]) {
      if (wanted.has(id)) continue;
      trackedRef.current.delete(id);
      deletedRef.current.delete(id);
      loadControllersRef.current.get(id)?.abort();
      loadControllersRef.current.delete(id);
      dropGate(id);
      setState((prev) => {
        const next = withoutProject(prev, id);
        return {
          ...next,
          watchKey: toWatchKey(trackedRef.current, next, prev.watchKey),
        };
      });
    }
    for (const id of wanted) {
      if (trackedRef.current.has(id)) continue;
      trackedRef.current.add(id);
      const controller = new AbortController();
      loadControllersRef.current.set(id, controller);
      loadProject(id, controller);
    }
  }, [enabled, idsKey, dropGate, loadProject]);

  const isLoading =
    enabled &&
    idsKey !== '' &&
    idsKey.split(IDS_KEY_SEPARATOR).some((id) => !state.settled.has(id));
  const watchKey = enabled ? state.watchKey : '';
  const { watchProjects } = client;

  useEffect(() => {
    if (
      watchProjects == null ||
      watchKey === '' ||
      watchKey === unavailableWatchKeyRef.current
    ) {
      return;
    }
    const controller = new AbortController();
    runProjectWatch({
      watchProjects,
      ids: watchKey.split(IDS_KEY_SEPARATOR),
      signal: controller.signal,
      onEvent: (event) => {
        if (controller.signal.aborted) return;
        const snapshot = stateRef.current.snapshots.get(event.id);
        if (snapshot == null) return;
        if (event.action === ProjectWatchAction.Delete) {
          dropProject(event.id);
          reportDeleted(event.id);
          return;
        }
        if (event.etag != null && event.etag === snapshot.project.etag) {
          return;
        }
        requestRefresh(event.id);
      },
      onReconnected: () => {
        for (const id of stateRef.current.snapshots.keys()) {
          requestRefresh(id);
        }
      },
      onUnavailable: () => {
        unavailableWatchKeyRef.current = watchKey;
      },
    });
    return () => controller.abort();
  }, [watchProjects, watchKey, dropProject, reportDeleted, requestRefresh]);

  const markViewed = useCallback((conversationId: string) => {
    if (!updatedAtRef.current.has(conversationId)) return;
    viewedRef.current.set(
      conversationId,
      updatedAtRef.current.get(conversationId),
    );
    setState((prev) => {
      let snapshots: Map<string, PinnedProjectChats> | undefined;
      for (const [id, snapshot] of prev.snapshots) {
        if (
          !snapshot.chats.some(
            (chat) => chat.id === conversationId && chat.isUnread,
          )
        ) {
          continue;
        }
        snapshots ??= new Map(prev.snapshots);
        snapshots.set(id, {
          ...snapshot,
          chats: snapshot.chats.map((chat) =>
            chat.id === conversationId
              ? { id: chat.id, title: chat.title }
              : chat,
          ),
        });
      }
      return snapshots ? { ...prev, snapshots } : prev;
    });
  }, []);

  const projects = useMemo(() => {
    if (!enabled) return NO_PROJECTS;
    const seen = new Set<string>();
    const ordered: PinnedProjectChats[] = [];
    for (const id of projectIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const snapshot = state.snapshots.get(id);
      if (snapshot) ordered.push(snapshot);
    }
    return ordered;
  }, [enabled, projectIds, state.snapshots]);

  return { projects, isLoading, markViewed, refresh: requestRefresh };
};
