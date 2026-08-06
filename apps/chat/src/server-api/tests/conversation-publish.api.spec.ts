import type { PublicationRule } from '@epam/ai-dial-publish-panel';
import { PublicationRuleFunction } from '@epam/ai-dial-publish-panel';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { conversationsApi } from '../api-client';
import { publishConversation } from '../conversation-publish.api';

vi.mock('../api-client', () => ({
  conversationsApi: {
    publishConversation: vi.fn(),
    getConversationPublishHistory: vi.fn(),
  },
}));

describe('conversation-publish API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards folderPath and rules to the generated client', async () => {
    const rules: PublicationRule[] = [
      {
        source: 'role',
        function: PublicationRuleFunction.Contain,
        targets: ['engineering'],
      },
    ];
    vi.mocked(conversationsApi.publishConversation).mockResolvedValue({
      path: 'conversations/bucket-123/my-conversation',
      folderPath: 'Organization/Data Science',
      publishedAt: '2026-07-15T10:00:00.000Z',
      publishedBy: 'Test User',
    });

    await publishConversation(
      'bucket-123/my-conversation',
      'Organization/Data Science',
      rules,
    );

    expect(conversationsApi.publishConversation).toHaveBeenCalledWith({
      path: 'bucket-123/my-conversation',
      publishConversationDto: {
        folderPath: 'Organization/Data Science',
        rules: [
          { source: 'role', _function: 'CONTAIN', targets: ['engineering'] },
        ],
      },
    });
  });

  it('sends an empty rules array when no rules were added', async () => {
    vi.mocked(conversationsApi.publishConversation).mockResolvedValue({
      path: 'conversations/bucket-123/my-conversation',
      folderPath: 'Organization',
      publishedAt: '2026-07-15T10:00:00.000Z',
      publishedBy: 'Test User',
    });

    await publishConversation('bucket-123/my-conversation', 'Organization', []);

    expect(conversationsApi.publishConversation).toHaveBeenCalledWith({
      path: 'bucket-123/my-conversation',
      publishConversationDto: { folderPath: 'Organization', rules: [] },
    });
  });
});
