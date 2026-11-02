import { useCallback, useEffect, useId, useRef } from 'react';

/** Parameters of `useVisibleConversationIdsReporter`. */
export interface UseVisibleConversationIdsReporterParams {
  /** Conversations the view lists, by their list resource id. */
  items: readonly { id: string }[];
  /** Whether the view is shown; a hidden view reports `null` but keeps its last ids. */
  isVisible: boolean;
  /** Maps a list resource id to the id the rendered panel reports. */
  toPanelConversationId: (id: string) => string;
  /** Registers this view's visible list ids, or `null` to withdraw them; usually from `useConversationTitleEnrichmentController`. */
  setVisibleConversationIds: (viewKey: string, ids: string[] | null) => void;
}

/*
 * The list reports panel ids; the enrichment controller schedules by list
 * resource ids. A hidden view keeps its last report so reopening restores
 * priority without waiting for a scroll.
 */
/** Returns the panel's visible-ids callback, which registers the matching list ids under this view while it is visible. */
export const useVisibleConversationIdsReporter = ({
  items,
  isVisible,
  toPanelConversationId,
  setVisibleConversationIds,
}: UseVisibleConversationIdsReporterParams): ((panelIds: string[]) => void) => {
  const visibilityKey = useId();
  const panelIdToConversationIdRef = useRef(new Map<string, string>());
  useEffect(() => {
    panelIdToConversationIdRef.current = new Map(
      items.map((item) => [toPanelConversationId(item.id), item.id]),
    );
  }, [items, toPanelConversationId]);
  const lastVisibleIdsRef = useRef<string[]>([]);
  const isVisibleRef = useRef(isVisible);
  const registerVisibleIds = useCallback(() => {
    setVisibleConversationIds(
      visibilityKey,
      isVisibleRef.current ? lastVisibleIdsRef.current : null,
    );
  }, [setVisibleConversationIds, visibilityKey]);
  const handleVisibleConversationIdsChange = useCallback(
    (panelIds: string[]) => {
      lastVisibleIdsRef.current = panelIds.flatMap((panelId) => {
        const id = panelIdToConversationIdRef.current.get(panelId);
        return id ? [id] : [];
      });
      registerVisibleIds();
    },
    [registerVisibleIds],
  );
  useEffect(() => {
    isVisibleRef.current = isVisible;
    registerVisibleIds();
  }, [isVisible, registerVisibleIds]);
  useEffect(
    () => () => setVisibleConversationIds(visibilityKey, null),
    [setVisibleConversationIds, visibilityKey],
  );

  return handleVisibleConversationIdsChange;
};
