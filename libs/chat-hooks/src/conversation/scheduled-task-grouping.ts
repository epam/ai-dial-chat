/** Timestamped conversation used for immutable scheduled-run grouping. */
export interface ScheduledTaskConversation {
  /** Host conversation identity. */
  id: string;
  /** Creation timestamp; absent values sort last. */
  createdAt?: number;
  /** Last update timestamp. */
  updatedAt: number;
}

/** Host policies for grouping scheduled runs. */
export interface GroupScheduledTaskConversationsOptions<T> {
  /** Owner-qualified task key, or undefined for an ordinary conversation. */
  getGroupKey: (item: T) => string | undefined;
  /** Whether this item may be hidden behind another run. */
  isCollapsible: (item: T) => boolean;
  /** Compares host IDs, including their encoding variants. */
  conversationIdsMatch: (left: string, right: string) => boolean;
}

/** Grouping policies and the currently active conversation. */
export interface CollapseScheduledTaskConversationsOptions<
  T,
> extends GroupScheduledTaskConversationsOptions<T> {
  /** Active conversation identity, when present. */
  activeConversationId?: string;
}

/** A grouped run and its representative status. */
export interface ScheduledTaskRun<T> {
  /** Original conversation object. */
  item: T;
  /** Host-provided task key. */
  groupKey: string;
  /** Whether this is the group's newest run. */
  isRepresentative: boolean;
}

/** Immutable grouping reusable across active-conversation changes. */
export interface ScheduledTaskGrouping<
  T,
> extends GroupScheduledTaskConversationsOptions<T> {
  /** Collapsed conversations in original order. */
  collapsed: T[];
  /** Eligible runs in original order. */
  runs: ScheduledTaskRun<T>[];
  /** Complete original list. */
  items: readonly T[];
}

const compareNewestFirst = (
  left: ScheduledTaskConversation,
  right: ScheduledTaskConversation,
): number => {
  const leftCreated = left.createdAt ?? Number.NEGATIVE_INFINITY;
  const rightCreated = right.createdAt ?? Number.NEGATIVE_INFINITY;
  if (leftCreated !== rightCreated) return rightCreated > leftCreated ? 1 : -1;
  if (left.updatedAt !== right.updatedAt)
    return right.updatedAt - left.updatedAt;
  if (left.id === right.id) return 0;
  return right.id > left.id ? 1 : -1;
};

const keepRepresentatives = <T>(
  items: readonly T[],
  representatives: ReadonlyMap<string, T>,
  options: GroupScheduledTaskConversationsOptions<T>,
): T[] =>
  items.filter((item) => {
    if (!options.isCollapsible(item)) return true;
    const key = options.getGroupKey(item);
    return key === undefined || representatives.get(key) === item;
  });

/** Selects each eligible group's newest run, preserving input order and objects. */
export const groupScheduledTaskConversations = <
  T extends ScheduledTaskConversation,
>(
  items: readonly T[],
  options: GroupScheduledTaskConversationsOptions<T>,
): ScheduledTaskGrouping<T> => {
  const newest = new Map<string, T>();
  const grouped: Array<{ item: T; groupKey: string }> = [];
  for (const item of items) {
    if (!options.isCollapsible(item)) continue;
    const groupKey = options.getGroupKey(item);
    if (groupKey === undefined) continue;
    grouped.push({ item, groupKey });
    const current = newest.get(groupKey);
    if (!current || compareNewestFirst(item, current) < 0)
      newest.set(groupKey, item);
  }
  return {
    ...options,
    items,
    collapsed: keepRepresentatives(items, newest, options),
    runs: grouped.map((run) => ({
      ...run,
      isRepresentative: newest.get(run.groupKey) === run.item,
    })),
  };
};

/** Substitutes an active older run; returns the original collapsed array when unchanged. */
export const applyActiveScheduledTaskRun = <
  T extends ScheduledTaskConversation,
>(
  grouping: ScheduledTaskGrouping<T>,
  activeConversationId: string | undefined,
): T[] => {
  if (activeConversationId === undefined) return grouping.collapsed;
  const active = grouping.runs.find(({ item }) =>
    grouping.conversationIdsMatch(item.id, activeConversationId),
  );
  if (!active || active.isRepresentative) return grouping.collapsed;
  const representatives = new Map<string, T>();
  for (const run of grouping.runs) {
    if (run.isRepresentative) representatives.set(run.groupKey, run.item);
  }
  representatives.set(active.groupKey, active.item);
  return keepRepresentatives(grouping.items, representatives, grouping);
};

/** Collapses scheduled runs using host policies and the active conversation. */
export const collapseScheduledTaskConversations = <
  T extends ScheduledTaskConversation,
>(
  items: readonly T[],
  options: CollapseScheduledTaskConversationsOptions<T>,
): T[] =>
  applyActiveScheduledTaskRun(
    groupScheduledTaskConversations(items, options),
    options.activeConversationId,
  );
