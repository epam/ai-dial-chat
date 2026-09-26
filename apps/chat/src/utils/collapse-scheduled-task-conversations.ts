import type { ConversationListItemDto } from '@epam/ai-dial-chat-api-client';
import { safeDecodeURIComponent } from '@epam/ai-dial-chat-hooks';

const CONVERSATION_RESOURCE_TYPE = 'conversations';

/** Options for `collapseScheduledTaskConversations`. */
export interface CollapseScheduledTaskConversationsOptions {
  /** Raw id of the conversation currently open in the route, if any. */
  activeConversationId?: string;
  /** Returns `true` when two ids refer to the same conversation despite encoding differences. */
  conversationIdsMatch: (left: string, right: string) => boolean;
}

/*
 * Group key of a scheduled-task run: `{bucket}/{scheduleId}`. `scheduleId` is
 * only unique per owner, so a run shared from another user's bucket must not
 * collapse into the user's own task with the same id. Returns `undefined` for
 * anything that is not a groupable run.
 */
const getGroupKey = (item: ConversationListItemDto): string | undefined => {
  if (!item.isScheduledTask || !item.scheduleId) return undefined;
  const segments = safeDecodeURIComponent(item.id).split('/');
  if (segments[0] !== CONVERSATION_RESOURCE_TYPE || !segments[1]) {
    return undefined;
  }
  return `${segments[1]}/${item.scheduleId}`;
};

/*
 * Newest-first comparison: `createdAt` (runs without it sort last), then
 * `updatedAt`, then `id` descending so the pick is deterministic even for
 * shared runs, which carry no dates at all.
 */
const compareNewestFirst = (
  left: ConversationListItemDto,
  right: ConversationListItemDto,
): number => {
  const leftCreated = left.createdAt ?? Number.NEGATIVE_INFINITY;
  const rightCreated = right.createdAt ?? Number.NEGATIVE_INFINITY;
  if (leftCreated !== rightCreated) return rightCreated > leftCreated ? 1 : -1;
  if (left.updatedAt !== right.updatedAt) {
    return right.updatedAt - left.updatedAt;
  }
  if (left.id === right.id) return 0;
  return right.id > left.id ? 1 : -1;
};

/**
 * Collapses the run conversations of each scheduled task to one representative
 * so the conversation panel shows one row per task instead of one per run.
 *
 * This is a display derivation only. `ConversationsContext` must keep the full
 * list: the active-task banner, the task History's per-run unread marks,
 * mark-as-viewed, read-only detection and the overlay bridge all look older
 * runs up in it, and they break if those runs are filtered out upstream.
 *
 * Rules: pinned runs are never collapsed; among a task's unpinned runs the
 * active route conversation wins, otherwise the newest by `createdAt` (then
 * `updatedAt`, then `id`). Kept items preserve their input order and the input
 * array is not mutated.
 */
export const collapseScheduledTaskConversations = (
  items: readonly ConversationListItemDto[],
  {
    activeConversationId,
    conversationIdsMatch,
  }: CollapseScheduledTaskConversationsOptions,
): ConversationListItemDto[] => {
  const representativeByGroup = new Map<string, ConversationListItemDto>();

  for (const item of items) {
    if (item.isPinned) continue;
    const groupKey = getGroupKey(item);
    if (groupKey === undefined) continue;

    const current = representativeByGroup.get(groupKey);
    if (!current) {
      representativeByGroup.set(groupKey, item);
      continue;
    }

    const isItemActive =
      activeConversationId !== undefined &&
      conversationIdsMatch(item.id, activeConversationId);
    const isCurrentActive =
      activeConversationId !== undefined &&
      conversationIdsMatch(current.id, activeConversationId);

    if (
      isItemActive ||
      (!isCurrentActive && compareNewestFirst(item, current) < 0)
    ) {
      representativeByGroup.set(groupKey, item);
    }
  }

  return items.filter((item) => {
    if (item.isPinned) return true;
    const groupKey = getGroupKey(item);
    return (
      groupKey === undefined || representativeByGroup.get(groupKey) === item
    );
  });
};
