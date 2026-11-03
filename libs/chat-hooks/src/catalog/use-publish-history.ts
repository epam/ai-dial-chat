import type { PublishHistoryEntry } from '@epam/ai-dial-publish-panel';
import { useEffect, useRef, useState } from 'react';

const EMPTY_HISTORY: PublishHistoryEntry[] = [];

/** Host inputs of {@link usePublishHistory}. */
export interface UsePublishHistoryOptions {
  /** Whether the publish panel is open; the history is read each time it opens. */
  isOpen: boolean;
  /** Id of the entity being published; a change reads its history again. */
  entityId: string;
  /** Reads the entity's publication history, already mapped to the panel's entries; the host owns the request. */
  loadHistory: (entityId: string) => Promise<PublishHistoryEntry[]>;
}

interface LoadedHistory {
  /** The entity the entries belong to. */
  entityId: string;
  /** Its publication history. */
  entries: PublishHistoryEntry[];
}

/**
 * Returns the publication history of an entity for a publish panel, read again
 * on every open so a publication requested since the last one already blocks its
 * folder. A failed read leaves the history empty (the backend still refuses a
 * duplicate publication), a read that finishes after the panel closed or the
 * entity changed is ignored, and another entity's history is never returned.
 */
export const usePublishHistory = ({
  isOpen,
  entityId,
  loadHistory,
}: UsePublishHistoryOptions): PublishHistoryEntry[] => {
  const [loaded, setLoaded] = useState<LoadedHistory | undefined>();
  /* The host may pass a new function each render; only an open or an entity change reads. */
  const loadHistoryRef = useRef(loadHistory);
  useEffect(() => {
    loadHistoryRef.current = loadHistory;
  }, [loadHistory]);

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;
    const load = async () => {
      let entries = EMPTY_HISTORY;
      try {
        entries = await loadHistoryRef.current(entityId);
      } catch {
        /* Left empty: the backend still refuses a duplicate publication. */
      }
      if (!isCancelled) setLoaded({ entityId, entries });
    };
    void load();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, entityId]);

  return loaded?.entityId === entityId ? loaded.entries : EMPTY_HISTORY;
};
