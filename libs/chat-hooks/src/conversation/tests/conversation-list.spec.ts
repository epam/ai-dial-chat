import type { ConversationDeletionFailureDto } from '@epam/ai-dial-chat-api-client';
import { FilterTab } from '@epam/ai-dial-chat-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isConversationInBucket,
  isTotalDeletionFailure,
  resolveConversationPinChange,
  toConversationListId,
  toOwnConversationListItem,
} from '../conversation-list';

describe('toConversationListId', () => {
  it('prefixes the id and encodes each path segment', () => {
    expect(toConversationListId('bucket-1/gpt-4__My chat #1')).toBe(
      'conversations/bucket-1/gpt-4__My%20chat%20%231',
    );
  });

  it('keeps the path separators of a nested conversation', () => {
    expect(toConversationListId('bucket-1/folder/chat')).toBe(
      'conversations/bucket-1/folder/chat',
    );
  });
});

describe('isConversationInBucket', () => {
  it('accepts a conversation in the bucket', () => {
    expect(isConversationInBucket('bucket-1/chat', 'bucket-1')).toBe(true);
  });

  it('rejects another bucket, a bucket-name prefix and a missing bucket', () => {
    expect(isConversationInBucket('bucket-2/chat', 'bucket-1')).toBe(false);
    expect(isConversationInBucket('bucket-10/chat', 'bucket-1')).toBe(false);
    expect(isConversationInBucket('bucket-1/chat', undefined)).toBe(false);
    expect(isConversationInBucket('bucket-1/chat', '')).toBe(false);
  });
});

describe('toOwnConversationListItem', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds an own, writable, read row with the given title', () => {
    expect(
      toOwnConversationListItem('bucket-1/chat', { updatedAt: 42 }, 'Hello'),
    ).toEqual({
      id: 'conversations/bucket-1/chat',
      title: 'Hello',
      updatedAt: 42,
      sharedWithMe: false,
      publishedWithMe: false,
      isPinned: false,
      isReadonly: false,
      isScheduledTask: false,
    });
  });

  it('stamps the current time when the conversation has no updatedAt', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    expect(
      toOwnConversationListItem('bucket-1/chat', { updatedAt: 0 }, 'Hello')
        .updatedAt,
    ).toBe(1_700_000_000_000);
  });
});

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
