import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../../dial/dial-client.service';
import { PromptsResourceService } from '../../resource/prompts-resource.service';
import { PromptsPersonalService } from '../prompts-personal.service';

const TOKEN = 'test-token';
const BUCKET = 'test-bucket';

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

const metaUrl = (path: string, bucket = BUCKET) => `prompts/${bucket}/${path}`;
const metaItem = (path: string, bucket = BUCKET) => ({
  nodeType: 'ITEM',
  url: metaUrl(path, bucket),
  createdAt: 1000,
  updatedAt: 2000,
});
const writeOk = (path = 'my-prompt', bucket = BUCKET) =>
  okResponse(metaItem(path, bucket));

function makeService() {
  const dialClient = {
    client: {
      getPromptMetadata: vi.fn(),
      getPrompt: vi.fn(),
      savePrompt: vi.fn(),
      deletePrompt: vi.fn(),
      getSharedResources: vi.fn(),
    },
  } as unknown as DialClientService;

  const resourceService = new PromptsResourceService(dialClient);
  const service = new PromptsPersonalService(dialClient, resourceService);
  return { service, resourceService };
}

describe('PromptsPersonalService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('listPrompts', () => {
    it('returns empty lists when the bucket has no prompts', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getPromptMetadata',
      ).mockResolvedValue(errResponse(404));
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue(okResponse({ resources: [] }));

      const result = await service.listPrompts(TOKEN, BUCKET);

      expect(result).toEqual({ prompts: [], folders: [], sharedWithMe: [] });
    });

    it('returns mapped prompts and derives folder hierarchy from prompt ids', async () => {
      const { service } = makeService();
      const metadataSpy = vi
        .spyOn(service['dialClient'].client, 'getPromptMetadata')
        .mockResolvedValue(okResponse({ items: [metaItem('work/meeting')] }));
      vi.spyOn(service['dialClient'].client, 'getPrompt').mockResolvedValue(
        okResponse({
          ...storedPrompt,
          id: 'work/meeting',
          name: 'meeting',
          folderId: 'work',
        }),
      );
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue(okResponse({ resources: [] }));

      const result = await service.listPrompts(TOKEN, BUCKET);

      expect(result.prompts).toHaveLength(1);
      expect(result.prompts[0]).toMatchObject({
        id: 'work/meeting',
        name: 'meeting',
      });
      expect(result.folders).toEqual([{ id: 'work', name: 'work' }]);
      expect(result.sharedWithMe).toEqual([]);
      expect(metadataSpy).toHaveBeenCalledWith(BUCKET, '', expect.any(Object));
    });

    it('includes empty folders represented by sentinel files', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getPromptMetadata',
      ).mockResolvedValue(okResponse({ items: [metaItem('Work/AI/.folder')] }));
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue(okResponse({ resources: [] }));

      const result = await service.listPrompts(TOKEN, BUCKET);

      expect(result.prompts).toEqual([]);
      expect(result.folders).toEqual([
        { id: 'Work', name: 'Work' },
        { id: 'Work/AI', name: 'AI' },
      ]);
    });

    it('loads every metadata page', async () => {
      const { service } = makeService();
      const metadataSpy = vi
        .spyOn(service['dialClient'].client, 'getPromptMetadata')
        .mockResolvedValueOnce(
          okResponse({
            items: [metaItem('first')],
            nextToken: 'next-page',
          }),
        )
        .mockResolvedValueOnce(okResponse({ items: [metaItem('second')] }));
      vi.spyOn(service['dialClient'].client, 'getPrompt')
        .mockResolvedValueOnce(okResponse({ ...storedPrompt, id: 'first' }))
        .mockResolvedValueOnce(okResponse({ ...storedPrompt, id: 'second' }));
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue(okResponse({ resources: [] }));

      const result = await service.listPrompts(TOKEN, BUCKET);

      expect(result.prompts.map(({ id }) => id)).toEqual(['first', 'second']);
      expect(metadataSpy).toHaveBeenCalledTimes(2);
      expect(metadataSpy.mock.calls[1][2]).toMatchObject({
        params: { query: { token: 'next-page' } },
      });
    });
  });

  describe('getSharedPrompts', () => {
    it('reads a full shared prompt resource URL without adding a namespace segment', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue(
        okResponse({
          resources: [metaItem('Shared/greeting', 'owner-bucket')],
        }),
      );
      const getPromptSpy = vi
        .spyOn(service['dialClient'].client, 'getPrompt')
        .mockResolvedValue(okResponse(storedPrompt));
      vi.spyOn(
        service['dialClient'].client,
        'getPromptMetadata',
      ).mockResolvedValue(
        okResponse(metaItem('Shared/greeting', 'owner-bucket')),
      );

      const result = await service.getSharedPrompts(TOKEN, BUCKET);

      expect(result[0]).toMatchObject({
        id: 'Shared/greeting',
        createdAt: 1000,
        updatedAt: 2000,
      });
      expect(getPromptSpy).toHaveBeenCalledWith(
        'owner-bucket',
        'Shared/greeting',
        expect.any(Object),
      );
    });
  });

  /* ------------------------------------------------------------------ */
  /* getPrompt                                                          */
  /* ------------------------------------------------------------------ */

  describe('getPrompt', () => {
    it('returns the mapped PromptResponseDto when the prompt exists', async () => {
      const { service } = makeService();
      const getPromptSpy = vi
        .spyOn(service['dialClient'].client, 'getPrompt')
        .mockResolvedValue(okResponse(storedPrompt));
      vi.spyOn(
        service['dialClient'].client,
        'getPromptMetadata',
      ).mockResolvedValue(okResponse(metaItem('my-prompt')));

      const result = await service.getPrompt(TOKEN, BUCKET, 'my-prompt');

      expect(result).toMatchObject({
        id: 'my-prompt',
        name: 'My Prompt',
        content: 'Hello {{name}}',
        folderId: '',
        createdAt: 1000,
        updatedAt: 2000,
      });
      expect(getPromptSpy).toHaveBeenCalledWith(
        BUCKET,
        'my-prompt',
        expect.any(Object),
      );
    });

    it('throws NotFoundException when DIAL Core returns 404', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getPrompt').mockResolvedValue(
        errResponse(404),
      );

      await expect(service.getPrompt(TOKEN, BUCKET, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  /* ------------------------------------------------------------------ */
  /* createPrompt                                                       */
  /* ------------------------------------------------------------------ */

  describe('createPrompt', () => {
    it('writes the prompt to DIAL Core and returns the created PromptResponseDto', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getPromptMetadata',
      ).mockResolvedValue(errResponse(404));
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'savePrompt')
        .mockResolvedValue(writeOk('My Prompt'));

      const result = await service.createPrompt(TOKEN, BUCKET, {
        name: 'My Prompt',
        content: 'Hello {{name}}',
      });

      expect(result).toMatchObject({
        id: 'My Prompt',
        name: 'My Prompt',
        content: 'Hello {{name}}',
      });
      expect(saveSpy).toHaveBeenCalledWith(
        BUCKET,
        'My%20Prompt',
        expect.objectContaining({
          headers: expect.objectContaining({ 'If-None-Match': '*' }),
        }),
      );
      expect(saveSpy.mock.calls[0][2].body).not.toHaveProperty('createdAt');
      expect(saveSpy.mock.calls[0][2].body).not.toHaveProperty('updatedAt');
    });

    it('creates a prompt with a folderId path prefix', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getPromptMetadata',
      ).mockResolvedValue(errResponse(404));
      vi.spyOn(service['dialClient'].client, 'savePrompt').mockResolvedValue(
        writeOk('Work/AI/greeting'),
      );

      const result = await service.createPrompt(TOKEN, BUCKET, {
        name: 'greeting',
        content: 'Hi',
        folderId: 'Work/AI',
      });

      expect(result).toMatchObject({
        id: 'Work/AI/greeting',
        folderId: 'Work/AI',
      });
    });

    it('throws ConflictException when a prompt already exists at that path', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'savePrompt').mockResolvedValue(
        errResponse(412),
      );

      await expect(
        service.createPrompt(TOKEN, BUCKET, {
          name: 'My Prompt',
          content: 'Hi',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('propagates an upstream create failure', async () => {
      const { service } = makeService();
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'savePrompt')
        .mockResolvedValue(errResponse(502));

      await expect(
        service.createPrompt(TOKEN, BUCKET, {
          name: 'My Prompt',
          content: 'Hi',
        }),
      ).rejects.toThrow(BadGatewayException);
      expect(saveSpy).toHaveBeenCalledOnce();
    });
  });

  /* ------------------------------------------------------------------ */
  /* updatePrompt                                                       */
  /* ------------------------------------------------------------------ */

  describe('updatePrompt', () => {
    it('updates the prompt content in place when no name change', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getPrompt').mockResolvedValue(
        okResponse(storedPrompt),
      );
      vi.spyOn(service['dialClient'].client, 'savePrompt').mockResolvedValue(
        writeOk('my-prompt'),
      );

      const result = await service.updatePrompt(TOKEN, BUCKET, 'my-prompt', {
        content: 'Updated',
      });

      expect(result).toMatchObject({ id: 'my-prompt', content: 'Updated' });
    });

    it('renames by writing to the new path and deleting the old one', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getPrompt').mockResolvedValue(
        okResponse(storedPrompt),
      );
      vi.spyOn(
        service['dialClient'].client,
        'getPromptMetadata',
      ).mockResolvedValue(errResponse(404));
      vi.spyOn(service['dialClient'].client, 'savePrompt').mockResolvedValue(
        writeOk(),
      );
      const deleteSpy = vi
        .spyOn(service['dialClient'].client, 'deletePrompt')
        .mockResolvedValue(writeOk());

      const result = await service.updatePrompt(TOKEN, BUCKET, 'my-prompt', {
        name: 'renamed-prompt',
      });

      expect(result.id).toBe('renamed-prompt');
      expect(deleteSpy).toHaveBeenCalledOnce();
    });

    it('throws ConflictException when the rename target already exists', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getPrompt').mockResolvedValue(
        okResponse(storedPrompt),
      );
      vi.spyOn(service['dialClient'].client, 'savePrompt').mockResolvedValue(
        errResponse(412),
      );

      await expect(
        service.updatePrompt(TOKEN, BUCKET, 'my-prompt', { name: 'other' }),
      ).rejects.toThrow(ConflictException);
    });

    it('fails the rename when deleting the source fails', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getPrompt').mockResolvedValue(
        okResponse(storedPrompt),
      );
      vi.spyOn(
        service['dialClient'].client,
        'getPromptMetadata',
      ).mockResolvedValue(errResponse(404));
      vi.spyOn(service['dialClient'].client, 'savePrompt').mockResolvedValue(
        writeOk(),
      );
      vi.spyOn(service['dialClient'].client, 'deletePrompt').mockResolvedValue(
        errResponse(502),
      );

      await expect(
        service.updatePrompt(TOKEN, BUCKET, 'my-prompt', {
          name: 'renamed-prompt',
        }),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  /* ------------------------------------------------------------------ */
  /* deletePrompt                                                       */
  /* ------------------------------------------------------------------ */

  describe('deletePrompt', () => {
    it('deletes the prompt and resolves without a value', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getPromptMetadata',
      ).mockResolvedValue(okResponse(metaItem('my-prompt')));
      vi.spyOn(service['dialClient'].client, 'deletePrompt').mockResolvedValue(
        writeOk(),
      );

      await expect(
        service.deletePrompt(TOKEN, BUCKET, 'my-prompt'),
      ).resolves.toBeUndefined();
    });

    it('throws NotFoundException when the prompt does not exist', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getPromptMetadata',
      ).mockResolvedValue(errResponse(404));

      await expect(
        service.deletePrompt(TOKEN, BUCKET, 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
