import type { ConversationDeletionFailureDto } from '@epam/ai-dial-chat-api-client';
import { FilterTab } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  isTotalDeletionFailure,
  resolveConversationPinChange,
} from '../conversation-list';

describe('isTotalDeletionFailure', () => {
  const failure: ConversationDeletionFailureDto = {
    id: 'c1',
    code: 'UPSTREAM_ERROR',
  };

  it('is true when every conversation failed', () => {
    expect(
      isTotalDeletionFailure({
        failed: [failure],
        deleted: 0,
        alreadyAbsent: 0,
      }),
    ).toBe(true);
  });

  it('is false when anything was deleted or already gone', () => {
    expect(
      isTotalDeletionFailure({
        failed: [failure],
        deleted: 1,
        alreadyAbsent: 0,
      }),
    ).toBe(false);
    expect(
      isTotalDeletionFailure({
        failed: [failure],
        deleted: 0,
        alreadyAbsent: 1,
      }),
    ).toBe(false);
  });

  it('is false when nothing failed', () => {
    expect(
      isTotalDeletionFailure({ failed: [], deleted: 0, alreadyAbsent: 0 }),
    ).toBe(false);
  });
});

describe('resolveConversationPinChange', () => {
  it('pins a conversation dropped on the pinned group', () => {
    expect(resolveConversationPinChange(FilterTab.Pinned, false)).toBe(true);
  });

  it('unpins a pinned conversation dropped elsewhere', () => {
    expect(resolveConversationPinChange(FilterTab.MyChats, true)).toBe(false);
  });

  it('leaves an unpinned conversation moved within other groups', () => {
    expect(
      resolveConversationPinChange(FilterTab.MyChats, false),
    ).toBeUndefined();
  });
});
