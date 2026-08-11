import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../../dial/dial-client.service';
import { PromptsResourceService } from '../../resource/prompts-resource.service';
import { PromptsPublicService } from '../prompts-public.service';

const TOKEN = 'test-token';
const PUBLIC_BUCKET = 'public';

const okResponse = (data: unknown) =>
  ({ data, response: { status: 200 } as Response }) as never;

const errResponse = (status: number) =>
  ({ error: {}, response: { status } as Response }) as never;

const storedPrompt = {
  id: 'my-prompt',
  name: 'My Prompt',
  description: 'A description',
  content: 'Hello {{name}}',
  folderId: '',
};

const metaUrl = (path: string, bucket = PUBLIC_BUCKET) =>
  `prompts/${bucket}/${path}`;
const metaItem = (path: string, bucket = PUBLIC_BUCKET) => ({
  nodeType: 'ITEM',
  url: metaUrl(path, bucket),
  createdAt: 1000,
  updatedAt: 2000,
});

function makeService() {
  const dialClient = {
    client: {
      getPromptMetadata: vi.fn(),
      getPrompt: vi.fn(),
    },
  } as unknown as DialClientService;

  const resourceService = new PromptsResourceService(dialClient);
  const service = new PromptsPublicService(dialClient, resourceService);
  return { service, resourceService };
}

describe('PromptsPublicService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  /* listPublicPrompts / getPublicPrompt                                */
  /* ------------------------------------------------------------------ */

  describe('listPublicPrompts', () => {
    it('returns prompts and folders from the public bucket', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getPromptMetadata',
      ).mockResolvedValue(
        okResponse({
          items: [{ ...metaItem('org-prompt', 'public') }],
        }),
      );
      vi.spyOn(service['dialClient'].client, 'getPrompt').mockResolvedValue(
        okResponse({
          ...storedPrompt,
          id: 'org-prompt',
          name: 'org-prompt',
          folderId: '',
        }),
      );

      const result = await service.listPublicPrompts(TOKEN);

      expect(result.prompts).toHaveLength(1);
      expect(result.prompts[0].id).toBe('org-prompt');
      expect(result.folders).toEqual([]);
    });
  });

  describe('getPublicPrompt', () => {
    it('returns the public prompt when found', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getPrompt').mockResolvedValue(
        okResponse({ ...storedPrompt, id: 'org-prompt' }),
      );
      vi.spyOn(
        service['dialClient'].client,
        'getPromptMetadata',
      ).mockResolvedValue(okResponse(metaItem('org-prompt', 'public')));

      const result = await service.getPublicPrompt(TOKEN, 'org-prompt');

      expect(result).toMatchObject({ id: 'org-prompt', name: 'My Prompt' });
    });

    it('throws NotFoundException when the public prompt does not exist', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getPrompt').mockResolvedValue(
        errResponse(404),
      );

      await expect(service.getPublicPrompt(TOKEN, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadGatewayException on a 5xx upstream error', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getPrompt').mockResolvedValue(
        errResponse(502),
      );

      await expect(
        service.getPublicPrompt(TOKEN, 'org-prompt'),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});
