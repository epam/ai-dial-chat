import { describe, expect, it, vi } from 'vitest';
import { PromptService } from '../prompt.service';

/*
 * PromptService is a pure delegation facade — its business logic now lives
 * in PromptsPersonalService, PromptsPublicService, and PromptsFolderService
 * (see openspec/changes/split-prompt-service/design.md). These tests only
 * verify each facade method forwards to the right sub-service unchanged;
 * behavior is covered by that sub-service's own spec.
 */
describe('PromptService facade', () => {
  const makeService = () => {
    const personalService = {
      listPrompts: vi.fn().mockResolvedValue({
        prompts: ['personal'],
        folders: ['personal-folder'],
        sharedWithMe: ['shared'],
      }),
      getSharedPrompts: vi.fn().mockResolvedValue('personal-shared'),
      getPrompt: vi.fn().mockResolvedValue('personal-get'),
      createPrompt: vi.fn().mockResolvedValue('personal-create'),
      updatePrompt: vi.fn().mockResolvedValue('personal-update'),
      deletePrompt: vi.fn().mockResolvedValue(undefined),
    };
    const publicService = {
      listPublicPrompts: vi.fn().mockResolvedValue({
        prompts: ['public'],
        folders: ['public-folder'],
      }),
      getPublicPrompt: vi.fn().mockResolvedValue('public-get'),
    };
    const folderService = {
      createFolder: vi.fn().mockResolvedValue('folder-create'),
      renameFolder: vi.fn().mockResolvedValue('folder-rename'),
      deleteFolder: vi.fn().mockResolvedValue(undefined),
      movePrompt: vi.fn().mockResolvedValue('folder-move'),
    };

    const service = new PromptService(
      personalService as never,
      publicService as never,
      folderService as never,
    );

    return { service, personalService, publicService, folderService };
  };

  it('aggregates personal, shared, and public prompts', async () => {
    const { service, personalService, publicService } = makeService();

    const result = await service.listPrompts('token', 'bucket');

    expect(personalService.listPrompts).toHaveBeenCalledWith('token', 'bucket');
    expect(publicService.listPublicPrompts).toHaveBeenCalledWith('token');
    expect(result).toEqual({
      prompts: ['personal'],
      folders: ['personal-folder'],
      sharedWithMe: ['shared'],
      publicPrompts: ['public'],
      publicFolders: ['public-folder'],
    });
  });

  it('keeps personal prompts when the public namespace is unavailable', async () => {
    const { service, publicService } = makeService();
    publicService.listPublicPrompts.mockRejectedValue(new Error('down'));

    await expect(service.listPrompts('token', 'bucket')).resolves.toEqual({
      prompts: ['personal'],
      folders: ['personal-folder'],
      sharedWithMe: ['shared'],
      publicPrompts: [],
      publicFolders: [],
    });
  });

  it('delegates getSharedPrompts to PromptsPersonalService', async () => {
    const { service, personalService } = makeService();

    const result = await service.getSharedPrompts('token', 'bucket');

    expect(personalService.getSharedPrompts).toHaveBeenCalledWith(
      'token',
      'bucket',
    );
    expect(result).toBe('personal-shared');
  });

  it('delegates getPrompt to PromptsPersonalService', async () => {
    const { service, personalService } = makeService();

    const result = await service.getPrompt('token', 'bucket', 'my-prompt');

    expect(personalService.getPrompt).toHaveBeenCalledWith(
      'token',
      'bucket',
      'my-prompt',
    );
    expect(result).toBe('personal-get');
  });

  it('delegates createPrompt to PromptsPersonalService', async () => {
    const { service, personalService } = makeService();
    const dto = { name: 'my-prompt', content: 'Hello' } as never;

    const result = await service.createPrompt('token', 'bucket', dto);

    expect(personalService.createPrompt).toHaveBeenCalledWith(
      'token',
      'bucket',
      dto,
    );
    expect(result).toBe('personal-create');
  });

  it('delegates updatePrompt to PromptsPersonalService', async () => {
    const { service, personalService } = makeService();
    const dto = { name: 'renamed' } as never;

    const result = await service.updatePrompt(
      'token',
      'bucket',
      'my-prompt',
      dto,
    );

    expect(personalService.updatePrompt).toHaveBeenCalledWith(
      'token',
      'bucket',
      'my-prompt',
      dto,
    );
    expect(result).toBe('personal-update');
  });

  it('delegates deletePrompt to PromptsPersonalService', async () => {
    const { service, personalService } = makeService();

    await service.deletePrompt('token', 'bucket', 'my-prompt');

    expect(personalService.deletePrompt).toHaveBeenCalledWith(
      'token',
      'bucket',
      'my-prompt',
    );
  });

  it('delegates listPublicPrompts to PromptsPublicService', async () => {
    const { service, publicService } = makeService();

    const result = await service.listPublicPrompts('token');

    expect(publicService.listPublicPrompts).toHaveBeenCalledWith('token');
    expect(result).toEqual({
      prompts: ['public'],
      folders: ['public-folder'],
    });
  });

  it('delegates getPublicPrompt to PromptsPublicService', async () => {
    const { service, publicService } = makeService();

    const result = await service.getPublicPrompt('token', 'org-prompt');

    expect(publicService.getPublicPrompt).toHaveBeenCalledWith(
      'token',
      'org-prompt',
    );
    expect(result).toBe('public-get');
  });

  it('delegates createFolder to PromptsFolderService', async () => {
    const { service, folderService } = makeService();
    const dto = { name: 'AI' } as never;

    const result = await service.createFolder('token', 'bucket', dto);

    expect(folderService.createFolder).toHaveBeenCalledWith(
      'token',
      'bucket',
      dto,
    );
    expect(result).toBe('folder-create');
  });

  it('delegates renameFolder to PromptsFolderService', async () => {
    const { service, folderService } = makeService();
    const dto = { name: 'NewName' } as never;

    const result = await service.renameFolder(
      'token',
      'bucket',
      'OldName',
      dto,
    );

    expect(folderService.renameFolder).toHaveBeenCalledWith(
      'token',
      'bucket',
      'OldName',
      dto,
    );
    expect(result).toBe('folder-rename');
  });

  it('delegates deleteFolder to PromptsFolderService', async () => {
    const { service, folderService } = makeService();

    await service.deleteFolder('token', 'bucket', 'AI');

    expect(folderService.deleteFolder).toHaveBeenCalledWith(
      'token',
      'bucket',
      'AI',
    );
  });

  it('delegates movePrompt to PromptsFolderService', async () => {
    const { service, folderService } = makeService();
    const dto = { targetFolderId: 'work' } as never;

    const result = await service.movePrompt(
      'token',
      'bucket',
      'my-prompt',
      dto,
    );

    expect(folderService.movePrompt).toHaveBeenCalledWith(
      'token',
      'bucket',
      'my-prompt',
      dto,
    );
    expect(result).toBe('folder-move');
  });
});
