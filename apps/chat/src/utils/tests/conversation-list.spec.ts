import { afterEach, describe, expect, it, vi } from 'vitest';
import { conversationIdsMatch } from '../conversation-id-match';
import {
  isConversationInBucket,
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

  it('produces an id that matches the route form of the same conversation', () => {
    const conversationId = 'bucket-1/gpt-4__My chat';
    expect(
      conversationIdsMatch(
        toConversationListId(conversationId),
        conversationId,
      ),
    ).toBe(true);
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
