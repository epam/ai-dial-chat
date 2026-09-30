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

/** Options for `groupScheduledTaskConversations`. */
export interface GroupScheduledTaskConversationsOptions {
  /** Returns `true` when two ids refer to the same conversation despite encoding differences. */
  conversationIdsMatch: (left: string, right: string) => boolean;
}

/** An unpinned scheduled-task run and the group it belongs to. */
interface ScheduledTaskRun {
  item: ConversationListItemDto;
  groupKey: string;
  /** `true` for the group's newest run, the one shown when no older run is active. */
  isRepresentative: boolean;
}

/**
 * The `activeConversationId`-independent half of the collapse, computed once
 * per list: the list with every task represented by its newest unpinned run,
 * plus the grouped runs needed to substitute an active older run cheaply.
 */
export interface ScheduledTaskGrouping {
  /** The collapsed list with no active run applied. */
  collapsed: ConversationListItemDto[];
  /** Every unpinned grouped run, in input order. */
  runs: ScheduledTaskRun[];
  /** The source list, needed only when an older run must be swapped in. */
  items: readonly ConversationListItemDto[];
  conversationIdsMatch: (left: string, right: string) => boolean;
}

/* Keeps pinned items, ungrouped items, and each group's chosen run, in input order. */
const keepRepresentatives = (
  items: readonly ConversationListItemDto[],
  representativeByGroup: ReadonlyMap<string, ConversationListItemDto>,
): ConversationListItemDto[] =>
  items.filter((item) => {
    if (item.isPinned) return true;
    const groupKey = getGroupKey(item);
    return (
      groupKey === undefined || representativeByGroup.get(groupKey) === item
    );
  });

/**
 * Groups a task's unpinned runs and picks each group's newest run
 * (`createdAt`, then `updatedAt`, then `id`). Pinned runs are never grouped.
 * Depends only on the list, so a navigation does not recompute it.
 */
export const groupScheduledTaskConversations = (
  items: readonly ConversationListItemDto[],
  { conversationIdsMatch }: GroupScheduledTaskConversationsOptions,
): ScheduledTaskGrouping => {
  const newestByGroup = new Map<string, ConversationListItemDto>();
  const grouped: Array<{ item: ConversationListItemDto; groupKey: string }> =
    [];

  for (const item of items) {
    if (item.isPinned) continue;
    const groupKey = getGroupKey(item);
    if (groupKey === undefined) continue;

    grouped.push({ item, groupKey });
    const current = newestByGroup.get(groupKey);
    if (!current || compareNewestFirst(item, current) < 0) {
      newestByGroup.set(groupKey, item);
    }
  }

  return {
    collapsed: keepRepresentatives(items, newestByGroup),
    runs: grouped.map(({ item, groupKey }) => ({
      item,
      groupKey,
      isRepresentative: newestByGroup.get(groupKey) === item,
    })),
    items,
    conversationIdsMatch,
  };
};

/**
 * Applies the route's conversation to a grouping: an older unpinned run that
 * is open stands in for its task. Returns `grouping.collapsed` itself — the
 * same reference — whenever the active id changes no representative, which is
 * every navigation except opening an older run.
 */
export const applyActiveScheduledTaskRun = (
  grouping: ScheduledTaskGrouping,
  activeConversationId: string | undefined,
): ConversationListItemDto[] => {
  if (activeConversationId === undefined) return grouping.collapsed;

  const activeRun = grouping.runs.find(({ item }) =>
    grouping.conversationIdsMatch(item.id, activeConversationId),
  );
  if (!activeRun || activeRun.isRepresentative) return grouping.collapsed;

  const representativeByGroup = new Map<string, ConversationListItemDto>();
  for (const run of grouping.runs) {
    if (run.isRepresentative) representativeByGroup.set(run.groupKey, run.item);
  }
  representativeByGroup.set(activeRun.groupKey, activeRun.item);

  return keepRepresentatives(grouping.items, representativeByGroup);
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
 *
 * Equivalent to `groupScheduledTaskConversations` followed by
 * `applyActiveScheduledTaskRun`; a host that re-evaluates on every navigation
 * should memoize the two phases separately.
 */
export const collapseScheduledTaskConversations = (
  items: readonly ConversationListItemDto[],
  {
    activeConversationId,
    conversationIdsMatch,
  }: CollapseScheduledTaskConversationsOptions,
): ConversationListItemDto[] =>
  applyActiveScheduledTaskRun(
    groupScheduledTaskConversations(items, { conversationIdsMatch }),
    activeConversationId,
  );
