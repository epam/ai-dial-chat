import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { PromptService } from '../prompt.service';

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

  const service = new PromptService(dialClient);
  return { service };
}

describe('PromptService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  /* ------------------------------------------------------------------ */
  /* listPrompts                                                        */
  /* ------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------ */
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
