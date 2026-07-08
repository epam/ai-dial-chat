import { describe, expect, it } from 'vitest';
import {
  conversationIdsMatch,
  toPanelConversationId,
} from '../conversation-id-match';

describe('conversationIdsMatch', () => {
  it('matches list ids with route ids regardless of conversations/ prefix', () => {
    expect(
      conversationIdsMatch(
        'conversations/bucket/gemini__hello__11111111-1111-1111-1111-111111111111',
        'bucket/gemini__hello__11111111-1111-1111-1111-111111111111',
      ),
    ).toBe(true);
  });

  it('matches percent-encoded and decoded path segments', () => {
    expect(
      conversationIdsMatch(
        'conversations/bucket/gemini__My%20chat',
        'bucket/gemini__My chat',
      ),
    ).toBe(true);
  });
});

describe('toPanelConversationId', () => {
  it('decodes percent-encoded path segments', () => {
    expect(
      toPanelConversationId('conversations/bucket/gemini__My%20chat'),
    ).toBe('bucket/gemini__My chat');
  });
});
