import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishedFolderAttachmentsService } from '../published-folder-attachments.service';

const conversationWithFolder = (url: string) => ({
  name: 'chat',
  messages: [
    {
      role: 'user',
      content: 'hi',
      custom_content: { attachments: [{ title: 'docs', url }] },
    },
  ],
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

const attachmentUrl = (conversation: unknown): string =>
  (
    conversation as {
      messages: { custom_content: { attachments: { url: string }[] } }[];
    }
  ).messages[0].custom_content.attachments[0].url;

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
      'files/public/Org/Data%20Science/my-chat/docs/',
    );
    expect(dialClient.client.getFileMetadata).toHaveBeenCalledWith(
      'public',
      'Org/Data%20Science/my-chat/docs/',
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

  it('does not cache a failed lookup and keeps the stored url', async () => {
    const { service, dialClient, cacheManager } = makeService();
    dialClient.client.getFileMetadata.mockRejectedValue(new Error('down'));

    const result = await service.resolve(
      conversationWithFolder('files/author/docs/'),
      'public/Org/my-chat',
      'token',
      'test-bucket',
    );

    expect(attachmentUrl(result)).toBe('files/author/docs/');
    expect(cacheManager.set).not.toHaveBeenCalled();
  });

  it('does not cache an unexpected non-404 error status', async () => {
    const { service, dialClient, cacheManager } = makeService();
    dialClient.client.getFileMetadata.mockResolvedValue(listing(503));

    await service.resolve(
      conversationWithFolder('files/author/docs/'),
      'public/Org/my-chat',
      'token',
      'test-bucket',
    );

    expect(cacheManager.set).not.toHaveBeenCalled();
  });
});
