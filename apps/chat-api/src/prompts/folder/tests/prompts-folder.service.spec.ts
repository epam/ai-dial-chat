import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../../dial/dial-client.service';
import { PromptsResourceService } from '../../resource/prompts-resource.service';
import { PromptsFolderService } from '../prompts-folder.service';

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
    },
  } as unknown as DialClientService;

  const resourceService = new PromptsResourceService(dialClient);
  const service = new PromptsFolderService(dialClient, resourceService);
  return { service, resourceService };
}

describe('PromptsFolderService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  /* ------------------------------------------------------------------ */
  /* createFolder                                                       */
  /* ------------------------------------------------------------------ */

  describe('createFolder', () => {
    it('writes a sentinel file and returns the folder DTO', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getPromptMetadata',
      ).mockResolvedValue(errResponse(404));
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'savePrompt')
        .mockResolvedValue(writeOk('AI/.folder'));

      const result = await service.createFolder(TOKEN, BUCKET, { name: 'AI' });

      expect(result).toEqual({ id: 'AI', name: 'AI' });
      expect(saveSpy).toHaveBeenCalledWith(
        BUCKET,
        'AI/.folder',
        expect.objectContaining({
          headers: expect.objectContaining({ 'If-None-Match': '*' }),
        }),
      );
    });

    it('creates a nested folder when parentId is supplied', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getPromptMetadata',
      ).mockResolvedValue(errResponse(404));
      vi.spyOn(service['dialClient'].client, 'savePrompt').mockResolvedValue(
        writeOk(),
      );

      const result = await service.createFolder(TOKEN, BUCKET, {
        name: 'AI',
        parentId: 'Work',
      });

      expect(result).toEqual({ id: 'Work/AI', name: 'AI' });
    });

    it('throws ConflictException when the folder sentinel already exists', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'savePrompt').mockResolvedValue(
        errResponse(412),
      );

      await expect(
        service.createFolder(TOKEN, BUCKET, { name: 'AI' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  /* ------------------------------------------------------------------ */
  /* renameFolder                                                       */
  /* ------------------------------------------------------------------ */

  describe('renameFolder', () => {
    it('moves all files to the new prefix and returns the updated folder DTO', async () => {
      const { service } = makeService();
      const sentinelItem = metaItem('OldName/.folder');
      vi.spyOn(service['dialClient'].client, 'getPromptMetadata')
        .mockResolvedValueOnce(
          okResponse({ items: [sentinelItem] }),
        ) /* old folder exists */
        .mockResolvedValueOnce(
          okResponse({ items: [] }),
        ); /* new folder empty */
      vi.spyOn(service['dialClient'].client, 'savePrompt').mockResolvedValue(
        writeOk(),
      );
      vi.spyOn(service['dialClient'].client, 'deletePrompt').mockResolvedValue(
        writeOk(),
      );

      const result = await service.renameFolder(TOKEN, BUCKET, 'OldName', {
        name: 'NewName',
      });

      expect(result).toEqual({ id: 'NewName', name: 'NewName' });
    });

    it('throws NotFoundException when the source folder does not exist', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getPromptMetadata',
      ).mockResolvedValue(errResponse(404));

      await expect(
        service.renameFolder(TOKEN, BUCKET, 'NonExistent', { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when the target folder already has content', async () => {
      const { service } = makeService();
      const item = metaItem('OldName/prompt');
      vi.spyOn(service['dialClient'].client, 'getPromptMetadata')
        .mockResolvedValueOnce(
          okResponse({ items: [item] }),
        ) /* old folder has files */
        .mockResolvedValueOnce(
          okResponse({ items: [item] }),
        ); /* new folder also has files */

      await expect(
        service.renameFolder(TOKEN, BUCKET, 'OldName', { name: 'NewName' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  /* ------------------------------------------------------------------ */
  /* deleteFolder                                                       */
  /* ------------------------------------------------------------------ */

  describe('deleteFolder', () => {
    it('deletes all files under the folder prefix', async () => {
      const { service } = makeService();
      const items = [metaItem('AI/prompt-a'), metaItem('AI/.folder')];
      vi.spyOn(
        service['dialClient'].client,
        'getPromptMetadata',
      ).mockResolvedValue(okResponse({ items }));
      const deleteSpy = vi
        .spyOn(service['dialClient'].client, 'deletePrompt')
        .mockResolvedValue(writeOk());

      await service.deleteFolder(TOKEN, BUCKET, 'AI');

      expect(deleteSpy).toHaveBeenCalledTimes(2);
    });

    it('throws NotFoundException when the folder does not exist', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getPromptMetadata',
      ).mockResolvedValue(errResponse(404));

      await expect(service.deleteFolder(TOKEN, BUCKET, 'AI')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('fails when any folder item cannot be deleted', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getPromptMetadata',
      ).mockResolvedValue(okResponse({ items: [metaItem('AI/prompt-a')] }));
      vi.spyOn(service['dialClient'].client, 'deletePrompt').mockResolvedValue(
        errResponse(502),
      );

      await expect(service.deleteFolder(TOKEN, BUCKET, 'AI')).rejects.toThrow(
        BadGatewayException,
      );
    });
  });

  /* ------------------------------------------------------------------ */
  /* movePrompt                                                         */
  /* ------------------------------------------------------------------ */

  describe('movePrompt', () => {
    it('writes to the target path and deletes the source', async () => {
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

      const result = await service.movePrompt(TOKEN, BUCKET, 'my-prompt', {
        targetFolderId: 'work',
      });

      expect(result).toMatchObject({ id: 'work/my-prompt', folderId: 'work' });
      expect(deleteSpy).toHaveBeenCalledOnce();
      expect(service['dialClient'].client.savePrompt).toHaveBeenCalledWith(
        BUCKET,
        'work/my-prompt',
        expect.objectContaining({
          headers: expect.objectContaining({ 'If-None-Match': '*' }),
        }),
      );
    });

    it('throws ConflictException when a prompt already exists at the target path', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getPrompt').mockResolvedValue(
        okResponse(storedPrompt),
      );
      vi.spyOn(service['dialClient'].client, 'savePrompt').mockResolvedValue(
        errResponse(412),
      );

      await expect(
        service.movePrompt(TOKEN, BUCKET, 'my-prompt', {
          targetFolderId: 'work',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when the source prompt does not exist', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getPrompt').mockResolvedValue(
        errResponse(404),
      );

      await expect(
        service.movePrompt(TOKEN, BUCKET, 'missing', { targetFolderId: '' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('fails the move when deleting the source fails', async () => {
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
        service.movePrompt(TOKEN, BUCKET, 'my-prompt', {
          targetFolderId: 'work',
        }),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});
