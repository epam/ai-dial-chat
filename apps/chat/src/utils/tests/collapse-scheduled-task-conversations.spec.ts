import type { ConversationListItemDto } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import { collapseScheduledTaskConversations } from '../collapse-scheduled-task-conversations';
import { conversationIdsMatch } from '../conversation-id-match';

const conversation = (
  id: string,
  overrides: Partial<ConversationListItemDto> = {},
): ConversationListItemDto => ({
  id,
  title: id,
  updatedAt: 0,
  sharedWithMe: false,
  publishedWithMe: false,
  isPinned: false,
  isReadonly: false,
  isScheduledTask: false,
  ...overrides,
});

const run = (
  runId: string,
  overrides: Partial<ConversationListItemDto> & {
    bucket?: string;
    scheduleId?: string;
  } = {},
): ConversationListItemDto => {
  const { bucket = 'bucket', scheduleId = 's1', ...rest } = overrides;
  return conversation(
    `conversations/${bucket}/.scheduler/${scheduleId}/gpt-4__Daily%20digest__${runId}`,
    { isScheduledTask: true, scheduleId, runId, isUnread: false, ...rest },
  );
};

const collapse = (items: ConversationListItemDto[]) =>
  collapseScheduledTaskConversations(items, { conversationIdsMatch });

describe('collapseScheduledTaskConversations', () => {
  it('keeps a pinned run as its own row next to the newest unpinned run', () => {
    const pinned = run('a', { createdAt: 100, isPinned: true });
    const older = run('b', { createdAt: 200 });
    const newest = run('c', { createdAt: 300 });

    expect(collapse([pinned, older, newest])).toEqual([pinned, newest]);
  });
});
