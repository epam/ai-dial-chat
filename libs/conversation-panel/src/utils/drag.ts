import type { DragEvent } from 'react';
import type { ConversationItem } from '../models/panel-props';
import type { VirtualRow } from '../models/virtual-row';
import { FilterTab } from '../types/conversation-classification';
import { VirtualRowKind } from '../types/virtual-row';

/** Resolves a conversation's `source` to its group, defaulting to `MyChats` when unset. */
export const sourceToGroupKey = (source?: FilterTab): FilterTab => {
  switch (source) {
    case FilterTab.Shared:
      return FilterTab.Shared;
    case FilterTab.Organization:
      return FilterTab.Organization;
    default:
      return FilterTab.MyChats;
  }
};

/** Returns the `FilterTab` of the virtual row containing the given item id. */
export const findGroupKeyForItem = (
  rows: VirtualRow[],
  id: string,
): FilterTab | null => {
  let currentGroupKey: FilterTab | null = null;
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
  draggingGroupKey: FilterTab | null,
  conversations: ConversationItem[],
): Set<FilterTab> => {
  const allowed = new Set<FilterTab>();

  if (draggingGroupKey != null) {
    allowed.add(draggingGroupKey);
  }

  if (draggingGroupKey === FilterTab.Pinned) {
    const item = conversations.find((c) => c.id === draggedId);
    if (item) {
      allowed.add(sourceToGroupKey(item.source));
    }
  } else {
    allowed.add(FilterTab.Pinned);
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
  targetGroupKey: FilterTab,
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
