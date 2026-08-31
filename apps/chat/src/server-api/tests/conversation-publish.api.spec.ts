import type { PublicationRule } from '@epam/ai-dial-publish-panel';
import { PublicationRuleFunction } from '@epam/ai-dial-publish-panel';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { conversationsApi } from '../api-client';
import {
  publishConversation,
  unpublishConversation,
} from '../conversation-publish.api';

/*
 * `publishApi` is unused here, but the module under test pulls in
 * `publish-rules.api`, which builds its client at module load — so the mock
 * has to carry it or the import fails before any test runs.
 */
vi.mock('../api-client', () => ({
  conversationsApi: {
    publishConversation: vi.fn(),
    unpublishConversation: vi.fn(),
    getConversationPublishHistory: vi.fn(),
  },
  publishApi: {
    getPublishRules: vi.fn(),
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
          {
            source: 'role',
            function: PublicationRuleFunction.Contain,
            targets: ['engineering'],
          },
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

describe('unpublishConversation', () => {
  const unpublishResult = {
    path: 'conversations/bucket-123/my-conversation',
    folderPath: 'Organization/Shared chats',
    requestedAt: '2026-08-13T10:00:00.000Z',
    requestedBy: 'Test User',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards the bucket-relative path and folderPath to the generated client', async () => {
    vi.mocked(conversationsApi.unpublishConversation).mockResolvedValue(
      unpublishResult,
    );

    await unpublishConversation(
      'bucket-123/my-conversation',
      'Organization/Shared chats',
    );

    expect(conversationsApi.unpublishConversation).toHaveBeenCalledWith({
      path: 'bucket-123/my-conversation',
      unpublishConversationDto: { folderPath: 'Organization/Shared chats' },
    });
  });

  it('never sends a rules array', async () => {
    vi.mocked(conversationsApi.unpublishConversation).mockResolvedValue(
      unpublishResult,
    );

    await unpublishConversation('bucket-123/my-conversation', 'Organization');

    const [call] = vi.mocked(conversationsApi.unpublishConversation).mock.calls;
    expect(call[0].unpublishConversationDto).not.toHaveProperty('rules');
  });

  it('resolves with the request-shaped result, not a publish-shaped one', async () => {
    vi.mocked(conversationsApi.unpublishConversation).mockResolvedValue(
      unpublishResult,
    );

    const result = await unpublishConversation(
      'bucket-123/my-conversation',
      'Organization/Shared chats',
    );

    expect(result.requestedAt).toBe('2026-08-13T10:00:00.000Z');
    expect(result).not.toHaveProperty('publishedAt');
  });
});
