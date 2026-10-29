import type { ConversationListItemDto } from '@epam/ai-dial-chat-api-client';
import { safeDecodeURIComponent } from '@epam/ai-dial-chat-hooks';
import {
  groupScheduledTaskConversations as groupRuns,
  applyActiveScheduledTaskRun,
  type ScheduledTaskGrouping,
} from '@epam/ai-dial-chat-hooks/conversation';

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
 * only unique per owner, so keying on the bucket keeps runs of different
 * owners apart. Returns `undefined` for anything that is not a groupable run.
 * Callers pass only collapsible runs (see `isCollapsible`).
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
 * Runs shared with or published to the user are never collapsed: the task
 * belongs to someone else, so the user cannot open its History and a hidden
 * run would be unreachable. Pinned runs are exempt because a pin is an
 * explicit choice to keep that run visible.
 */
const isCollapsible = (item: ConversationListItemDto): boolean =>
  !item.isPinned && !item.sharedWithMe && !item.publishedWithMe;

/** Parent ID comparison policy. */
export interface GroupScheduledTaskConversationsOptions {
  /** Compares resource and route IDs. */
  conversationIdsMatch: (left: string, right: string) => boolean;
}
/** Groups runs using the parent's owner and visibility policies. */
export const groupScheduledTaskConversations = (
  items: readonly ConversationListItemDto[],
  options: GroupScheduledTaskConversationsOptions,
): ScheduledTaskGrouping<ConversationListItemDto> =>
  groupRuns(items, { ...options, getGroupKey, isCollapsible });
/** Derives visible rows without filtering provider state. */
export const collapseScheduledTaskConversations = (
  items: readonly ConversationListItemDto[],
  options: CollapseScheduledTaskConversationsOptions,
): ConversationListItemDto[] =>
  applyActiveScheduledTaskRun(
    groupScheduledTaskConversations(items, options),
    options.activeConversationId,
  );
