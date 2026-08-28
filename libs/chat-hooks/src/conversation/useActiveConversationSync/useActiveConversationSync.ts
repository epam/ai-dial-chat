import type { ConversationListItemDto } from '@epam/ai-dial-chat-api-client';
import { useEffect, useMemo } from 'react';

/** Parameters for `useActiveConversationSync`. */
export interface UseActiveConversationSyncParams {
  /**
   * The raw context id of the currently active conversation, as tracked by
   * the host app. `undefined` when no conversation is active.
   */
  activeConversationId: string | undefined;
  /** Raw conversation list from the API. */
  items: ConversationListItemDto[];
  /** Refetches the full conversation list. */
  refreshConversations: () => Promise<void>;
  /** Marks a scheduler-created conversation as viewed by raw context id. */
  markConversationViewed: (id: string) => Promise<void>;
  /**
   * Returns `true` when two ids refer to the same conversation despite
   * possible encoding differences. App-specific.
   */
  conversationIdsMatch: (a: string, b: string) => boolean;
  /** Converts a raw context id to the panel-space id. App-specific. */
  toPanelConversationId: (id: string) => string;
}

/**
 * Synchronises the active conversation with the conversation list and returns
 * the panel-space id of the active conversation, or `undefined` when none is active.
 *
 * Side effects:
 * 1. If the active conversation is not present in the list, requests a
 *    refresh. The list and refresh callback are intentionally excluded from
 *    the dependency array to avoid a refresh-loop on every list update.
 * 2. Marks the active conversation as viewed whenever it or the list changes.
 */
export const useActiveConversationSync = ({
  activeConversationId,
  items,
  refreshConversations,
  markConversationViewed,
  conversationIdsMatch,
  toPanelConversationId,
}: UseActiveConversationSyncParams): string | undefined => {
  const panelActiveConversationId = useMemo(
    () =>
      activeConversationId
        ? toPanelConversationId(activeConversationId)
        : undefined,
    [activeConversationId, toPanelConversationId],
  );

  /* Effect 1: refresh if the active conversation is missing from the list. */
  useEffect(() => {
    if (!panelActiveConversationId) return;
    const isListed = items.some((item) =>
      conversationIdsMatch(item.id, panelActiveConversationId),
    );
    if (!isListed) void refreshConversations();
    // Intentionally not including items or refreshConversations in the
    // dependency array to avoid re-triggering on every list update.
  }, [panelActiveConversationId, conversationIdsMatch]); // eslint-disable-line react-hooks/exhaustive-deps

  /*
   * Effect 2: single shared entry point for marking a scheduler-created
   * conversation as viewed -- fires whenever the active conversation changes,
   * whether the user navigated by clicking a history panel row or via direct
   * URL navigation. markConversationViewed itself no-ops for non-scheduler
   * or already-read items.
   */
  useEffect(() => {
    if (!panelActiveConversationId) return;
    const activeItem = items.find((item) =>
      conversationIdsMatch(item.id, panelActiveConversationId),
    );
    if (activeItem) void markConversationViewed(activeItem.id);
  }, [
    panelActiveConversationId,
    items,
    markConversationViewed,
    conversationIdsMatch,
  ]);

  return panelActiveConversationId;
};
