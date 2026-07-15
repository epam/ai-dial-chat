import { BadGatewayException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { ConversationPublishService } from '../conversation-publish.service';

const okResponse = (data: unknown) =>
  ({ data, response: {} as Response }) as never;

const errResponse = (status: number) =>
  ({ error: {}, response: { status } as Response }) as never;

const makeCacheManager = () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
});

const makeService = () => {
  const dialClient = {
    client: {
      getConversation: vi.fn(),
      createPublication: vi.fn(),
      getPublications: vi.fn(),
    },
  } as unknown as DialClientService;
  const cacheManager = makeCacheManager();
  const service = new ConversationPublishService(
    dialClient,
    cacheManager as never,
  );
  return { service, dialClient, cacheManager };
};

describe('ConversationPublishService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('publish', () => {
    it('re-fetches the conversation title and calls createPublication with an own-bucket sourceUrl/targetUrl', async () => {
      const { service, dialClient, cacheManager } = makeService();
      vi.spyOn(dialClient.client, 'getConversation').mockResolvedValue(
        okResponse({ name: 'Q3 planning notes' }),
      );
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({
          createdAt: 1_700_000_000_000,
          author: 'Valery Dluski',
        }),
      );

      const result = await service.publish(
        'token-abc',
        'bucket-123',
        'my-conversation-abc',
        'Organization/Data Science/Shared chats',
        'Valery Dluski',
      );

      expect(dialClient.client.getConversation).toHaveBeenCalledWith(
        'bucket-123',
        'my-conversation-abc',
        { headers: { Authorization: 'Bearer token-abc' } },
      );
      expect(dialClient.client.createPublication).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: {
          name: 'Q3 planning notes',
          targetFolder: 'public/Organization/Data%20Science/Shared%20chats/',
          resources: [
            {
              action: 'ADD',
              sourceUrl: 'conversations/bucket-123/my-conversation-abc',
              targetUrl:
                'conversations/public/Organization/Data%20Science/Shared%20chats/my-conversation-abc',
            },
          ],
          displayAuthor: 'Valery Dluski',
          rules: [],
        },
      });
      expect(result).toEqual({
        path: 'conversations/bucket-123/my-conversation-abc',
        folderPath: 'Organization/Data Science/Shared chats',
        publishedAt: new Date(1_700_000_000_000).toISOString(),
        publishedBy: 'Valery Dluski',
      });
      expect(cacheManager.del).toHaveBeenCalledWith(
        'conversation-publish-history:conversations/bucket-123/my-conversation-abc',
      );
    });

    it('uses one normalized path for the title lookup, publication URLs, and cache key', async () => {
      const { service, dialClient, cacheManager } = makeService();
      vi.spyOn(dialClient.client, 'getConversation').mockResolvedValue(
        okResponse({ name: 'Q3 planning notes' }),
      );
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        okResponse({ createdAt: 1_700_000_000_000 }),
      );

      const result = await service.publish(
        'token-abc',
        'bucket-123',
        'Planning/My conversation',
        'Organization',
        'Valery Dluski',
      );

      expect(dialClient.client.getConversation).toHaveBeenCalledWith(
        'bucket-123',
        'Planning/My%20conversation',
        { headers: { Authorization: 'Bearer token-abc' } },
      );
      expect(dialClient.client.createPublication).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            resources: [
              expect.objectContaining({
                sourceUrl:
                  'conversations/bucket-123/Planning/My%20conversation',
                targetUrl:
                  'conversations/public/Organization/My%20conversation',
              }),
            ],
          }),
        }),
      );
      expect(cacheManager.del).toHaveBeenCalledWith(
        'conversation-publish-history:conversations/bucket-123/Planning/My%20conversation',
      );
      expect(result.path).toBe(
        'conversations/bucket-123/Planning/My%20conversation',
      );
    });

    it('throws NotFoundException when the conversation does not exist in the caller bucket', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'getConversation').mockResolvedValue(
        errResponse(404),
      );

      await expect(
        service.publish(
          'token-abc',
          'bucket-123',
          'missing-conversation',
          'Organization/Data Science',
          'Valery Dluski',
        ),
      ).rejects.toMatchObject({ status: 404 });
      expect(dialClient.client.createPublication).not.toHaveBeenCalled();
    });

    it('maps a Core 403 on createPublication to ForbiddenException', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'getConversation').mockResolvedValue(
        okResponse({ name: 'Q3 planning notes' }),
      );
      vi.spyOn(dialClient.client, 'createPublication').mockResolvedValue(
        errResponse(403),
      );

      await expect(
        service.publish(
          'token-abc',
          'bucket-123',
          'my-conversation-abc',
          'Organization/Production',
          'Valery Dluski',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('maps an unexpected thrown error on createPublication to BadGatewayException', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'getConversation').mockResolvedValue(
        okResponse({ name: 'Q3 planning notes' }),
      );
      vi.spyOn(dialClient.client, 'createPublication').mockRejectedValue(
        new Error('boom'),
      );

      await expect(
        service.publish(
          'token-abc',
          'bucket-123',
          'my-conversation-abc',
          'Organization/Data Science',
          'Valery Dluski',
        ),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });
  });

  describe('getPublishHistory', () => {
    it('scopes the Core request by the own-bucket publications list scope (not sourceUrl) and maps matching publications', async () => {
      const { service, dialClient, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(undefined);
      vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
        okResponse([
          {
            name: 'Q3 planning notes',
            targetFolder: 'public/Organization/Data Science/',
            createdAt: 1_700_000_000_000,
            author: 'Valery Dluski',
            resources: [
              {
                sourceUrl: 'conversations/bucket-123/my-conversation-abc',
                targetUrl:
                  'conversations/public/Organization/Data Science/my-conversation-abc',
              },
            ],
          },
          {
            name: 'Someone else',
            targetFolder: 'public/Organization/Other/',
            resources: [
              { sourceUrl: 'conversations/bucket-456/some-other-conversation' },
            ],
          },
        ]),
      );

      const result = await service.getPublishHistory(
        'token-abc',
        'bucket-123',
        'my-conversation-abc',
      );

      expect(dialClient.client.getPublications).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: { url: 'publications/bucket-123/' },
      });
      expect(result).toEqual([
        {
          path: 'conversations/bucket-123/my-conversation-abc',
          folderPath: 'Organization/Data Science',
          publishedAt: new Date(1_700_000_000_000).toISOString(),
          publishedBy: 'Valery Dluski',
        },
      ]);
    });

    it('returns an empty array when the conversation has never been published', async () => {
      const { service, dialClient, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(undefined);
      vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
        okResponse([]),
      );

      const result = await service.getPublishHistory(
        'token-abc',
        'bucket-123',
        'my-conversation-abc',
      );

      expect(result).toEqual([]);
    });

    it('matches history using the normalized conversation resource URL', async () => {
      const { service, dialClient, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(undefined);
      vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
        okResponse([
          {
            targetFolder: 'public/Organization/',
            resources: [
              {
                sourceUrl:
                  'conversations/bucket-123/Planning/My%20conversation',
              },
            ],
          },
        ]),
      );

      const result = await service.getPublishHistory(
        'token-abc',
        'bucket-123',
        'Planning/My conversation',
      );

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe(
        'conversations/bucket-123/Planning/My%20conversation',
      );
      expect(cacheManager.set).toHaveBeenCalledWith(
        'conversation-publish-history:conversations/bucket-123/Planning/My%20conversation',
        result,
        60_000,
      );
    });

    it('returns the cached value without calling Core again', async () => {
      const { service, dialClient, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue([{ path: 'cached' }]);

      const result = await service.getPublishHistory(
        'token-abc',
        'bucket-123',
        'my-conversation-abc',
      );

      expect(result).toEqual([{ path: 'cached' }]);
      expect(dialClient.client.getPublications).not.toHaveBeenCalled();
    });

    it('maps an unexpected Core error to BadGatewayException', async () => {
      const { service, dialClient, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(undefined);
      vi.spyOn(dialClient.client, 'getPublications').mockResolvedValue(
        errResponse(500),
      );

      await expect(
        service.getPublishHistory(
          'token-abc',
          'bucket-123',
          'my-conversation-abc',
        ),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });
  });
});
