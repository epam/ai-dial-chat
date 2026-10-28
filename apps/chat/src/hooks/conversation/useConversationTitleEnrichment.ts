import type { ConversationListItemDto } from '@epam/ai-dial-chat-api-client';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { getConversationTitles } from '../../server-api/conversations.api';

const TITLE_BATCH_SIZE = 25;
/* Another BFF pod can retain its prior title for five minutes, plus one
   in-flight title read. Local saves/opens take precedence during that window. */
const LOCAL_TITLE_PROTECTION_MS = 315_000;

interface KnownTitle {
  title: string;
  revision: number;
  isWriting?: boolean;
  protectedUntil?: number;
}

/** Resolves list titles without blocking the initial history response. */
export const useConversationTitleEnrichment = (
  userSub: string | undefined,
  setConversations: Dispatch<SetStateAction<ConversationListItemDto[]>>,
) => {
  const activeRequest = useRef<AbortController | null>(null);
  const knownTitles = useRef(new Map<string, KnownTitle>());
  const titleRevisions = useRef(new Map<string, number>());
  const deletedAtRevisions = useRef(new Map<string, number>());
  const pendingDeletions = useRef(new Set<string>());
  const revision = useRef(0);
  const [isUpdatingTitles, setIsUpdatingTitles] = useState(false);

  useLayoutEffect(() => {
    knownTitles.current.clear();
    titleRevisions.current.clear();
    deletedAtRevisions.current.clear();
    pendingDeletions.current.clear();
    revision.current = 0;
    setIsUpdatingTitles(false);
    return () => {
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [userSub]);

  const getTitleRevision = useCallback(() => revision.current, []);

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
          options.protect === false
            ? undefined
            : Date.now() + LOCAL_TITLE_PROTECTION_MS,
      });
    },
    [],
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
    (items: ConversationListItemDto[], requestedAtRevision: number) => {
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
            (known.protectedUntil ?? 0) > Date.now() ||
            known.revision > requestedAtRevision)
        ) {
          return {
            ...item,
            title: known.title,
            ...((known.protectedUntil ?? 0) > Date.now() ||
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
                  Date.now() &&
                (titleRevisions.current.get(item.id) ?? 0) <=
                  requestedAtRevision,
            )
            .map((item) => item.id),
        ),
      ];
      const revisions = new Map(
        pendingIds.map((id) => [id, titleRevisions.current.get(id) ?? 0]),
      );
      setIsUpdatingTitles(pendingIds.length > 0);

      const enrich = async () => {
        for (
          let offset = 0;
          offset < pendingIds.length;
          offset += TITLE_BATCH_SIZE
        ) {
          if (controller.signal.aborted) return;
          const ids = pendingIds
            .slice(offset, offset + TITLE_BATCH_SIZE)
            .filter(
              (id) =>
                revisions.get(id) === (titleRevisions.current.get(id) ?? 0),
            );
          if (ids.length === 0) continue;
          try {
            const result = await getConversationTitles(ids, controller.signal);
            if (activeRequest.current !== controller) return;
            const titles = new Map(
              result.items
                .filter(
                  ({ id }) =>
                    ids.includes(id) &&
                    revisions.get(id) === (titleRevisions.current.get(id) ?? 0),
                )
                .map(({ id, title }) => [id, title]),
            );
            if (titles.size === 0) continue;
            titles.forEach((title, id) => {
              knownTitles.current.set(id, {
                title,
                revision: titleRevisions.current.get(id) ?? 0,
              });
            });
            setConversations((current) => {
              if (activeRequest.current !== controller) return current;
              let changed = false;
              const next = current.map((item) => {
                const title = titles.get(item.id);
                if (
                  title !== undefined &&
                  revisions.get(item.id) ===
                    (titleRevisions.current.get(item.id) ?? 0) &&
                  (item.title !== title || item.isTitlePending)
                ) {
                  changed = true;
                  return { ...item, title, isTitlePending: false };
                }
                return item;
              });
              return changed ? next : current;
            });
          } catch {
            /* Keep usable filename/cached titles. A later list refresh can
               retry failures. Stop this attempt, including on authentication
               errors, instead of sending every remaining batch into an outage. */
            break;
          }
        }
        if (activeRequest.current === controller) {
          setIsUpdatingTitles(false);
        }
      };
      void enrich();
    },
    [setConversations],
  );

  return {
    applyConversationList,
    getTitleRevision,
    rememberTitle,
    forgetTitle,
    restoreTitle,
    isUpdatingTitles,
  };
};
