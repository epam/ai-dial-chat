import type { ToolsetBodyDto } from '@epam/ai-dial-chat-api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceSaveError } from '../resource-save';
import {
  createEmbeddedApplicationSaveAdapter,
  createHostApplicationSaveAdapter,
  createPromptCreateAdapter,
  createPromptFolderLister,
  createPromptSaveAdapter,
  createSkillFolderLister,
  createToolsetCreateAdapter,
  createToolsetSaveAdapter,
} from '../resource-save-adapters';

const APP_ID = 'applications/b1/agent__1.0.0';
const SNAPSHOT = 'applications/b1/Design/agent__1.1.0';

const applicationsApi = {
  moveApplication: vi.fn(),
  forkApplicationVersion: vi.fn(),
  commitApplicationVersion: vi.fn(),
  deleteApplication: vi.fn(),
};
const toolsetsApi = {
  updateToolset: vi.fn(),
  createToolset: vi.fn(),
  moveToolset: vi.fn(),
};
const skillsApi = { listSkills: vi.fn() };
const promptsApi = {
  listPrompts: vi.fn(),
  createPrompt: vi.fn(),
  updatePrompt: vi.fn(),
  movePrompt: vi.fn(),
};

describe('resource save adapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createEmbeddedApplicationSaveAdapter', () => {
    const runEmbeddedSave = vi.fn();
    const adapter = createEmbeddedApplicationSaveAdapter({
      applicationsApi,
      applicationId: APP_ID,
      runEmbeddedSave,
      getCommitFailedMessage: (version) => `commit failed ${version}`,
    });

    beforeEach(() => {
      runEmbeddedSave.mockResolvedValue(undefined);
      applicationsApi.forkApplicationVersion.mockResolvedValue({
        id: SNAPSHOT,
      });
      applicationsApi.commitApplicationVersion.mockResolvedValue({
        id: SNAPSHOT,
      });
      applicationsApi.deleteApplication.mockResolvedValue(undefined);
    });

    it('saves in place through the embedded editor', async () => {
      await expect(adapter.saveInPlace()).resolves.toEqual({ id: APP_ID });
      expect(runEmbeddedSave).toHaveBeenCalledOnce();
    });

    it('forks, saves, then commits a new version', async () => {
      const order: string[] = [];
      applicationsApi.forkApplicationVersion.mockImplementation(async () => {
        order.push('fork');
        return { id: SNAPSHOT };
      });
      runEmbeddedSave.mockImplementation(async () => {
        order.push('save');
      });
      applicationsApi.commitApplicationVersion.mockImplementation(async () => {
        order.push('commit');
        return { id: SNAPSHOT };
      });

      await expect(
        adapter.saveAsNewVersion?.('1.1.0', ['Design']),
      ).resolves.toEqual({ id: SNAPSHOT });
      expect(order).toEqual(['fork', 'save', 'commit']);
      expect(applicationsApi.forkApplicationVersion).toHaveBeenCalledWith({
        applicationName: APP_ID,
        forkApplicationVersionDto: { version: '1.1.0', folderPath: 'Design' },
      });
      expect(applicationsApi.commitApplicationVersion).toHaveBeenCalledWith({
        applicationName: APP_ID,
        commitApplicationVersionDto: { snapshotId: SNAPSHOT },
      });
    });

    it('deletes the snapshot and rethrows when the embedded save fails', async () => {
      const error = new Error('save failed');
      runEmbeddedSave.mockRejectedValue(error);

      await expect(adapter.saveAsNewVersion?.('1.1.0', [])).rejects.toBe(error);
      expect(applicationsApi.deleteApplication).toHaveBeenCalledWith({
        applicationName: SNAPSHOT,
      });
      expect(applicationsApi.commitApplicationVersion).not.toHaveBeenCalled();
    });

    it('reports a failed commit with a translated message', async () => {
      applicationsApi.commitApplicationVersion.mockRejectedValue(
        new Error('412'),
      );

      const promise = adapter.saveAsNewVersion?.('1.1.0', []);
      await expect(promise).rejects.toBeInstanceOf(ResourceSaveError);
      await expect(promise).rejects.toThrow('commit failed 1.1.0');
    });

    it('moves into a Personal folder by its joined path', async () => {
      applicationsApi.moveApplication.mockResolvedValue({
        id: 'applications/b1/A/B/x',
      });
      await expect(adapter.move(APP_ID, ['A', 'B'])).resolves.toEqual({
        id: 'applications/b1/A/B/x',
      });
      expect(applicationsApi.moveApplication).toHaveBeenCalledWith({
        applicationName: APP_ID,
        moveResourceDto: { folderPath: 'A/B' },
      });
    });
  });

  describe('createHostApplicationSaveAdapter', () => {
    const update = vi.fn();
    const createVersion = vi.fn();
    const adapter = createHostApplicationSaveAdapter({
      applicationsApi,
      applicationId: APP_ID,
      update,
      createVersion,
    });

    beforeEach(() => {
      update.mockResolvedValue(undefined);
    });

    it('updates in place and keeps the id', async () => {
      await expect(adapter.saveInPlace()).resolves.toEqual({ id: APP_ID });
      expect(update).toHaveBeenCalledOnce();
    });

    it('creates the new version in the folder without forking', async () => {
      createVersion.mockResolvedValue({ id: SNAPSHOT });

      await expect(
        adapter.saveAsNewVersion?.('1.1.0', ['Design']),
      ).resolves.toEqual({ id: SNAPSHOT });
      expect(createVersion).toHaveBeenCalledWith('1.1.0', ['Design']);
      expect(update).not.toHaveBeenCalled();
      expect(applicationsApi.forkApplicationVersion).not.toHaveBeenCalled();
    });

    it('rejects a create that returns no id', async () => {
      createVersion.mockResolvedValue(undefined);
      await expect(adapter.saveAsNewVersion?.('1.1.0', [])).rejects.toThrow();
    });
  });

  describe('createToolsetSaveAdapter', () => {
    const TOOLSET_ID = 'toolsets/b1/search__1.0.0';
    const body = { name: 'search', version: '1.0.0' } as ToolsetBodyDto;
    const adapter = createToolsetSaveAdapter({
      toolsetsApi,
      toolsetId: TOOLSET_ID,
      body,
    });

    it('updates the toolset in place', async () => {
      toolsetsApi.updateToolset.mockResolvedValue({ id: TOOLSET_ID });
      await expect(adapter.saveInPlace()).resolves.toEqual({ id: TOOLSET_ID });
      expect(toolsetsApi.updateToolset).toHaveBeenCalledWith({
        toolsetName: TOOLSET_ID,
        toolsetBodyDto: body,
      });
    });

    it('creates a new version as a create-only write into the folder', async () => {
      toolsetsApi.createToolset.mockResolvedValue({ id: 'x' });
      await adapter.saveAsNewVersion?.('1.1.0', ['Search']);
      expect(toolsetsApi.createToolset).toHaveBeenCalledWith({
        createToolsetBodyDto: {
          ...body,
          version: '1.1.0',
          createOnly: true,
          folderPath: 'Search',
        },
      });
      expect(toolsetsApi.updateToolset).not.toHaveBeenCalled();
    });

    it('creates a new version at the root without a folder field', async () => {
      toolsetsApi.createToolset.mockResolvedValue({ id: 'x' });
      await adapter.saveAsNewVersion?.('1.1.0', []);
      expect(
        toolsetsApi.createToolset.mock.lastCall?.[0].createToolsetBodyDto,
      ).not.toHaveProperty('folderPath');
    });

    it('moves into a Personal folder', async () => {
      toolsetsApi.moveToolset.mockResolvedValue({ id: 'y' });
      await adapter.move(TOOLSET_ID, ['A', 'B']);
      expect(toolsetsApi.moveToolset).toHaveBeenCalledWith({
        toolsetName: TOOLSET_ID,
        moveResourceDto: { folderPath: 'A/B' },
      });
    });
  });

  describe('createPromptFolderLister', () => {
    const listFolders = createPromptFolderLister(promptsApi);

    beforeEach(() => {
      promptsApi.listPrompts.mockResolvedValue({
        folders: [
          { id: 'Archive', name: 'Archive', prompts: [] },
          { id: 'Work', name: 'Work', prompts: [] },
          { id: 'Work/AI', name: 'AI', prompts: [] },
          { id: 'Work/AI/Deep', name: 'Deep', prompts: [] },
        ],
      });
    });

    it('lists the root level', async () => {
      await expect(listFolders('')).resolves.toEqual({
        folders: [
          { name: 'Archive', path: 'Archive' },
          { name: 'Work', path: 'Work' },
        ],
      });
    });

    it('lists only the direct children of a folder', async () => {
      await expect(listFolders('Work')).resolves.toEqual({
        folders: [{ name: 'AI', path: 'Work/AI' }],
      });
    });
  });

  describe('createPromptSaveAdapter', () => {
    const PROMPT_ID = 'prompts/b1/Work/AI/Summarize';
    const body = { name: 'Summarize', description: '', content: 'x' };
    const adapter = createPromptSaveAdapter({
      promptsApi,
      promptId: PROMPT_ID,
      body,
    });

    it('is unversioned and offers no new-version write', () => {
      expect(adapter.isVersioned).toBe(false);
      expect(adapter.saveAsNewVersion).toBeUndefined();
    });

    it('updates the prompt in place and returns the updated id', async () => {
      promptsApi.updatePrompt.mockResolvedValue({
        id: 'prompts/b1/Work/AI/Summary',
      });
      await expect(adapter.saveInPlace()).resolves.toEqual({
        id: 'prompts/b1/Work/AI/Summary',
      });
      expect(promptsApi.updatePrompt).toHaveBeenCalledWith({
        id: PROMPT_ID,
        updatePromptDto: body,
      });
    });

    it('moves a prompt by its target folder id', async () => {
      promptsApi.movePrompt.mockResolvedValue({
        id: 'prompts/b1/Archive/Summarize',
      });
      await adapter.move(PROMPT_ID, ['Archive']);
      expect(promptsApi.movePrompt).toHaveBeenCalledWith({
        id: PROMPT_ID,
        movePromptDto: { targetFolderId: 'Archive' },
      });
    });
  });

  describe('createToolsetCreateAdapter', () => {
    const body = { name: 'search', version: '1.0.0' } as ToolsetBodyDto;
    const adapter = createToolsetCreateAdapter({ toolsetsApi, body });

    it('creates the toolset create-only in the chosen folder', async () => {
      toolsetsApi.createToolset.mockResolvedValue({ id: 'toolsets/b1/A/x' });
      await expect(adapter.createIn(['A'])).resolves.toEqual({
        id: 'toolsets/b1/A/x',
      });
      expect(toolsetsApi.createToolset).toHaveBeenCalledWith({
        createToolsetBodyDto: { ...body, createOnly: true, folderPath: 'A' },
      });
    });

    it('creates at the root without a folder field', async () => {
      toolsetsApi.createToolset.mockResolvedValue({ id: 'x' });
      await adapter.createIn([]);
      expect(
        toolsetsApi.createToolset.mock.lastCall?.[0].createToolsetBodyDto,
      ).not.toHaveProperty('folderPath');
    });
  });

  describe('createPromptCreateAdapter', () => {
    const body = { name: 'Summarize', content: 'x' };
    const adapter = createPromptCreateAdapter({ promptsApi, body });

    it('creates the prompt in the chosen folder as its folder id', async () => {
      promptsApi.createPrompt.mockResolvedValue({ id: 'prompts/b1/Work/S' });
      await expect(adapter.createIn(['Work'])).resolves.toEqual({
        id: 'prompts/b1/Work/S',
      });
      expect(promptsApi.createPrompt).toHaveBeenCalledWith({
        createPromptDto: { ...body, folderId: 'Work' },
      });
    });

    it('creates at the root without a folder id', async () => {
      promptsApi.createPrompt.mockResolvedValue({ id: 'prompts/b1/S' });
      await adapter.createIn([]);
      expect(promptsApi.createPrompt).toHaveBeenCalledWith({
        createPromptDto: body,
      });
    });
  });

  describe('createSkillFolderLister', () => {
    const listFolders = createSkillFolderLister(skillsApi, 'b1');

    it('lists only grouping folders, across every page', async () => {
      skillsApi.listSkills
        .mockResolvedValueOnce({
          items: [
            { name: 'team-a', path: 'team-a/', nodeType: 'folder' },
            { name: 'helper', path: 'helper', nodeType: 'item' },
          ],
          nextToken: 'next',
        })
        .mockResolvedValueOnce({
          items: [{ name: 'team-b', path: 'team-b', nodeType: 'folder' }],
        });

      await expect(listFolders('')).resolves.toEqual({
        folders: [
          { name: 'team-a', path: 'team-a' },
          { name: 'team-b', path: 'team-b' },
        ],
      });
      expect(skillsApi.listSkills).toHaveBeenNthCalledWith(1, {
        bucket: 'b1',
        path: undefined,
        token: undefined,
      });
      expect(skillsApi.listSkills).toHaveBeenNthCalledWith(2, {
        bucket: 'b1',
        path: undefined,
        token: 'next',
      });
    });

    it('stops on a repeated page token', async () => {
      skillsApi.listSkills.mockResolvedValue({ items: [], nextToken: 'same' });
      await expect(listFolders('team-a')).resolves.toEqual({ folders: [] });
      expect(skillsApi.listSkills).toHaveBeenCalledTimes(2);
    });
  });
});
