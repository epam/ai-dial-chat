import type {
  PromptListResponseDto,
  PromptResponseDto,
  PublicPromptListResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { promptsApi } from '../api-client';
import {
  createPrompt,
  createPromptFolder,
  deletePrompt,
  deletePromptFolder,
  getPrompt,
  getPublicPrompt,
  listPrompts,
  listPublicPrompts,
  movePrompt,
  renamePromptFolder,
  updatePrompt,
} from '../prompts.api';

const mockPrompt: PromptResponseDto = {
  id: 'prompts/my-bucket/Work/AI/summarize',
  name: 'summarize',
  description: 'Summarize a document',
  content: 'Summarize the following text:',
  folderId: 'Work/AI',
  createdAt: 1700000000000,
  updatedAt: 1700000001000,
};

describe('prompts.api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('listPrompts delegates to the generated PromptsApi', async () => {
    const mockResponse: PromptListResponseDto = {
      prompts: [mockPrompt],
      folders: [{ id: 'Work', name: 'Work' }],
      sharedWithMe: [],
    };
    const spy = vi
      .spyOn(promptsApi, 'listPrompts')
      .mockResolvedValue(mockResponse);

    await expect(listPrompts()).resolves.toEqual(mockResponse);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('getPrompt passes the full resource id through as a query param object', async () => {
    const spy = vi.spyOn(promptsApi, 'getPrompt').mockResolvedValue(mockPrompt);

    await expect(
      getPrompt('prompts/my-bucket/Work/AI/summarize'),
    ).resolves.toEqual(mockPrompt);
    expect(spy).toHaveBeenCalledWith({
      id: 'prompts/my-bucket/Work/AI/summarize',
    });
  });

  it('createPrompt wraps the body in createPromptDto', async () => {
    const spy = vi
      .spyOn(promptsApi, 'createPrompt')
      .mockResolvedValue(mockPrompt);
    const body = {
      name: 'summarize',
      content: 'Summarize the following text:',
      folderId: 'Work/AI',
    };

    await createPrompt(body);

    expect(spy).toHaveBeenCalledWith({ createPromptDto: body });
  });

  it('updatePrompt sends only the supplied fields alongside the id', async () => {
    const spy = vi
      .spyOn(promptsApi, 'updatePrompt')
      .mockResolvedValue(mockPrompt);

    await updatePrompt('prompts/my-bucket/Work/AI/summarize', {
      content: 'Summarize in three bullets:',
    });

    expect(spy).toHaveBeenCalledWith({
      id: 'prompts/my-bucket/Work/AI/summarize',
      updatePromptDto: { content: 'Summarize in three bullets:' },
    });
  });

  it('deletePrompt resolves void', async () => {
    const spy = vi
      .spyOn(promptsApi, 'deletePrompt')
      .mockResolvedValue(undefined);

    await expect(
      deletePrompt('prompts/my-bucket/Work/AI/summarize'),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith({
      id: 'prompts/my-bucket/Work/AI/summarize',
    });
  });

  it('movePrompt sends an empty target folder when moving to root', async () => {
    const spy = vi.spyOn(promptsApi, 'movePrompt').mockResolvedValue({
      ...mockPrompt,
      id: 'prompts/my-bucket/summarize',
      folderId: '',
    });

    await movePrompt('prompts/my-bucket/Work/AI/summarize', {
      targetFolderId: '',
    });

    expect(spy).toHaveBeenCalledWith({
      id: 'prompts/my-bucket/Work/AI/summarize',
      movePromptDto: { targetFolderId: '' },
    });
  });

  it('listPublicPrompts delegates to the generated PromptsApi', async () => {
    const mockResponse: PublicPromptListResponseDto = {
      prompts: [mockPrompt],
      folders: [],
    };
    const spy = vi
      .spyOn(promptsApi, 'listPublicPrompts')
      .mockResolvedValue(mockResponse);

    await expect(listPublicPrompts()).resolves.toEqual(mockResponse);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('getPublicPrompt passes the path through', async () => {
    const spy = vi
      .spyOn(promptsApi, 'getPublicPrompt')
      .mockResolvedValue(mockPrompt);

    await getPublicPrompt('Public/summarize');

    expect(spy).toHaveBeenCalledWith({ path: 'Public/summarize' });
  });

  it('createPromptFolder wraps the body in createPromptFolderDto', async () => {
    const spy = vi
      .spyOn(promptsApi, 'createPromptFolder')
      .mockResolvedValue({ id: 'Work/AI', name: 'AI' });

    await createPromptFolder({ name: 'AI', parentId: 'Work' });

    expect(spy).toHaveBeenCalledWith({
      createPromptFolderDto: { name: 'AI', parentId: 'Work' },
    });
  });

  it('renamePromptFolder sends the path and the new name', async () => {
    const spy = vi.spyOn(promptsApi, 'renamePromptFolder').mockResolvedValue({
      id: 'Work/Machine Learning',
      name: 'Machine Learning',
    });

    await expect(
      renamePromptFolder('Work/AI', { name: 'Machine Learning' }),
    ).resolves.toEqual({
      id: 'Work/Machine Learning',
      name: 'Machine Learning',
    });
    expect(spy).toHaveBeenCalledWith({
      path: 'Work/AI',
      renamePromptFolderDto: { name: 'Machine Learning' },
    });
  });

  it('deletePromptFolder resolves void', async () => {
    const spy = vi
      .spyOn(promptsApi, 'deletePromptFolder')
      .mockResolvedValue(undefined);

    await expect(deletePromptFolder('Work/AI')).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith({ path: 'Work/AI' });
  });

  it('propagates a rejection unchanged instead of retrying or defaulting', async () => {
    const error = new Error('Request failed with status 409');
    vi.spyOn(promptsApi, 'createPrompt').mockRejectedValue(error);

    await expect(
      createPrompt({ name: 'summarize', content: 'x' }),
    ).rejects.toBe(error);
  });
});
