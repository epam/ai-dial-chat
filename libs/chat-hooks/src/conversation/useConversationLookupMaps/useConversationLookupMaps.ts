import type { ConversationListItemDto } from '@epam/ai-dial-chat-api-client';
import { useMemo } from 'react';

/** Parameters for `useConversationLookupMaps`. */
export interface UseConversationLookupMapsParams {
  /** Raw conversation list from the API. */
  items: ConversationListItemDto[];
  /** Converts a raw conversation id to the panel-space id. App-specific. */
  toPanelConversationId: (id: string) => string;
}

/** Stable reverse-lookup maps returned by `useConversationLookupMaps`. */
export interface ConversationLookupMaps {
  /** Returns the raw context id for a panel-space conversation id, or `undefined` when not found. */
  toContextId: (panelId: string) => string | undefined;
  /** Returns the raw `ConversationListItemDto` for a panel-space conversation id, or `undefined` when not found. */
  getRawItem: (panelId: string) => ConversationListItemDto | undefined;
}

/**
 * Builds two memoised reverse-lookup maps from the raw conversation list:
 * panel-space id → context id and panel-space id → raw DTO.
 *
 * Replaces the inlined `panelToContextId` map and `items.find` calls that
 * previously appeared at each row-action call site in `ConversationPanelView`.
 */
export const useConversationLookupMaps = ({
  items,
  toPanelConversationId,
}: UseConversationLookupMapsParams): ConversationLookupMaps =>
  useMemo(() => {
    const panelToContextId = new Map(
      items.map((item) => [toPanelConversationId(item.id), item.id]),
    );
    const panelToRawItem = new Map(
      items.map((item) => [toPanelConversationId(item.id), item]),
    );

    return {
      toContextId: (panelId: string) => panelToContextId.get(panelId),
      getRawItem: (panelId: string) => panelToRawItem.get(panelId),
    };
  }, [items, toPanelConversationId]);
