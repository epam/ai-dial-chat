import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

/** Completion outcome of one incremental request. */
export enum ConversationTitleRequestEnd {
  Complete = 'complete',
  Budget = 'budget',
  Unsupported = 'unsupported',
  Stopped = 'stopped',
}
/** Minimal list row required for title reconciliation. */
export interface ConversationTitleItem {
  /** Exact resource identity. */
  id: string;
  /** Current display title. */
  title: string;
  /** Whether the title still needs enrichment. */
  isTitlePending?: boolean;
}
/** Outcome of an incremental transport call. */
export interface ConversationTitleTransportResult {
  /** Completion or fallback outcome. */
  end: ConversationTitleRequestEnd;
  /** IDs with a terminal outcome, including missing titles. */
  settledIds: readonly string[];
}
/** Host transports and scheduling policies. Keep this object stable. */
export interface ConversationTitleEnrichmentOptions {
  /** Fetches one JSON batch. */
  getTitles: (
    ids: string[],
    signal: AbortSignal,
  ) => Promise<{ items: { id: string; title: string }[] }>;
  /** Optional incremental transport; omitted for JSON-only hosts. */
  streamTitles?: (
    ids: string[],
    signal: AbortSignal,
    onTitle: (id: string, title: string) => void,
  ) => Promise<ConversationTitleTransportResult>;
  /** Maximum IDs in each JSON batch; must be positive. */
  batchSize: number;
  /** Maximum IDs in each incremental request; must be positive. */
  maxIds: number;
  /** Maximum encoded JSON-array bytes per incremental request. */
  maxBytes: number;
  /** Maximum delay before buffered titles flush. */
  flushMs: number;
  /** Maximum buffered title count; must be positive. */
  maxPendingUpdates: number;
  /** Duration for which local writes override remote snapshots. */
  protectionMs: number;
  /** Clock for local protection; defaults to Date.now. */
  now?: () => number;
}

const encoder = new TextEncoder();

/** The leading IDs that fit one stream request's count and byte bounds. */
const takeTitleStreamRequest = (
  ids: string[],
  maxIds: number,
  maxBytes: number,
): string[] => {
  let bytes = 2;
  const request: string[] = [];
  for (const id of ids) {
    if (request.length >= maxIds) break;
    const idBytes =
      encoder.encode(JSON.stringify(id)).length + (request.length ? 1 : 0);
    if (bytes + idBytes > maxBytes) break;
    bytes += idBytes;
    request.push(id);
  }
  return request;
};

/* Resolves after one animation frame, the configured delay, or on abort: the
   window a freshly rendered list gets to report its viewport. */
const waitForViewportReport = (signal: AbortSignal, flushMs: number) =>
  new Promise<void>((resolve) => {
    const done = () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timerId);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const frameId = requestAnimationFrame(done);
    const timerId = setTimeout(done, flushMs);
    signal.addEventListener('abort', done, { once: true });
  });

/** `ids` with the currently visible ones first, in viewport order. */
const prioritizeVisible = (
  ids: string[],
  registrations: Map<string, string[]>,
): string[] => {
  const pending = new Set(ids);
  const visible = new Set<string>();
  for (const viewIds of registrations.values()) {
    for (const id of viewIds) if (pending.has(id)) visible.add(id);
  }
  if (visible.size === 0) return ids;
  return [...visible, ...ids.filter((id) => !visible.has(id))];
};

interface KnownTitle {
  title: string;
  revision: number;
  isWriting?: boolean;
  protectedUntil?: number;
}

/** Resolves list titles without blocking the initial history response. */
export const useConversationTitleEnrichmentController = <
  T extends ConversationTitleItem,
>(
  identityScope: unknown,
  setConversations: Dispatch<SetStateAction<T[]>>,
  options: ConversationTitleEnrichmentOptions,
) => {
  const {
    getTitles,
    streamTitles,
    batchSize,
    maxIds,
    maxBytes,
    flushMs,
    maxPendingUpdates,
    protectionMs,
    now = Date.now,
  } = options;
  const activeRequest = useRef<AbortController | null>(null);
  const knownTitles = useRef(new Map<string, KnownTitle>());
  const titleRevisions = useRef(new Map<string, number>());
  const deletedAtRevisions = useRef(new Map<string, number>());
  const pendingDeletions = useRef(new Set<string>());
  const revision = useRef(0);
  const titleTransport = useRef(Boolean(streamTitles));
  /* Visible IDs per mounted history view; sampled when a request is formed. */
  const visibleIdRegistrations = useRef(new Map<string, string[]>());
  const [isUpdatingTitles, setIsUpdatingTitles] = useState(false);

  useLayoutEffect(() => {
    knownTitles.current.clear();
    titleRevisions.current.clear();
    deletedAtRevisions.current.clear();
    pendingDeletions.current.clear();
    revision.current = 0;
    visibleIdRegistrations.current.clear();
    titleTransport.current = Boolean(streamTitles);
    setIsUpdatingTitles(false);
    return () => {
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [identityScope, streamTitles]);

  const getTitleRevision = useCallback(() => revision.current, []);

  /** Registers the IDs a history view shows; `null` clears that view only. */
  const setVisibleConversationIds = useCallback(
    (viewKey: string, ids: string[] | null) => {
      if (ids) visibleIdRegistrations.current.set(viewKey, ids);
      else visibleIdRegistrations.current.delete(viewKey);
    },
    [],
  );

  const rememberTitle = useCallback(
    (
      id: string,
      title: string,
      options: { isWriting?: boolean; protect?: boolean } = {},
    ) => {
      const nextRevision = ++revision.current;
      titleRevisions.current.set(id, nextRevision);
      knownTitles.current.set(id, {
        title,
        revision: nextRevision,
        isWriting: options.isWriting,
        protectedUntil:
          options.protect === false ? undefined : now() + protectionMs,
      });
    },
    [now, protectionMs],
  );

  const forgetTitle = useCallback((id: string, isPending = false) => {
    const deletedAt = ++revision.current;
    titleRevisions.current.set(id, deletedAt);
    deletedAtRevisions.current.set(id, deletedAt);
    if (isPending) pendingDeletions.current.add(id);
    else pendingDeletions.current.delete(id);
    knownTitles.current.delete(id);
  }, []);

  const restoreTitle = useCallback(
    (id: string, title: string) => {
      deletedAtRevisions.current.delete(id);
      pendingDeletions.current.delete(id);
      rememberTitle(id, title, { protect: false });
    },
    [rememberTitle],
  );

  const applyConversationList = useCallback(
    (items: T[], requestedAtRevision: number) => {
      activeRequest.current?.abort();
      const controller = new AbortController();
      activeRequest.current = controller;
      /* A list requested before a local deletion must not resurrect its row.
         Keep tombstones across older snapshots; a later request supersedes them. */
      const visibleItems = items.filter(
        ({ id }) =>
          !pendingDeletions.current.has(id) &&
          (deletedAtRevisions.current.get(id) ?? 0) <= requestedAtRevision,
      );
      for (const [id, deletedAt] of deletedAtRevisions.current) {
        if (
          deletedAt <= requestedAtRevision &&
          !pendingDeletions.current.has(id)
        )
          deletedAtRevisions.current.delete(id);
      }
      const currentIds = new Set(visibleItems.map(({ id }) => id));
      for (const id of knownTitles.current.keys()) {
        if (!currentIds.has(id)) knownTitles.current.delete(id);
      }
      for (const id of titleRevisions.current.keys()) {
        if (!currentIds.has(id) && !deletedAtRevisions.current.has(id))
          titleRevisions.current.delete(id);
      }
      const nextItems = visibleItems.map((item) => {
        const known = knownTitles.current.get(item.id);
        if (
          known &&
          (item.isTitlePending ||
            known.isWriting ||
            (known.protectedUntil ?? 0) > now() ||
            known.revision > requestedAtRevision)
        ) {
          return {
            ...item,
            title: known.title,
            ...((known.protectedUntil ?? 0) > now() ||
            known.isWriting ||
            known.revision > requestedAtRevision
              ? { isTitlePending: false }
              : {}),
          };
        }
        if (!item.isTitlePending) {
          knownTitles.current.set(item.id, {
            title: item.title,
            revision: titleRevisions.current.get(item.id) ?? 0,
          });
        }
        return item;
      });
      setConversations(nextItems);

      /* The list is already newest-first. Preserve its exact resource IDs:
         decoding them here could conflate distinct storage names. */
      const pendingIds = [
        ...new Set(
          visibleItems
            .filter(
              (item) =>
                item.isTitlePending &&
                !knownTitles.current.get(item.id)?.isWriting &&
                (knownTitles.current.get(item.id)?.protectedUntil ?? 0) <=
                  now() &&
                (titleRevisions.current.get(item.id) ?? 0) <=
                  requestedAtRevision,
            )
            .map((item) => item.id),
        ),
      ];
      const revisions = new Map(
        pendingIds.map((id) => [id, titleRevisions.current.get(id) ?? 0]),
      );
      const isCurrent = (id: string) =>
        revisions.get(id) === (titleRevisions.current.get(id) ?? 0);
      const isActive = () =>
        activeRequest.current === controller && !controller.signal.aborted;
      setIsUpdatingTitles(pendingIds.length > 0);

      /* Titles wait here for at most one frame, so a burst of stream events
         renders once instead of once per network fragment. */
      const pendingTitles = new Map<string, string>();
      let frameId: number | undefined;
      let timerId: ReturnType<typeof setTimeout> | undefined;
      const flushTitles = () => {
        if (frameId !== undefined) cancelAnimationFrame(frameId);
        clearTimeout(timerId);
        frameId = undefined;
        timerId = undefined;
        if (pendingTitles.size === 0) return;
        const titles = new Map(
          [...pendingTitles].filter(([id]) => isCurrent(id)),
        );
        pendingTitles.clear();
        if (!isActive() || titles.size === 0) return;
        titles.forEach((title, id) => {
          knownTitles.current.set(id, {
            title,
            revision: titleRevisions.current.get(id) ?? 0,
          });
        });
        setConversations((current) => {
          if (!isActive()) return current;
          let changed = false;
          const next = current.map((item) => {
            const title = titles.get(item.id);
            if (
              title !== undefined &&
              isCurrent(item.id) &&
              (item.title !== title || item.isTitlePending)
            ) {
              changed = true;
              return { ...item, title, isTitlePending: false };
            }
            return item;
          });
          return changed ? next : current;
        });
      };
      controller.signal.addEventListener('abort', flushTitles, { once: true });
      const acceptTitle = (id: string, title: string) => {
        if (!isActive() || !isCurrent(id)) return;
        pendingTitles.set(id, title);
        if (pendingTitles.size >= maxPendingUpdates) {
          flushTitles();
          return;
        }
        if (timerId !== undefined) return;
        frameId = requestAnimationFrame(flushTitles);
        timerId = setTimeout(flushTitles, flushMs);
      };

      const enrichWithJson = async (ids: string[]) => {
        for (let offset = 0; offset < ids.length; offset += batchSize) {
          if (!isActive()) return;
          const batch = ids.slice(offset, offset + batchSize).filter(isCurrent);
          if (batch.length === 0) continue;
          try {
            const result = await getTitles(batch, controller.signal);
            if (!isActive()) return;
            for (const { id, title } of result.items) {
              if (batch.includes(id)) acceptTitle(id, title);
            }
            flushTitles();
          } catch {
            /* Keep usable filename/cached titles. A later list refresh can
               retry failures. Stop this attempt, including on authentication
               errors, instead of sending every remaining batch into an outage. */
            return;
          }
        }
      };

      const streamRequest = async (
        ids: string[],
        settled: Set<string>,
      ): Promise<ConversationTitleRequestEnd> => {
        if (!streamTitles) return ConversationTitleRequestEnd.Unsupported;
        try {
          const requested = new Set(ids);
          const result = await streamTitles(
            ids,
            controller.signal,
            (id, title) => {
              if (isActive() && requested.has(id)) acceptTitle(id, title);
            },
          );
          if (!isActive()) return ConversationTitleRequestEnd.Stopped;
          for (const id of result.settledIds)
            if (requested.has(id)) settled.add(id);
          return result.end;
        } catch {
          return ConversationTitleRequestEnd.Stopped;
        }
      };

      const enrich = async () => {
        let unattempted = pendingIds;
        try {
          if (unattempted.length > 0) {
            await waitForViewportReport(controller.signal, flushMs);
          }
          while (unattempted.length > 0 && isActive()) {
            /* Priority is sampled per request; scrolling never restarts one. */
            unattempted = prioritizeVisible(
              unattempted.filter(isCurrent),
              visibleIdRegistrations.current,
            );
            if (titleTransport.current === false) {
              await enrichWithJson(unattempted);
              return;
            }
            const ids = takeTitleStreamRequest(unattempted, maxIds, maxBytes);
            if (ids.length === 0) return;
            const settled = new Set<string>();
            const end = await streamRequest(ids, settled);
            if (end === ConversationTitleRequestEnd.Unsupported) {
              if (activeRequest.current === controller) {
                titleTransport.current = false;
              }
              continue;
            }
            unattempted = unattempted.filter((id) => !settled.has(id));
            if (end === ConversationTitleRequestEnd.Stopped) return;
            /* A budget that settled nothing would only loop. */
            if (settled.size === 0) {
              return;
            }
          }
        } finally {
          flushTitles();
          if (activeRequest.current === controller) {
            setIsUpdatingTitles(false);
          }
        }
      };
      void enrich();
    },
    [
      setConversations,
      getTitles,
      streamTitles,
      batchSize,
      maxIds,
      maxBytes,
      flushMs,
      maxPendingUpdates,
      now,
    ],
  );

  return {
    applyConversationList,
    getTitleRevision,
    rememberTitle,
    forgetTitle,
    restoreTitle,
    setVisibleConversationIds,
    isUpdatingTitles,
  };
};
