import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../../dial/dial-client.service';
import { PromptsResourceService } from '../prompts-resource.service';

const TOKEN = 'test-token';
const BUCKET = 'test-bucket';

const okResponse = (data: unknown) =>
  ({ data, response: { status: 200 } as Response }) as never;

const errResponse = (status: number) =>
  ({ error: {}, response: { status } as Response }) as never;

const metaUrl = (path: string, bucket = BUCKET) => `prompts/${bucket}/${path}`;
const metaItem = (path: string, bucket = BUCKET) => ({
  nodeType: 'ITEM',
  url: metaUrl(path, bucket),
  createdAt: 1000,
  updatedAt: 2000,
});

const storedPrompt = {
  id: 'my-prompt',
  name: 'My Prompt',
  description: 'A description',
  content: 'Hello {{name}}',
  folderId: '',
};

function makeService() {
  const dialClient = {
    client: {
      getPromptMetadata: vi.fn(),
      getPrompt: vi.fn(),
      savePrompt: vi.fn(),
    },
  } as unknown as DialClientService;

  const service = new PromptsResourceService(dialClient);
  return { service, dialClient };
}

describe('PromptsResourceService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPromptMetadataItem', () => {
    it('returns null when DIAL Core returns 404', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'getPromptMetadata').mockResolvedValue(
        errResponse(404),
      );

      const result = await service.getPromptMetadataItem(
        TOKEN,
        BUCKET,
        'my-prompt',
      );

      expect(result).toBeNull();
    });

    it('returns the metadata item when nodeType is ITEM', async () => {
      const { service, dialClient } = makeService();
      const item = metaItem('my-prompt');
      vi.spyOn(dialClient.client, 'getPromptMetadata').mockResolvedValue(
        okResponse(item),
      );

      const result = await service.getPromptMetadataItem(
        TOKEN,
        BUCKET,
        'my-prompt',
      );

      expect(result).toEqual(item);
    });

    it('handles a non-ITEM nodeType as an error', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'getPromptMetadata').mockResolvedValue(
        okResponse({ nodeType: 'FOLDER' }),
      );

      await expect(
        service.getPromptMetadataItem(TOKEN, BUCKET, 'my-prompt'),
      ).rejects.toThrow();
    });
  });

  describe('savePromptResource', () => {
    it('throws ConflictException on a 412 response', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'savePrompt').mockResolvedValue(
        errResponse(412),
      );

      await expect(
        service.savePromptResource(
          TOKEN,
          BUCKET,
          'my-prompt',
          storedPrompt,
          'prompts.createPrompt',
          true,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('returns the metadata item directly when the save response already carries it', async () => {
      const { service, dialClient } = makeService();
      const item = metaItem('my-prompt');
      vi.spyOn(dialClient.client, 'savePrompt').mockResolvedValue(
        okResponse(item),
      );

      const result = await service.savePromptResource(
        TOKEN,
        BUCKET,
        'my-prompt',
        storedPrompt,
        'prompts.createPrompt',
        true,
      );

      expect(result).toEqual(item);
    });

    it('falls back to getPromptMetadataItem when the save response omits ITEM metadata', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'savePrompt').mockResolvedValue(
        okResponse({ nodeType: 'FOLDER' }),
      );
      const item = metaItem('my-prompt');
      vi.spyOn(dialClient.client, 'getPromptMetadata').mockResolvedValue(
        okResponse(item),
      );

      const result = await service.savePromptResource(
        TOKEN,
        BUCKET,
        'my-prompt',
        storedPrompt,
        'prompts.createPrompt',
        true,
      );

      expect(result).toEqual(item);
    });
  });

  describe('readPromptByPath', () => {
    it('returns null when DIAL Core returns 404', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'getPrompt').mockResolvedValue(
        errResponse(404),
      );

      const result = await service.readPromptByPath(TOKEN, BUCKET, 'missing');

      expect(result).toBeNull();
    });

    it('maps the response using knownMetadata without an extra metadata fetch', async () => {
      const { service, dialClient } = makeService();
      const getPromptSpy = vi
        .spyOn(dialClient.client, 'getPrompt')
        .mockResolvedValue(okResponse(storedPrompt));
      const metadataSpy = vi.spyOn(dialClient.client, 'getPromptMetadata');

      const result = await service.readPromptByPath(
        TOKEN,
        BUCKET,
        'my-prompt',
        metaItem('my-prompt'),
      );

      expect(result).toMatchObject({ id: 'my-prompt', name: 'My Prompt' });
      expect(getPromptSpy).toHaveBeenCalledOnce();
      expect(metadataSpy).not.toHaveBeenCalled();
    });

    it('carries the author reported in the resource metadata', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'getPrompt').mockResolvedValue(
        okResponse(storedPrompt),
      );

      const result = await service.readPromptByPath(
        TOKEN,
        BUCKET,
        'my-prompt',
        {
          ...metaItem('my-prompt'),
          author: 'john.doe@example.com',
        },
      );

      expect(result?.author).toBe('john.doe@example.com');
    });

    it('leaves the author undefined when the metadata omits one', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'getPrompt').mockResolvedValue(
        okResponse(storedPrompt),
      );

      const result = await service.readPromptByPath(
        TOKEN,
        BUCKET,
        'my-prompt',
        metaItem('my-prompt'),
      );

      expect(result?.author).toBeUndefined();
    });

    it('fetches metadata when knownMetadata is not provided', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'getPrompt').mockResolvedValue(
        okResponse(storedPrompt),
      );
      vi.spyOn(dialClient.client, 'getPromptMetadata').mockResolvedValue(
        okResponse(metaItem('my-prompt')),
      );

      const result = await service.readPromptByPath(TOKEN, BUCKET, 'my-prompt');

      expect(result).toMatchObject({ id: 'my-prompt', name: 'My Prompt' });
    });
  });

  describe('listPromptMetadataItems', () => {
    it('returns an empty array when DIAL Core returns 404', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'getPromptMetadata').mockResolvedValue(
        errResponse(404),
      );

      const result = await service.listPromptMetadataItems(TOKEN, BUCKET, '');

      expect(result).toEqual([]);
    });

    it('loads every metadata page', async () => {
      const { service, dialClient } = makeService();
      const metadataSpy = vi
        .spyOn(dialClient.client, 'getPromptMetadata')
        .mockResolvedValueOnce(
          okResponse({
            items: [metaItem('first')],
            nextToken: 'next-page',
          }),
        )
        .mockResolvedValueOnce(okResponse({ items: [metaItem('second')] }));

      const result = await service.listPromptMetadataItems(TOKEN, BUCKET, '');

      expect(result.map((item) => item.url)).toEqual([
        metaUrl('first'),
        metaUrl('second'),
      ]);
      expect(metadataSpy).toHaveBeenCalledTimes(2);
      expect(metadataSpy).toHaveBeenNthCalledWith(
        1,
        BUCKET,
        '',
        expect.objectContaining({
          params: {
            query: {
              recursive: true,
              token: undefined,
              permissions: true,
            },
          },
        }),
      );
    });

    it('rejects a repeated page token instead of looping forever', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'getPromptMetadata').mockResolvedValue(
        okResponse({ items: [metaItem('first')], nextToken: 'same-token' }),
      );

      await expect(
        service.listPromptMetadataItems(TOKEN, BUCKET, ''),
      ).rejects.toThrow();
    });

    it('filters out non-ITEM entries', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'getPromptMetadata').mockResolvedValue(
        okResponse({
          items: [metaItem('first'), { nodeType: 'FOLDER', url: 'ignored' }],
        }),
      );

      const result = await service.listPromptMetadataItems(TOKEN, BUCKET, '');

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe(metaUrl('first'));
    });
  });
});
