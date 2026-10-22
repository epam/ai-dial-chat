import {
  BadGatewayException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { ConversationPublishService } from '../conversation-publish.service';

const CONVERSATION_PATH = 'my-conversation-abc';
const SOURCE_URL = 'conversations/bucket-123/my-conversation-abc';

const okResponse = (data: unknown) =>
  ({ data, response: {} as Response }) as never;

const errResponse = (status: number) =>
  ({ error: {}, response: { status } as Response }) as never;

const makeCacheManager = () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
});

const makeService = (publishedFolders?: string[]) => {
  const dialClient = {
    client: {
      getConversation: vi.fn(),
      createPublication: vi.fn(),
      getPublications: vi.fn(),
    },
  } as unknown as DialClientService;
  const cacheManager = makeCacheManager();
  const deploymentsService = {
    resolveDeploymentItem: vi.fn().mockResolvedValue(null),
  };
  const attachmentsService = {
    buildAddResources: vi.fn().mockResolvedValue([]),
    buildDeleteResources: vi.fn().mockResolvedValue([]),
  };
  const service = new ConversationPublishService(
    dialClient,
    cacheManager as never,
    deploymentsService as never,
    attachmentsService as never,
  );
  if (publishedFolders != null) {
    vi.spyOn(service, 'getPublishHistory').mockResolvedValue(
      publishedFolders.map((folderPath) => ({
        path: 'conversations/bucket-123/my-conversation-abc',
        folderPath,
        publishedAt: '2026-07-15T10:00:00.000Z',
        publishedBy: 'Test User',
      })),
    );
  }
  return {
    service,
    dialClient,
    cacheManager,
    deploymentsService,
    attachmentsService,
  };
};

const createPublicationBody = (dialClient: DialClientService, call = 0) =>
  vi.mocked(dialClient.client.createPublication).mock.calls[call][0]
    .body as Record<string, unknown>;

describe('ConversationPublishService.unpublish', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('re-fetches the title and calls createPublication with a single DELETE resource', async () => {
    const { service, dialClient, cacheManager } = makeService([]);
    vi.spyOn(dialClient.client, 'getConversation').mockResolvedValue(
      okResponse({ name: 'Q3 planning notes' }),
    );
    vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
      okResponse({ createdAt: 1_700_000_000_000, author: 'Test User' }),
    );

    const result = await service.unpublish(
      'token-abc',
      'bucket-123',
      CONVERSATION_PATH,
      'Organization/Shared chats',
      'Test User',
    );

    expect(dialClient.client.createPublication).toHaveBeenCalledWith({
      headers: { Authorization: 'Bearer token-abc' },
      body: {
        name: 'Q3 planning notes',
        targetFolder: 'public/Organization/Shared%20chats/',
        resources: [
          {
            action: 'DELETE',
            sourceUrl: SOURCE_URL,
            targetUrl:
              'conversations/public/Organization/Shared%20chats/my-conversation-abc',
          },
        ],
        displayAuthor: 'Test User',
      },
    });
    expect(result).toEqual({
      path: SOURCE_URL,
      folderPath: 'Organization/Shared chats',
      requestedAt: new Date(1_700_000_000_000).toISOString(),
      requestedBy: 'Test User',
    });
    expect(cacheManager.del).toHaveBeenCalledWith(
      `conversation-publish-history:${SOURCE_URL}`,
    );
  });

  it('derives a targetUrl character-for-character identical to the one publish sent', async () => {
    const { service, dialClient } = makeService([]);
    vi.spyOn(dialClient.client, 'getConversation').mockResolvedValue(
      okResponse({ name: 'Q3 planning notes' }),
    );
    vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
      okResponse({ createdAt: 1_700_000_000_000 }),
    );

    await service.publish(
      'token-abc',
      'bucket-123',
      CONVERSATION_PATH,
      'test 14.04/Ünïcode',
      'Test User',
    );
    await service.unpublish(
      'token-abc',
      'bucket-123',
      CONVERSATION_PATH,
      'test 14.04/Ünïcode',
      'Test User',
    );

    const publishBody = createPublicationBody(dialClient, 0);
    const unpublishBody = createPublicationBody(dialClient, 1);
    const publishResources = publishBody.resources as { targetUrl: string }[];
    const unpublishResources = unpublishBody.resources as {
      targetUrl: string;
    }[];

    expect(unpublishResources[0].targetUrl).toBe(publishResources[0].targetUrl);
    expect(unpublishBody.targetFolder).toBe(publishBody.targetFolder);
  });

  it('never forwards a rules array', async () => {
    const { service, dialClient } = makeService([]);
    vi.spyOn(dialClient.client, 'getConversation').mockResolvedValue(
      okResponse({ name: 'Q3 planning notes' }),
    );
    vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
      okResponse({ createdAt: 1_700_000_000_000 }),
    );

    await service.unpublish(
      'token-abc',
      'bucket-123',
      CONVERSATION_PATH,
      'Organization/Shared chats',
      'Test User',
    );

    expect(createPublicationBody(dialClient)).not.toHaveProperty('rules');
  });

  it('aborts before createPublication when the title fetch fails, leaving the cache intact', async () => {
    const { service, dialClient, cacheManager } = makeService([]);
    vi.spyOn(dialClient.client, 'getConversation').mockResolvedValue(
      errResponse(404),
    );
    vi.spyOn(dialClient.client, 'createPublication');

    await expect(
      service.unpublish(
        'token-abc',
        'bucket-123',
        CONVERSATION_PATH,
        'Organization/Shared chats',
        'Test User',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(dialClient.client.createPublication).not.toHaveBeenCalled();
    expect(cacheManager.del).not.toHaveBeenCalled();
  });

  it('maps a Core 403 on createPublication to ForbiddenException without invalidating the cache', async () => {
    const { service, dialClient, cacheManager } = makeService([]);
    vi.spyOn(dialClient.client, 'getConversation').mockResolvedValue(
      okResponse({ name: 'Q3 planning notes' }),
    );
    vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
      errResponse(403),
    );

    await expect(
      service.unpublish(
        'token-abc',
        'bucket-123',
        CONVERSATION_PATH,
        'Organization/Shared chats',
        'Test User',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(cacheManager.del).not.toHaveBeenCalled();
  });

  it('surfaces a thrown SDK error as BadGatewayException', async () => {
    const { service, dialClient } = makeService([]);
    vi.spyOn(dialClient.client, 'getConversation').mockResolvedValue(
      okResponse({ name: 'Q3 planning notes' }),
    );
    vi.spyOn(dialClient.client, 'createPublication').mockRejectedValue(
      new Error('socket hang up'),
    );

    await expect(
      service.unpublish(
        'token-abc',
        'bucket-123',
        CONVERSATION_PATH,
        'Organization/Shared chats',
        'Test User',
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('adds a DELETE for every published attachment file when the history confirms the folder', async () => {
    const { service, dialClient, attachmentsService } = makeService([
      'Organization/Shared chats',
    ]);
    vi.mocked(dialClient.client.getConversation).mockResolvedValue(
      okResponse({ name: 'My conversation' }),
    );
    vi.mocked(dialClient.client.createPublication).mockResolvedValue(
      okResponse({ createdAt: 1_700_000_000_000 }),
    );
    attachmentsService.buildDeleteResources.mockResolvedValue([
      {
        action: 'DELETE',
        targetUrl:
          'files/public/Organization/Shared%20chats/my-conversation-abc/docs/a.pdf',
      },
    ]);

    await service.unpublish(
      'token',
      'bucket-123',
      CONVERSATION_PATH,
      'Organization/Shared chats',
      'Test User',
    );

    expect(attachmentsService.buildDeleteResources).toHaveBeenCalledWith(
      'token',
      'files/public/Organization/Shared%20chats/my-conversation-abc/',
    );
    const body = vi.mocked(dialClient.client.createPublication).mock
      .calls[0][0] as { body: { resources: unknown[] } };
    expect(body.body.resources).toEqual([
      {
        action: 'DELETE',
        sourceUrl: SOURCE_URL,
        targetUrl:
          'conversations/public/Organization/Shared%20chats/my-conversation-abc',
      },
      {
        action: 'DELETE',
        targetUrl:
          'files/public/Organization/Shared%20chats/my-conversation-abc/docs/a.pdf',
      },
    ]);
  });

  it('names no attachment files when the history does not show the conversation in that folder', async () => {
    const { service, dialClient, attachmentsService } = makeService([
      'Another folder',
    ]);
    vi.mocked(dialClient.client.getConversation).mockResolvedValue(
      okResponse({ name: 'My conversation' }),
    );
    vi.mocked(dialClient.client.createPublication).mockResolvedValue(
      okResponse({ createdAt: 1_700_000_000_000 }),
    );

    await service.unpublish(
      'token',
      'bucket-123',
      CONVERSATION_PATH,
      'Organization/Shared chats',
      'Test User',
    );

    expect(attachmentsService.buildDeleteResources).not.toHaveBeenCalled();
    const body = vi.mocked(dialClient.client.createPublication).mock
      .calls[0][0] as { body: { resources: unknown[] } };
    expect(body.body.resources).toHaveLength(1);
  });
});

describe('ConversationPublishService.getPublishHistory with pending removals', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lists a folder once when both an ADD and a pending DELETE publication exist for it', async () => {
    const { service, dialClient, cacheManager } = makeService();
    cacheManager.get.mockResolvedValue(undefined);
    vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
      okResponse([
        {
          targetFolder: 'public/Organization/Shared chats/',
          createdAt: 1_700_000_000_000,
          author: 'Test User',
          resources: [{ action: 'ADD', sourceUrl: SOURCE_URL }],
        },
        {
          targetFolder: 'public/Organization/Shared chats/',
          createdAt: 1_700_000_100_000,
          author: 'Test User',
          resources: [{ action: 'DELETE', sourceUrl: SOURCE_URL }],
        },
      ]),
    );

    const result = await service.getPublishHistory(
      'token-abc',
      'bucket-123',
      CONVERSATION_PATH,
    );

    expect(result).toHaveLength(1);
    expect(result[0].folderPath).toBe('Organization/Shared chats');
    expect(result[0].publishedAt).toBe(
      new Date(1_700_000_000_000).toISOString(),
    );
  });

  it('returns an empty array when the only matching publication is a pending removal', async () => {
    const { service, dialClient, cacheManager } = makeService();
    cacheManager.get.mockResolvedValue(undefined);
    vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
      okResponse([
        {
          targetFolder: 'public/Organization/Shared chats/',
          createdAt: 1_700_000_000_000,
          resources: [{ action: 'DELETE', sourceUrl: SOURCE_URL }],
        },
      ]),
    );

    await expect(
      service.getPublishHistory('token-abc', 'bucket-123', CONVERSATION_PATH),
    ).resolves.toEqual([]);
  });
});

/*
 * [#8445](https://github.com/epam/ai-dial-chat/issues/8445). Core keeps the original ADD publication as APPROVED forever, so
 * after an administrator approved an unpublish request the conversation's row
 * menu went on offering Unpublish for a copy Core had already deleted.
 */
describe('ConversationPublishService.getPublishHistory with approved removals', () => {
  const FOLDER = 'public/Organization/Shared chats/';

  const publication = (action: string, createdAt: number) => ({
    targetFolder: FOLDER,
    createdAt,
    status: 'APPROVED',
    author: 'Test User',
    resources: [{ action, sourceUrl: SOURCE_URL }],
  });

  const getHistory = async (publications: unknown[]) => {
    const { service, dialClient, cacheManager } = makeService();
    cacheManager.get.mockResolvedValue(undefined);
    vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
      okResponse(publications),
    );
    return service.getPublishHistory(
      'token-abc',
      'bucket-123',
      CONVERSATION_PATH,
    );
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('drops the folder once the removal is APPROVED, so the menu offers Publish again', async () => {
    await expect(
      getHistory([
        publication('ADD', 1_700_000_000_000),
        publication('DELETE', 1_700_000_100_000),
      ]),
    ).resolves.toEqual([]);
  });

  it('lists the folder again after a re-publish that followed the approved removal', async () => {
    const result = await getHistory([
      publication('ADD', 1_700_000_000_000),
      publication('DELETE', 1_700_000_100_000),
      publication('ADD', 1_700_000_200_000),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].folderPath).toBe('Organization/Shared chats');
    expect(result[0].publishedAt).toBe(
      new Date(1_700_000_200_000).toISOString(),
    );
  });
});
