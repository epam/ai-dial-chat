import type { DragEvent } from 'react';
import type { ConversationHistoryItem } from '../models/ConversationPanel';
import type { VirtualRow } from '../models/virtual-row';
import { ConversationGroupKey } from '../types/conversation-group-key';
import { ConversationSource } from '../types/conversation-source';
import { VirtualRowKind } from '../types/virtual-row';

/** Maps a `ConversationSource` to its corresponding `ConversationGroupKey`. */
export const sourceToGroupKey = (
  source?: ConversationSource,
): ConversationGroupKey => {
  switch (source) {
    case ConversationSource.Shared:
      return ConversationGroupKey.Shared;
    case ConversationSource.Organization:
      return ConversationGroupKey.Organization;
    default:
      return ConversationGroupKey.MyChats;
  }
};

/** Returns the `ConversationGroupKey` of the virtual row containing the given item id. */
export const findGroupKeyForItem = (
  rows: VirtualRow[],
  id: string,
): ConversationGroupKey | null => {
  let currentGroupKey: ConversationGroupKey | null = null;
  for (const row of rows) {
    if (row.kind === VirtualRowKind.Header) {
      currentGroupKey = row.groupKey;
    } else if (row.item.id === id) {
      return currentGroupKey;
    }
  }
  return null;
};

/**
 * Returns the set of groups that are valid drop targets for the given dragged item.
 *
 * Rules:
 * - Same group as the drag source is always allowed (reorder).
 * - Any non-Pinned group → Pinned is allowed (pin action).
 * - Pinned → non-Pinned is allowed only when the item's `source` matches the target group (unpin action).
 */
export const computeAllowedDropGroups = (
  draggedId: string,
  draggingGroupKey: ConversationGroupKey | null,
  conversations: ConversationHistoryItem[],
): Set<ConversationGroupKey> => {
  const allowed = new Set<ConversationGroupKey>();

  if (draggingGroupKey != null) {
    allowed.add(draggingGroupKey);
  }

  if (draggingGroupKey === ConversationGroupKey.Pinned) {
    const item = conversations.find((c) => c.id === draggedId);
    if (item) {
      allowed.add(sourceToGroupKey(item.source));
    }
  } else {
    allowed.add(ConversationGroupKey.Pinned);
  }

  return allowed;
};

/**
 * Computes the `afterId` for a drop based on cursor vertical position within a row.
 *
 * - Bottom half of the row → insert after the item (`afterId = itemId`).
 * - Top half → insert before the item (`afterId` = id of the preceding item in the group, or `null` for first).
 */
export const getDropAfterId = (
  e: Pick<DragEvent, 'currentTarget' | 'clientY'>,
  itemId: string,
  rows: VirtualRow[],
  targetGroupKey: ConversationGroupKey,
): string | null => {
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const isBottomHalf = e.clientY >= rect.top + rect.height / 2;

  if (isBottomHalf) return itemId;

  let prevItemId: string | null = null;
  let inGroup = false;
  for (const row of rows) {
    if (row.kind === VirtualRowKind.Header) {
      inGroup = row.groupKey === targetGroupKey;
    } else if (inGroup) {
      if (row.item.id === itemId) return prevItemId;
      prevItemId = row.item.id;
    }
  }
  return null;
};
