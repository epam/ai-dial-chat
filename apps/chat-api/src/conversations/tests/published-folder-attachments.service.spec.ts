import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishedFolderAttachmentsService } from '../published-folder-attachments.service';
import type { ConversationAttachmentView } from '../utils/conversation-attachments.util';

const conversationWithFolder = (url: string): ConversationAttachmentView => ({
  messages: [{ custom_content: { attachments: [{ title: 'docs', url }] } }],
});

const listing = (status: number, items: unknown[] = []) =>
  ({
    data: status < 300 ? { items } : undefined,
    response: { status } as Response,
  }) as never;

const makeService = () => {
  const dialClient = {
    client: { getFileMetadata: vi.fn() },
  };
  const cache = new Map<string, unknown>();
  const cacheManager = {
    get: vi.fn(async (key: string) => cache.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      cache.set(key, value);
    }),
  };
  const service = new PublishedFolderAttachmentsService(
    dialClient as never,
    cacheManager as never,
  );
  return { service, dialClient, cacheManager };
};

const attachmentUrl = (conversation: ConversationAttachmentView) =>
  conversation.messages?.[0].custom_content?.attachments?.[0].url;

describe('PublishedFolderAttachmentsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('leaves a conversation from the user bucket untouched without any Core call', async () => {
    const { service, dialClient } = makeService();
    const conversation = conversationWithFolder('files/b/docs/');

    const result = await service.resolve(
      conversation,
      'test-bucket/my-chat',
      'token',
      'test-bucket',
    );

    expect(result).toBe(conversation);
    expect(dialClient.client.getFileMetadata).not.toHaveBeenCalled();
  });

  it('rewrites a folder attachment of a public conversation when its published folder holds files', async () => {
    const { service, dialClient } = makeService();
    dialClient.client.getFileMetadata.mockResolvedValue(
      listing(200, [{ name: 'a.pdf' }]),
    );

    const result = await service.resolve(
      conversationWithFolder('files/author/docs/'),
      'public/Org/Data%20Science/my-chat',
      'token',
      'test-bucket',
    );

    expect(attachmentUrl(result)).toBe(
      'files/public/Org/Data%20Science/my-chat/author/docs/',
    );
    expect(dialClient.client.getFileMetadata).toHaveBeenCalledWith(
      'public',
      'Org/Data%20Science/my-chat/author/docs/',
      expect.objectContaining({
        params: { query: { limit: 1, recursive: false } },
      }),
    );
  });

  it('keeps the folder url when nothing was published there', async () => {
    const { service, dialClient } = makeService();
    dialClient.client.getFileMetadata.mockResolvedValue(listing(404));

    const result = await service.resolve(
      conversationWithFolder('files/third-user/shared/'),
      'public/Org/my-chat',
      'token',
      'test-bucket',
    );

    expect(attachmentUrl(result)).toBe('files/third-user/shared/');
  });

  it('treats an empty listing as not published', async () => {
    const { service, dialClient } = makeService();
    dialClient.client.getFileMetadata.mockResolvedValue(listing(200, []));

    const result = await service.resolve(
      conversationWithFolder('files/author/docs/'),
      'public/Org/my-chat',
      'token',
      'test-bucket',
    );

    expect(attachmentUrl(result)).toBe('files/author/docs/');
  });

  it('remembers the answer so a second read makes no Core call', async () => {
    const { service, dialClient } = makeService();
    dialClient.client.getFileMetadata.mockResolvedValue(
      listing(200, [{ name: 'a.pdf' }]),
    );
    const conversation = conversationWithFolder('files/author/docs/');

    await service.resolve(conversation, 'public/Org/my-chat', 't', 'b');
    await service.resolve(conversation, 'public/Org/my-chat', 't', 'b');

    expect(dialClient.client.getFileMetadata).toHaveBeenCalledOnce();
  });

  it('rewrites a file reference when its published copy exists', async () => {
    const { service, dialClient } = makeService();
    dialClient.client.getFileMetadata.mockResolvedValue({
      data: { name: 'a.pdf' },
      response: { status: 200 } as Response,
    } as never);

    const result = await service.resolve(
      conversationWithFolder('files/author/out/a.pdf#page=2'),
      'public/Org/my-chat',
      'token',
      'test-bucket',
    );

    expect(attachmentUrl(result)).toBe(
      'files/public/Org/my-chat/author/out/a.pdf#page=2',
    );
  });

  it('fails the read, and caches nothing, when the lookup throws', async () => {
    const { service, dialClient, cacheManager } = makeService();
    dialClient.client.getFileMetadata.mockRejectedValue(new TypeError('down'));

    await expect(
      service.resolve(
        conversationWithFolder('files/author/docs/'),
        'public/Org/my-chat',
        'token',
        'test-bucket',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(cacheManager.set).not.toHaveBeenCalled();
  });

  it('fails the read, and caches nothing, on a non-404 error status', async () => {
    const { service, dialClient, cacheManager } = makeService();
    dialClient.client.getFileMetadata.mockResolvedValue(listing(503));

    await expect(
      service.resolve(
        conversationWithFolder('files/author/docs/'),
        'public/Org/my-chat',
        'token',
        'test-bucket',
      ),
    ).rejects.toBeInstanceOf(HttpException);
    expect(cacheManager.set).not.toHaveBeenCalled();
  });
});
