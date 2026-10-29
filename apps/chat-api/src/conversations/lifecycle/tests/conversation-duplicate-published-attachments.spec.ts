import { ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../../dial/dial-client.service';
import type { ConversationResponseDto } from '../../../openapi/openapi-response.dto';
import { ConversationMessageRole } from '../../dto/conversation-message.dto';
import { ConversationTitleCacheService } from '../../listing/conversation-title-cache.service';
import { ConversationPersistenceService } from '../../persistence/conversation-persistence.service';
import { PublishedFolderAttachmentsService } from '../../published-folder-attachments.service';
import { ConversationLifecycleService } from '../conversation-lifecycle.service';

const PUBLISHED_CONVERSATION: ConversationResponseDto = {
  id: 'public/Org/gpt-4o__New chat',
  folderId: 'public/Org',
  name: 'New chat',
  model: { id: 'gpt-4o' },
  prompt: '',
  temperature: 1,
  messages: [
    {
      role: ConversationMessageRole.User,
      content: 'see attached',
      timestamp: 't',
      custom_content: {
        attachments: [
          {
            type: 'application/octet-stream',
            title: 'docs',
            url: 'files/author/docs/',
          },
        ],
      },
    },
  ],
  lastActivityDate: 0,
  updatedAt: 0,
  selectedAddons: [],
  assistantModelId: 'gpt-4o',
};

/**
 * The real lifecycle, persistence and published-attachment resolver, with only
 * DIAL Core stubbed: what a duplicate saves depends on all three together.
 */
const makeService = () => {
  const client = {
    getConversation: vi
      .fn()
      .mockResolvedValue({ data: { ...PUBLISHED_CONVERSATION } }),
    getConversationMetadata: vi
      .fn()
      .mockResolvedValue({ data: null, error: { status: 404 } }),
    getFileMetadata: vi.fn(),
    getSharedResources: vi.fn().mockResolvedValue({ data: undefined }),
    saveConversation: vi.fn().mockResolvedValue({ data: {} }),
  };
  const dialClient = {
    client,
    baseUrl: 'http://localhost:3000',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;
  const cache = new Map<string, unknown>();
  const cacheManager = {
    get: vi.fn(async (key: string) => cache.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      cache.set(key, value);
    }),
  };
  const service = new ConversationLifecycleService(
    dialClient,
    { getPinnedIds: vi.fn().mockResolvedValue([]) } as never,
    new ConversationPersistenceService(
      dialClient,
      {} as never,
      new ConversationTitleCacheService(),
    ),
    { resolveDeploymentItem: vi.fn().mockResolvedValue(null) } as never,
    new PublishedFolderAttachmentsService(dialClient, cacheManager as never),
    new ConversationTitleCacheService(),
    { getReadBefore: vi.fn().mockResolvedValue(null) } as never,
  );
  return { service, client };
};

const duplicate = (service: ConversationLifecycleService) =>
  service.duplicateConversation(
    'public/Org/gpt-4o__New%20chat',
    'token',
    'viewer-bucket',
  );

describe('duplicating a published conversation with folder attachments', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('saves nothing when DIAL Core fails to say whether the published folder exists', async () => {
    const { service, client } = makeService();
    client.getFileMetadata.mockRejectedValue(new TypeError('fetch failed'));

    await expect(duplicate(service)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(client.saveConversation).not.toHaveBeenCalled();
  });

  it('saves nothing on a 503 answer from DIAL Core', async () => {
    const { service, client } = makeService();
    client.getFileMetadata.mockResolvedValue({
      error: { status: 503 },
      response: { status: 503 },
    });

    await expect(duplicate(service)).rejects.toThrow();
    expect(client.saveConversation).not.toHaveBeenCalled();
  });

  it('saves the published folder link once DIAL Core confirms the folder', async () => {
    const { service, client } = makeService();
    client.getFileMetadata.mockResolvedValue({
      data: { items: [{ name: 'a.pdf' }] },
      response: { status: 200 },
    });

    await duplicate(service);

    const saved = client.saveConversation.mock.calls[0][2] as unknown as {
      body: ConversationResponseDto;
    };
    expect(saved.body.messages?.[0].custom_content?.attachments?.[0].url).toBe(
      'files/public/Org/gpt-4o__New%20chat/author/docs/',
    );
  });
});
