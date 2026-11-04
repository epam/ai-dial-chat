import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listPrompts,
  movePrompt,
  updatePrompt,
} from '../../../server-api/prompts.api';
import { createPromptSaveAdapter, listPromptFolders } from '../prompt';

vi.mock('../../../server-api/prompts.api', () => ({
  listPrompts: vi.fn(),
  movePrompt: vi.fn(),
  updatePrompt: vi.fn(),
}));

const ID = 'prompts/b1/Work/AI/Summarize';

describe('listPromptFolders', () => {
  beforeEach(() => {
    vi.mocked(listPrompts).mockResolvedValue({
      prompts: [],
      sharedWithMe: [],
      folders: [
        { id: 'Archive', name: 'Archive', prompts: [] },
        { id: 'Work', name: 'Work', prompts: [] },
        { id: 'Work/AI', name: 'AI', prompts: [] },
        { id: 'Work/AI/Deep', name: 'Deep', prompts: [] },
      ],
    } as never);
  });

  it('lists the root level', async () => {
    await expect(listPromptFolders('')).resolves.toEqual({
      folders: [
        { name: 'Archive', path: 'Archive' },
        { name: 'Work', path: 'Work' },
      ],
    });
  });

  it('lists only the direct children of a folder', async () => {
    await expect(listPromptFolders('Work')).resolves.toEqual({
      folders: [{ name: 'AI', path: 'Work/AI' }],
    });
  });
});

describe('createPromptSaveAdapter', () => {
  const body = { name: 'Summarize', description: '', content: 'x' };
  const adapter = createPromptSaveAdapter({ promptId: ID, body });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is unversioned and offers no new-version write', () => {
    expect(adapter.isVersioned).toBe(false);
    expect(adapter.saveAsNewVersion).toBeUndefined();
  });

  it('updates the prompt in place and returns the updated id', async () => {
    vi.mocked(updatePrompt).mockResolvedValue({
      id: 'prompts/b1/Work/AI/Summary',
    } as never);
    await expect(adapter.saveInPlace()).resolves.toEqual(
      expect.objectContaining({ id: 'prompts/b1/Work/AI/Summary' }),
    );
    expect(updatePrompt).toHaveBeenCalledWith(ID, body);
  });

  it('moves a prompt by its target folder id', async () => {
    vi.mocked(movePrompt).mockResolvedValue({
      id: 'prompts/b1/Archive/Summarize',
    } as never);
    await adapter.move(ID, ['Archive']);
    expect(movePrompt).toHaveBeenCalledWith(ID, { targetFolderId: 'Archive' });
  });
});
