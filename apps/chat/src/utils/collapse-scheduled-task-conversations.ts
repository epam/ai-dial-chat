import type { ConversationListItemDto } from '@epam/ai-dial-chat-api-client';
import {
  groupScheduledTaskConversations as groupRuns,
  applyActiveScheduledTaskRun,
  getScheduledTaskRunGroupKey,
  isScheduledTaskRunCollapsible,
  type ScheduledTaskGrouping,
} from '@epam/ai-dial-chat-hooks/conversation';

/** Options for `collapseScheduledTaskConversations`. */
export interface CollapseScheduledTaskConversationsOptions {
  /** Raw id of the conversation currently open in the route, if any. */
  activeConversationId?: string;
  /** Returns `true` when two ids refer to the same conversation despite encoding differences. */
  conversationIdsMatch: (left: string, right: string) => boolean;
}

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
  groupRuns(items, {
    ...options,
    getGroupKey: getScheduledTaskRunGroupKey,
    isCollapsible: isScheduledTaskRunCollapsible,
  });
/** Derives visible rows without filtering provider state. */
export const collapseScheduledTaskConversations = (
  items: readonly ConversationListItemDto[],
  options: CollapseScheduledTaskConversationsOptions,
): ConversationListItemDto[] =>
  applyActiveScheduledTaskRun(
    groupScheduledTaskConversations(items, options),
    options.activeConversationId,
  );
