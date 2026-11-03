import { describe, expect, it } from 'vitest';
import { NO_CONVERSATION_LIST_SYNC } from '../conversation-data-source';

describe('NO_CONVERSATION_LIST_SYNC', () => {
  it('does nothing for the side effects that return nothing', () => {
    expect(
      NO_CONVERSATION_LIST_SYNC.updateTitle('c1', 'Title'),
    ).toBeUndefined();
    expect(NO_CONVERSATION_LIST_SYNC.bumpActivity('c1')).toBeUndefined();
    expect(NO_CONVERSATION_LIST_SYNC.markUnread('c1')).toBeUndefined();
    expect(NO_CONVERSATION_LIST_SYNC.remove('c1')).toBeUndefined();
  });

  it('resolves the asynchronous side effects without doing anything', async () => {
    await expect(
      NO_CONVERSATION_LIST_SYNC.markViewed('c1'),
    ).resolves.toBeUndefined();
    await expect(
      NO_CONVERSATION_LIST_SYNC.refresh(['c1']),
    ).resolves.toBeUndefined();
  });

  it('leaves marking the open chat viewed to the sidebar', () => {
    expect(NO_CONVERSATION_LIST_SYNC.shouldMarkOpenChatViewed).toBeUndefined();
  });
});
