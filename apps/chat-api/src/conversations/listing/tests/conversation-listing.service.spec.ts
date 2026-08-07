import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { handleDialSdkError } from '../../../common/dial/dial-error.mapper';
import type { DialClientService } from '../../../dial/dial-client.service';
import { ConversationPersistenceService } from '../../persistence/conversation-persistence.service';
import { ConversationListingService } from '../conversation-listing.service';

vi.mock('../../../common/dial/dial-error.mapper', () => ({
  handleDialSdkError: vi.fn(),
}));

describe('ConversationListingService', () => {
  let service: ConversationListingService;
  let mockDialClient: DialClientService;
  let mockUserConfigService: {
    getPinnedIds: ReturnType<typeof vi.fn>;
    updatePin: ReturnType<typeof vi.fn>;
    migratePin: ReturnType<typeof vi.fn>;
  };
  let mockScheduledTaskUnreadService: {
    getViewedIds: ReturnType<typeof vi.fn>;
    markViewed: ReturnType<typeof vi.fn>;
  };
  let mockConversationNamingService: {
    maybeRenameAfterFirstReply: ReturnType<typeof vi.fn>;
  };
  let persistenceService: ConversationPersistenceService;

  beforeEach(() => {
    mockDialClient = {
      client: {
        deleteConversation: vi.fn(),
        getConversation: vi.fn(),
        getConversationMetadata: vi.fn(),
        getSharedResources: vi.fn().mockResolvedValue({ data: undefined }),
        moveResource: vi.fn(),
        saveConversation: vi.fn(),
        sendChatCompletionRequest: vi.fn(),
        subscribeToResources: vi.fn(),
      },
      baseUrl: 'http://localhost:3000',
      dialApiVersion: '2024-10-21',
    } as unknown as DialClientService;
    mockUserConfigService = {
      getPinnedIds: vi.fn().mockResolvedValue([]),
      updatePin: vi.fn().mockResolvedValue(undefined),
      migratePin: vi.fn().mockResolvedValue(undefined),
    };
    mockScheduledTaskUnreadService = {
      getViewedIds: vi.fn().mockResolvedValue([]),
      markViewed: vi.fn().mockResolvedValue(undefined),
    };
    mockConversationNamingService = {
      maybeRenameAfterFirstReply: vi.fn(),
    };
    persistenceService = new ConversationPersistenceService(
      mockDialClient,
      mockConversationNamingService as never,
    );
    service = new ConversationListingService(
      mockDialClient,
      mockUserConfigService as never,
      mockScheduledTaskUnreadService as never,
      persistenceService,
    );
    vi.mocked(handleDialSdkError).mockReset();
    vi.spyOn(
      service['dialClient'].client,
      'saveConversation',
    ).mockResolvedValue({
      data: {},
    } as never);
    vi.spyOn(service['dialClient'].client, 'getConversation').mockRejectedValue(
      {
        error: { status: 404 },
      } as never,
    );
    vi.spyOn(
      service['dialClient'].client,
      'getConversationMetadata',
    ).mockResolvedValue({
      data: null,
      error: { status: 404 },
      response: new Response(null, { status: 404 }),
    } as never);
  });

  describe('listConversations', () => {
    type MetadataItem = { url: string; nodeType: string; updatedAt?: number };

    const mockMetadata = (
      userItems: MetadataItem[],
      publicItems: MetadataItem[] = [],
    ) => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      ).mockImplementation((bucket: string) => {
        if (bucket === 'test-bucket') {
          return Promise.resolve({ data: { items: userItems } }) as never;
        }
        return Promise.resolve({ data: { items: publicItems } }) as never;
      });
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue({
        data: { resources: [] },
      } as never);
    };

    it('passes pagination through SDK params.query', async () => {
      const getMetadataSpy = vi
        .spyOn(service['dialClient'].client, 'getConversationMetadata')
        .mockResolvedValue({ data: { items: [] } } as never);
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue({
        data: { resources: [] },
      } as never);

      await service.listConversations(
        'test-token',
        'test-bucket',
        50,
        'user-cursor',
      );

      expect(getMetadataSpy).toHaveBeenNthCalledWith(
        1,
        'test-bucket',
        '',
        expect.objectContaining({
          params: {
            query: {
              recursive: true,
              limit: 50,
              token: 'user-cursor',
              permissions: true,
            },
          },
        }),
      );
    });

    it('enriches display names for at most the most recently updated owned items', async () => {
      const items = Array.from({ length: 25 }, (_, index) => ({
        url: `conversations/bucket/conv-${index}`,
        nodeType: 'FILE' as const,
        updatedAt: index,
        permissions: ['READ', 'WRITE'],
      }));
      mockMetadata(items);
      const getConversationSpy = vi
        .spyOn(service['dialClient'].client, 'getConversation')
        .mockResolvedValue({
          data: { name: 'Stored display title' },
        } as never);

      await service.listConversations('test-token', 'test-bucket');

      expect(getConversationSpy).toHaveBeenCalledTimes(20);
    });

    it('sets isPinned: true on items whose id is in the pins list', async () => {
      mockMetadata([
        { url: 'conversations/bucket/conv-1', nodeType: 'FILE' },
        { url: 'conversations/bucket/conv-2', nodeType: 'FILE' },
      ]);
      mockUserConfigService.getPinnedIds.mockResolvedValue([
        'conversations/bucket/conv-1',
      ]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'conversations/bucket/conv-1',
            isPinned: true,
          }),
          expect.objectContaining({
            id: 'conversations/bucket/conv-2',
            isPinned: false,
          }),
        ]),
      );
    });

    it('sets isPinned: false on items not in the pins list', async () => {
      mockMetadata([
        { url: 'conversations/bucket/conv-3', nodeType: 'FILE' },
        { url: 'conversations/bucket/conv-4', nodeType: 'FILE' },
      ]);
      mockUserConfigService.getPinnedIds.mockResolvedValue([
        'conversations/bucket/conv-5',
      ]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items.every((item) => item.isPinned === false)).toBe(true);
    });

    it('sets isPinned: false on all items when getPinnedIds returns empty', async () => {
      mockMetadata([
        { url: 'conversations/bucket/conv-a', nodeType: 'FILE' },
        { url: 'conversations/bucket/conv-b', nodeType: 'FILE' },
      ]);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items.every((item) => item.isPinned === false)).toBe(true);
    });

    it('merges items from user and public buckets', async () => {
      mockMetadata(
        [
          {
            url: 'conversations/test-bucket/user-conv',
            nodeType: 'FILE',
            updatedAt: 2000,
          },
        ],
        [
          {
            url: 'conversations/public/pub-conv',
            nodeType: 'FILE',
            updatedAt: 1000,
          },
        ],
      );
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items).toHaveLength(2);
      expect(result.items.map((i) => i.id)).toContain(
        'conversations/test-bucket/user-conv',
      );
      expect(result.items.map((i) => i.id)).toContain(
        'conversations/public/pub-conv',
      );
    });

    it('sets publishedWithMe: true on all items from the public bucket', async () => {
      mockMetadata(
        [
          {
            url: 'conversations/test-bucket/user-conv',
            nodeType: 'FILE',
            updatedAt: 2000,
          },
        ],
        [
          {
            url: 'conversations/public/pub-conv',
            nodeType: 'FILE',
            updatedAt: 1000,
          },
        ],
      );
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      const userItem = result.items.find(
        (i) => i.id === 'conversations/test-bucket/user-conv',
      );
      const pubItem = result.items.find(
        (i) => i.id === 'conversations/public/pub-conv',
      );
      expect(userItem?.publishedWithMe).toBe(false);
      expect(pubItem?.publishedWithMe).toBe(true);
    });

    it('returns the personal and public copies as two independent items when relative paths match', async () => {
      const personalItem = {
        url: 'conversations/test-bucket/gpt-4o__shared-title',
        nodeType: 'FILE',
        updatedAt: 2000,
        permissions: ['READ', 'WRITE'],
      };
      mockMetadata(
        [personalItem],
        [
          {
            url: 'conversations/public/gpt-4o__shared-title',
            nodeType: 'FILE',
            updatedAt: 2000,
          },
        ],
      );
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items).toHaveLength(2);
      expect(result.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'conversations/test-bucket/gpt-4o__shared-title',
            publishedWithMe: false,
            isReadonly: false,
          }),
          expect.objectContaining({
            id: 'conversations/public/gpt-4o__shared-title',
            publishedWithMe: true,
            isReadonly: true,
          }),
        ]),
      );
    });

    it("preserves the personal copy's pin status after the conversation is published", async () => {
      const personalMetadataItem = {
        url: 'conversations/test-bucket/gpt-4o__shared-title',
        nodeType: 'FILE',
        updatedAt: 2000,
        permissions: ['READ', 'WRITE'],
      };
      mockMetadata(
        [personalMetadataItem],
        [
          {
            url: 'conversations/public/gpt-4o__shared-title',
            nodeType: 'FILE',
            updatedAt: 2000,
          },
        ],
      );
      mockUserConfigService.getPinnedIds.mockResolvedValue([
        'conversations/test-bucket/gpt-4o__shared-title',
      ]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      const personalItem = result.items.find(
        (i) => i.id === 'conversations/test-bucket/gpt-4o__shared-title',
      );
      const publicItem = result.items.find(
        (i) => i.id === 'conversations/public/gpt-4o__shared-title',
      );
      expect(personalItem?.isPinned).toBe(true);
      expect(publicItem?.isPinned).toBe(false);
    });

    it('merges items from getSharedResources and sets sharedWithMe: true', async () => {
      mockMetadata([
        {
          url: 'conversations/test-bucket/user-conv',
          nodeType: 'FILE',
          updatedAt: 3000,
        },
      ]);
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue({
        data: {
          resources: [
            { url: 'conversations/other-bucket/shared-conv', nodeType: 'FILE' },
          ],
        },
      } as never);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items).toHaveLength(2);
      const sharedItem = result.items.find(
        (i) => i.id === 'conversations/other-bucket/shared-conv',
      );
      expect(sharedItem?.sharedWithMe).toBe(true);
      expect(sharedItem?.publishedWithMe).toBe(false);
    });

    it('tags a user-bucket item created by a scheduled task with isScheduledTask, scheduleId, and runId', async () => {
      mockMetadata([
        {
          url: 'conversations/test-bucket/.scheduler/sched_abc/gpt-4o__Morning briefing__c7aeee4c-c01f-41f2-b0db-b8a1a39943f5',
          nodeType: 'FILE',
          updatedAt: 1000,
        },
      ]);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items).toEqual([
        expect.objectContaining({
          isScheduledTask: true,
          scheduleId: 'sched_abc',
          runId: 'c7aeee4c-c01f-41f2-b0db-b8a1a39943f5',
        }),
      ]);
    });

    it('tags a public-bucket item created by a scheduled task independently of its own path', async () => {
      mockMetadata(
        [],
        [
          {
            url: 'conversations/public/.scheduler/sched_pub/gpt-4o__title__d8bfff5d-d883-47e8-adc3-8a6afee46411',
            nodeType: 'FILE',
            updatedAt: 1000,
          },
        ],
      );
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items).toEqual([
        expect.objectContaining({
          isScheduledTask: true,
          scheduleId: 'sched_pub',
          runId: 'd8bfff5d-d883-47e8-adc3-8a6afee46411',
        }),
      ]);
    });

    it('tags a shared item created by a scheduled task using its own resource id', async () => {
      mockMetadata([]);
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue({
        data: {
          resources: [
            {
              url: 'conversations/other-bucket/.scheduler/sched_shr/gpt-4o__title__a1b2c3d4-e5f6-4789-abcd-ef0123456789',
              nodeType: 'FILE',
            },
          ],
        },
      } as never);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items).toEqual([
        expect.objectContaining({
          isScheduledTask: true,
          scheduleId: 'sched_shr',
          runId: 'a1b2c3d4-e5f6-4789-abcd-ef0123456789',
          sharedWithMe: true,
        }),
      ]);
    });

    it('sets isScheduledTask: false with no scheduleId/runId for a normal conversation', async () => {
      mockMetadata([
        {
          url: 'conversations/test-bucket/gpt-4o__Morning briefing__uuid',
          nodeType: 'FILE',
          updatedAt: 1000,
        },
      ]);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items[0].isScheduledTask).toBe(false);
      expect(result.items[0].scheduleId).toBeUndefined();
      expect(result.items[0].runId).toBeUndefined();
    });

    it('sets isUnread: true for a scheduler-created conversation not in the viewed-ids set', async () => {
      mockMetadata([
        {
          url: 'conversations/test-bucket/.scheduler/sched_abc/gpt-4o__Morning briefing__c7aeee4c-c01f-41f2-b0db-b8a1a39943f5',
          nodeType: 'FILE',
          updatedAt: 1000,
        },
      ]);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);
      mockScheduledTaskUnreadService.getViewedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items[0].isUnread).toBe(true);
    });

    it('sets isUnread: false for a scheduler-created conversation already in the viewed-ids set', async () => {
      const id =
        'conversations/test-bucket/.scheduler/sched_abc/gpt-4o__Morning briefing__c7aeee4c-c01f-41f2-b0db-b8a1a39943f5';
      mockMetadata([
        {
          url: id,
          nodeType: 'FILE',
          updatedAt: 1000,
        },
      ]);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);
      mockScheduledTaskUnreadService.getViewedIds.mockResolvedValue([id]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items[0].isUnread).toBe(false);
    });

    it('omits isUnread for a normal (non-scheduler) conversation', async () => {
      mockMetadata([
        {
          url: 'conversations/test-bucket/gpt-4o__Morning briefing__uuid',
          nodeType: 'FILE',
          updatedAt: 1000,
        },
      ]);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);
      mockScheduledTaskUnreadService.getViewedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items[0].isUnread).toBeUndefined();
    });

    it('falls back to isUnread: true for scheduler items when the viewed-ids fetch fails open', async () => {
      mockMetadata([
        {
          url: 'conversations/test-bucket/.scheduler/sched_abc/gpt-4o__Morning briefing__c7aeee4c-c01f-41f2-b0db-b8a1a39943f5',
          nodeType: 'FILE',
          updatedAt: 1000,
        },
      ]);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);
      // ScheduledTaskUnreadService.getViewedIds never rejects (it falls back to [] internally on error) — verify that fail-open default is respected here too.
      mockScheduledTaskUnreadService.getViewedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items[0].isUnread).toBe(true);
    });

    it('calls getSharedResources with resourceTypes CONVERSATION and with me', async () => {
      mockMetadata([]);
      const spy = vi
        .spyOn(service['dialClient'].client, 'getSharedResources')
        .mockResolvedValue({
          data: { resources: [] },
        } as never);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      await service.listConversations('test-token', 'test-bucket');

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { resourceTypes: ['CONVERSATION'], with: 'me' },
        }),
      );
    });

    it('returns user and public items when getSharedResources fails', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      ).mockImplementation((bucket: string) => {
        if (bucket === 'test-bucket') {
          return Promise.resolve({
            data: {
              items: [
                {
                  url: 'conversations/test-bucket/user-conv',
                  nodeType: 'FILE',
                },
              ],
            },
          }) as never;
        }
        return Promise.resolve({
          data: {
            items: [{ url: 'conversations/public/pub-conv', nodeType: 'FILE' }],
          },
        }) as never;
      });
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockRejectedValue(new Error('share service unreachable'));
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items).toHaveLength(2);
      expect(result.items.map((i) => i.id)).toContain(
        'conversations/test-bucket/user-conv',
      );
      expect(result.items.map((i) => i.id)).toContain(
        'conversations/public/pub-conv',
      );
    });

    it('sorts merged items by updatedAt descending', async () => {
      mockMetadata(
        [
          {
            url: 'conversations/test-bucket/older',
            nodeType: 'FILE',
            updatedAt: 1000,
          },
        ],
        [
          {
            url: 'conversations/public/newer',
            nodeType: 'FILE',
            updatedAt: 3000,
          },
        ],
      );
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items[0].id).toBe('conversations/public/newer');
      expect(result.items[1].id).toBe('conversations/test-bucket/older');
    });

    it('returns only user items when public bucket request fails', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      ).mockImplementation((bucket: string) => {
        if (bucket === 'test-bucket') {
          return Promise.resolve({
            data: {
              items: [
                {
                  url: 'conversations/test-bucket/user-conv',
                  nodeType: 'FILE',
                },
              ],
            },
          }) as never;
        }
        return Promise.reject(new Error('public bucket unreachable'));
      });
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('conversations/test-bucket/user-conv');
    });

    it('encodes a compound nextToken when both user and public buckets have more results', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      ).mockImplementation((bucket: string) => {
        if (bucket === 'test-bucket') {
          return Promise.resolve({
            data: { items: [], nextToken: 'user-cursor' },
          }) as never;
        }
        return Promise.resolve({
          data: { items: [], nextToken: 'pub-cursor' },
        }) as never;
      });
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue({
        data: { resources: [] },
      } as never);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.nextToken).toBeDefined();
      const decoded = JSON.parse(
        Buffer.from(
          (result.nextToken ?? '').slice('ct1.'.length),
          'base64url',
        ).toString('utf-8'),
      ) as { u?: string; p?: string };
      expect(decoded.u).toBe('user-cursor');
      expect(decoded.p).toBe('pub-cursor');
    });

    it('passes decoded user and public cursors as separate token params', async () => {
      const spy = vi
        .spyOn(service['dialClient'].client, 'getConversationMetadata')
        .mockImplementation(
          () => Promise.resolve({ data: { items: [] } }) as never,
        );
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue({
        data: { resources: [] },
      } as never);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const compoundToken =
        'ct1.' +
        Buffer.from(
          JSON.stringify({ u: 'user-cursor', p: 'pub-cursor' }),
        ).toString('base64url');

      await service.listConversations(
        'test-token',
        'test-bucket',
        20,
        compoundToken,
      );

      const userCall = spy.mock.calls.find(
        ([bucket]) => bucket === 'test-bucket',
      );
      const publicCall = spy.mock.calls.find(([bucket]) => bucket === 'public');

      expect(
        (userCall?.[2] as { params?: { query?: { token?: string } } })?.params
          ?.query?.token,
      ).toBe('user-cursor');
      expect(
        (publicCall?.[2] as { params?: { query?: { token?: string } } })?.params
          ?.query?.token,
      ).toBe('pub-cursor');
    });

    it('treats a legacy (non-compound) nextToken as a user-bucket cursor', async () => {
      const spy = vi
        .spyOn(service['dialClient'].client, 'getConversationMetadata')
        .mockImplementation(
          () => Promise.resolve({ data: { items: [] } }) as never,
        );
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue({
        data: { resources: [] },
      } as never);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      await service.listConversations(
        'test-token',
        'test-bucket',
        20,
        'legacy-opaque-token',
      );

      const userCall = spy.mock.calls.find(
        ([bucket]) => bucket === 'test-bucket',
      );
      const publicCall = spy.mock.calls.find(([bucket]) => bucket === 'public');

      expect(
        (userCall?.[2] as { params?: { query?: { token?: string } } })?.params
          ?.query?.token,
      ).toBe('legacy-opaque-token');
      expect(
        (publicCall?.[2] as { params?: { query?: { token?: string } } })?.params
          ?.query?.token,
      ).toBeUndefined();
    });

    it('returns undefined nextToken when neither bucket has a cursor', async () => {
      mockMetadata([]);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.nextToken).toBeUndefined();
    });

    it('encodes a compound nextToken with only u when only user bucket has a cursor', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      ).mockImplementation((bucket: string) => {
        if (bucket === 'test-bucket') {
          return Promise.resolve({
            data: { items: [], nextToken: 'user-cursor' },
          }) as never;
        }
        return Promise.resolve({ data: { items: [] } }) as never;
      });
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue({
        data: { resources: [] },
      } as never);
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.nextToken).toBeDefined();
      const decoded = JSON.parse(
        Buffer.from(
          (result.nextToken ?? '').slice('ct1.'.length),
          'base64url',
        ).toString('utf-8'),
      ) as { u?: string; p?: string };
      expect(decoded.u).toBe('user-cursor');
      expect(decoded.p).toBeUndefined();
    });

    it('still throws NotFoundException for a 404 on the user bucket', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      ).mockImplementation((bucket: string) => {
        if (bucket === 'test-bucket') {
          return Promise.resolve({
            error: { message: 'Not found' },
            response: new Response(null, { status: 404 }),
          }) as never;
        }
        return Promise.resolve({ data: { items: [] } }) as never;
      });
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);
      vi.mocked(handleDialSdkError).mockImplementation(() => {
        throw new Error('mapped DIAL error');
      });

      await expect(
        service.listConversations('test-token', 'test-bucket'),
      ).rejects.toThrow('mapped DIAL error');
    });

    it('filters out FOLDER node types from both buckets', async () => {
      mockMetadata(
        [
          { url: 'conversations/test-bucket/folder', nodeType: 'FOLDER' },
          { url: 'conversations/test-bucket/file', nodeType: 'FILE' },
        ],
        [
          { url: 'conversations/public/pub-folder', nodeType: 'FOLDER' },
          { url: 'conversations/public/pub-file', nodeType: 'FILE' },
        ],
      );
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items.map((i) => i.id)).toEqual(
        expect.not.arrayContaining([
          'conversations/test-bucket/folder',
          'conversations/public/pub-folder',
        ]),
      );
      expect(result.items.map((i) => i.id)).toEqual(
        expect.arrayContaining([
          'conversations/test-bucket/file',
          'conversations/public/pub-file',
        ]),
      );
    });

    it('preserves sharedWithMe from user bucket items', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      ).mockImplementation((bucket: string) => {
        if (bucket === 'test-bucket') {
          return Promise.resolve({
            data: {
              items: [
                {
                  url: 'conversations/test-bucket/shared',
                  nodeType: 'FILE',
                  sharedWithMe: true,
                },
              ],
            },
          }) as never;
        }
        return Promise.resolve({ data: { items: [] } }) as never;
      });
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items[0].sharedWithMe).toBe(true);
    });

    it('calls handleDialSdkError when the user bucket returns a response-level error', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      ).mockImplementation((bucket: string) => {
        if (bucket === 'test-bucket') {
          return Promise.resolve({
            error: { message: 'Bad Gateway' },
            response: new Response(null, { status: 502 }),
          }) as never;
        }
        return Promise.resolve({ data: { items: [] } }) as never;
      });
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);
      vi.mocked(handleDialSdkError).mockImplementation(() => {
        throw new Error('mapped DIAL error');
      });

      await expect(
        service.listConversations('test-token', 'test-bucket'),
      ).rejects.toThrow('mapped DIAL error');

      expect(handleDialSdkError).toHaveBeenCalledWith(
        { message: 'Bad Gateway' },
        'conversations.listConversations',
        expect.anything(),
        expect.objectContaining({ status: 502 }),
      );
    });

    it('returns only user items when public bucket returns a response-level error', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      ).mockImplementation((bucket: string) => {
        if (bucket === 'test-bucket') {
          return Promise.resolve({
            data: {
              items: [
                {
                  url: 'conversations/test-bucket/user-conv',
                  nodeType: 'FILE',
                },
              ],
            },
          }) as never;
        }
        return Promise.resolve({ error: { status: 403 } }) as never;
      });
      mockUserConfigService.getPinnedIds.mockResolvedValue([]);

      const result = await service.listConversations(
        'test-token',
        'test-bucket',
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('conversations/test-bucket/user-conv');
    });
  });

  describe('encoded conversation resource paths — metadata', () => {
    const conversationPath =
      'applications/catalog/Team%2FApp%20One__0.0.1__hello';

    it('does not double-encode metadata paths', async () => {
      const metadataSpy = vi
        .spyOn(service['dialClient'].client, 'getConversationMetadata')
        .mockResolvedValue({ data: {} } as never);

      await service.getConversationMetadata(
        conversationPath,
        'test-token',
        'test-bucket',
      );

      expect(metadataSpy).toHaveBeenCalledWith(
        'test-bucket',
        conversationPath,
        expect.any(Object),
      );
    });
  });

  describe('DIAL SDK error status propagation', () => {
    beforeEach(async () => {
      const actual = await vi.importActual<
        typeof import('../../../common/dial/dial-error.mapper')
      >('../../../common/dial/dial-error.mapper');
      vi.mocked(handleDialSdkError).mockImplementation(
        actual.handleDialSdkError,
      );
    });

    it('getConversationMetadata throws NotFoundException for a 404 upstream response', async () => {
      vi.spyOn(
        service['dialClient'].client,
        'getConversationMetadata',
      ).mockResolvedValue({
        error: { message: 'Not found' },
        response: new Response(null, { status: 404 }),
      } as never);

      await expect(
        service.getConversationMetadata(
          'gpt-4o__Chat',
          'test-token',
          'test-bucket',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
