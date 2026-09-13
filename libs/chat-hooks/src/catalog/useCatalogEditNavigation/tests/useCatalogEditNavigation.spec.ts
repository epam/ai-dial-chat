import type { CatalogItem } from '@epam/ai-dial-catalog';
import type { DeploymentItemDto } from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CatalogEditNavigationLabels,
  CatalogEditNavigationUrls,
} from '../useCatalogEditNavigation';
import { useCatalogEditNavigation } from '../useCatalogEditNavigation';

const urls: CatalogEditNavigationUrls = {
  buildPromptEditUrl: (id) => `edit:prompt:${id}`,
  buildPromptCreateUrl: () => 'create:prompt',
  buildSkillEditUrl: (id) => `edit:skill:${id}`,
  buildSkillCreateUrl: () => 'create:skill',
  buildToolsetEditUrl: (id) => `edit:toolset:${id}`,
  buildToolsetCreateUrl: () => 'create:toolset',
  buildCustomAppEditUrl: (id) => `edit:custom-app:${id}`,
  buildCustomAppCreateUrl: () => 'create:custom-app',
  buildQuickAppEditUrl: (schemaId, appId) =>
    `edit:quick-app:${schemaId}:${appId}`,
  buildQuickAppCreateUrl: (schemaId) => `create:quick-app:${schemaId}`,
};

const labels: CatalogEditNavigationLabels = {
  createQuickApp: 'Create quick app',
  createToolset: 'Create toolset',
  createCustomApp: 'Create custom app',
  createSkill: 'Skill',
  createSkillWriteInstructions: 'Write instructions',
  createSkillUpload: 'Upload',
  createPrompt: 'Create prompt',
  deleteError: 'delete-error',
};

const makeCatalogItem = (overrides?: Partial<CatalogItem>): CatalogItem => ({
  id: 'tool-abc123',
  type: CatalogEntityType.Toolset,
  name: 'My toolset',
  version: '1.2.0',
  lastUsed: 'now',
  description: '',
  folder: [],
  topics: [],
  isMyApp: true,
  ...overrides,
});

const renderEditNavigation = (
  overrides: Partial<Parameters<typeof useCatalogEditNavigation>[0]> = {},
) => {
  const onNavigate = vi.fn();
  const deletePrompt = vi.fn().mockResolvedValue(undefined);
  const deleteToolset = vi.fn().mockResolvedValue(undefined);
  const deleteSkill = vi.fn().mockResolvedValue(undefined);
  const deleteApplication = vi.fn().mockResolvedValue(undefined);
  const refetchPrompts = vi.fn().mockResolvedValue(undefined);
  const refetchToolsets = vi.fn().mockResolvedValue(undefined);
  const refetchSkills = vi.fn().mockResolvedValue(undefined);
  const refetchDeployments = vi.fn().mockResolvedValue(undefined);
  const onDeleteSuccess = vi.fn();
  const onNotify = vi.fn();
  const onSkillUploadClick = vi.fn();
  const view = renderHook(() =>
    useCatalogEditNavigation({
      deployments: [],
      isCustomAppsEnabled: false,
      isSchemaAppsEnabled: true,
      isHideCustomAppCreationEnabled: false,
      isToolsetsEnabled: true,
      isPromptsEnabled: true,
      quickAppSchemaId: undefined,
      urls,
      onNavigate,
      deletePrompt,
      deleteToolset,
      deleteSkill,
      deleteApplication,
      refetchPrompts,
      refetchToolsets,
      refetchSkills,
      refetchDeployments,
      onDeleteSuccess,
      labels,
      onNotify,
      onSkillUploadClick,
      ...overrides,
    }),
  );
  return {
    ...view,
    onNavigate,
    deletePrompt,
    deleteToolset,
    deleteSkill,
    deleteApplication,
    refetchPrompts,
    refetchToolsets,
    refetchSkills,
    refetchDeployments,
    onDeleteSuccess,
    onNotify,
    onSkillUploadClick,
  };
};

describe('useCatalogEditNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleEdit', () => {
    it('navigates to the toolset editor with the toolset id when Edit is clicked', () => {
      const { result, onNavigate } = renderEditNavigation();
      const item = makeCatalogItem({
        id: 'toolsets/b/search__0.0.1',
        type: CatalogEntityType.Toolset,
      });

      result.current.handleEdit(item);

      expect(onNavigate).toHaveBeenCalledWith(
        'edit:toolset:toolsets/b/search__0.0.1',
      );
    });

    it('opens the prompt editor with the prompt id when Edit is activated', () => {
      const { result, onNavigate } = renderEditNavigation();
      const item = makeCatalogItem({
        id: 'prompts/my-bucket/Work/AI/summarize',
        type: CatalogEntityType.Prompt,
      });

      result.current.handleEdit(item);

      expect(onNavigate).toHaveBeenCalledWith(
        'edit:prompt:prompts/my-bucket/Work/AI/summarize',
      );
    });

    it('opens the skill editor with the skill resource id', () => {
      const { result, onNavigate } = renderEditNavigation();
      const item = makeCatalogItem({
        id: 'skills/owner-bucket/analysis/revenue-skill',
        type: CatalogEntityType.Skill,
      });

      result.current.handleEdit(item);

      expect(onNavigate).toHaveBeenCalledWith(
        'edit:skill:skills/owner-bucket/analysis/revenue-skill',
      );
    });

    it('opens the custom app editor for a schema-less application when custom apps are enabled', () => {
      const deployments: DeploymentItemDto[] = [
        {
          id: 'applications/b/My App__1.0',
          displayName: 'My App',
          type: 'application',
          isMy: true,
        } as DeploymentItemDto,
      ];
      const { result, onNavigate } = renderEditNavigation({
        deployments,
        isCustomAppsEnabled: true,
      });
      const item = makeCatalogItem({
        id: 'applications/b/My App__1.0',
        type: CatalogEntityType.Agent,
      });

      result.current.handleEdit(item);

      expect(onNavigate).toHaveBeenCalledWith(
        'edit:custom-app:applications/b/My App__1.0',
      );
    });

    it('navigates to the quick app editor for a schema-driven application', () => {
      const { result, onNavigate } = renderEditNavigation({
        quickAppSchemaId: 'quickapps2-schema',
      });
      const item = makeCatalogItem({
        id: 'applications/b/Quick One__1.0',
        type: CatalogEntityType.Agent,
      });

      result.current.handleEdit(item);

      expect(onNavigate).toHaveBeenCalledWith(
        'edit:quick-app:quickapps2-schema:applications/b/Quick One__1.0',
      );
    });

    it('does nothing for a model item with no quick-app schema', () => {
      const { result, onNavigate } = renderEditNavigation();
      const item = makeCatalogItem({
        id: 'gpt-4o',
        type: CatalogEntityType.Model,
      });

      result.current.handleEdit(item);

      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  describe('handleDelete', () => {
    it('deletes a toolset, refetches toolsets, and reports success', async () => {
      const {
        result,
        deleteToolset,
        refetchToolsets,
        refetchDeployments,
        deleteApplication,
        onDeleteSuccess,
      } = renderEditNavigation();
      const item = makeCatalogItem({
        id: 'toolsets/b/search__0.0.1',
        type: CatalogEntityType.Toolset,
      });

      await result.current.handleDelete(item);

      expect(deleteToolset).toHaveBeenCalledWith('toolsets/b/search__0.0.1');
      expect(refetchToolsets).toHaveBeenCalledOnce();
      expect(deleteApplication).not.toHaveBeenCalled();
      expect(onDeleteSuccess).toHaveBeenCalledWith(item);
      expect(refetchDeployments).not.toHaveBeenCalled();
    });

    it('deletes an application, refetches deployments, and reports success', async () => {
      const deployments: DeploymentItemDto[] = [
        {
          id: 'applications/b/My App__1.0',
          displayName: 'My App',
          type: 'application',
          isMy: true,
        } as DeploymentItemDto,
      ];
      const {
        result,
        deleteApplication,
        refetchDeployments,
        deleteToolset,
        onDeleteSuccess,
      } = renderEditNavigation({ deployments });
      const item = makeCatalogItem({
        id: 'applications/b/My App__1.0',
        type: CatalogEntityType.Agent,
      });

      await result.current.handleDelete(item);

      expect(deleteApplication).toHaveBeenCalledWith(
        'applications/b/My App__1.0',
      );
      expect(refetchDeployments).toHaveBeenCalledOnce();
      expect(deleteToolset).not.toHaveBeenCalled();
      expect(onDeleteSuccess).toHaveBeenCalledWith(item);
    });

    it('deletes a skill via the skills endpoint, refetches skills, and reports success', async () => {
      const { result, deleteSkill, refetchSkills, onDeleteSuccess } =
        renderEditNavigation();
      const item = makeCatalogItem({
        id: 'skills/my-bucket/analysis/revenue-skill',
        type: CatalogEntityType.Skill,
      });

      await result.current.handleDelete(item);

      expect(deleteSkill).toHaveBeenCalledWith(
        'my-bucket',
        'analysis/revenue-skill',
      );
      expect(refetchSkills).toHaveBeenCalledOnce();
      expect(onDeleteSuccess).toHaveBeenCalledWith(item);
    });

    it('shows an error notification and does not call deleteSkill for a malformed skill resource id', async () => {
      const { result, deleteSkill, refetchSkills, onNotify } =
        renderEditNavigation();
      const item = makeCatalogItem({
        id: 'skills/onlybucket',
        type: CatalogEntityType.Skill,
      });

      await expect(result.current.handleDelete(item)).rejects.toThrow();

      expect(deleteSkill).not.toHaveBeenCalled();
      expect(refetchSkills).not.toHaveBeenCalled();
      expect(onNotify).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'delete-error' }),
      );
    });

    it('deletes a prompt through deletePrompt and refetches', async () => {
      const { result, deletePrompt, refetchPrompts, deleteApplication } =
        renderEditNavigation();
      const item = makeCatalogItem({
        id: 'prompts/my-bucket/Work/AI/summarize',
        type: CatalogEntityType.Prompt,
      });

      await result.current.handleDelete(item);

      expect(deletePrompt).toHaveBeenCalledWith(
        'prompts/my-bucket/Work/AI/summarize',
      );
      expect(refetchPrompts).toHaveBeenCalledOnce();
      expect(deleteApplication).not.toHaveBeenCalled();
    });

    it('surfaces an error notification when deleting a prompt fails', async () => {
      const item = makeCatalogItem({
        id: 'prompts/my-bucket/Work/AI/summarize',
        type: CatalogEntityType.Prompt,
      });
      const deletePrompt = vi.fn().mockRejectedValue(new Error('502'));
      const { result, onNotify } = renderEditNavigation({ deletePrompt });

      await expect(result.current.handleDelete(item)).rejects.toThrow('502');

      expect(onNotify).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'delete-error' }),
      );
    });

    it('shows an error notification and does not report success when deleteToolset rejects', async () => {
      const deleteToolset = vi
        .fn()
        .mockRejectedValue(new Error('network error'));
      const { result, onDeleteSuccess, onNotify } = renderEditNavigation({
        deleteToolset,
      });
      const item = makeCatalogItem({
        id: 'toolsets/b/search__0.0.1',
        type: CatalogEntityType.Toolset,
      });

      await expect(result.current.handleDelete(item)).rejects.toThrow(
        'network error',
      );

      expect(onDeleteSuccess).not.toHaveBeenCalled();
      expect(onNotify).toHaveBeenCalled();
    });
  });

  describe('createOptions', () => {
    it('renders Create Toolset action even when application schemas are absent', () => {
      const { result, onNavigate } = renderEditNavigation();

      const toolsetOption = result.current.createOptions.find(
        (option) => option.key === 'toolset',
      );
      expect(toolsetOption).toBeTruthy();

      toolsetOption?.onClick?.({ key: 'toolset', domEvent: {} as never });
      expect(onNavigate).toHaveBeenCalledWith('create:toolset');
    });

    it('excludes the Create Toolset option when toolsets is disabled', () => {
      const { result } = renderEditNavigation({ isToolsetsEnabled: false });

      expect(
        result.current.createOptions.find((option) => option.key === 'toolset'),
      ).toBeUndefined();
    });

    it('shows Create Quick App by default when a quick-app schema exists', () => {
      const { result } = renderEditNavigation({
        quickAppSchemaId: 'foo-quickapps2',
      });

      expect(
        result.current.createOptions.find(
          (option) => option.key === 'quick-app',
        ),
      ).toBeTruthy();
    });

    it('hides Create Quick App when schema-apps is disabled', () => {
      const { result } = renderEditNavigation({
        quickAppSchemaId: 'foo-quickapps2',
        isSchemaAppsEnabled: false,
      });

      expect(
        result.current.createOptions.find(
          (option) => option.key === 'quick-app',
        ),
      ).toBeUndefined();
    });

    it('hides Create Quick App when hide-custom-app-creation is enabled', () => {
      const { result } = renderEditNavigation({
        quickAppSchemaId: 'foo-quickapps2',
        isHideCustomAppCreationEnabled: true,
      });

      expect(
        result.current.createOptions.find(
          (option) => option.key === 'quick-app',
        ),
      ).toBeUndefined();
    });

    it('navigates using the schema id from the Quick App create option', () => {
      const { result, onNavigate } = renderEditNavigation({
        quickAppSchemaId: 'foo-quickapps2',
      });

      const quickAppOption = result.current.createOptions.find(
        (option) => option.key === 'quick-app',
      );
      quickAppOption?.onClick?.({ key: 'quick-app', domEvent: {} as never });

      expect(onNavigate).toHaveBeenCalledWith(
        'create:quick-app:foo-quickapps2',
      );
    });

    it('offers a Prompt create option only when the feature is enabled', () => {
      const { result: enabled } = renderEditNavigation({
        isPromptsEnabled: true,
      });
      expect(
        enabled.current.createOptions.find((option) => option.key === 'prompt'),
      ).toBeTruthy();

      const { result: disabled } = renderEditNavigation({
        isPromptsEnabled: false,
      });
      expect(
        disabled.current.createOptions.find(
          (option) => option.key === 'prompt',
        ),
      ).toBeUndefined();
    });

    it('navigates to the editor in create mode from the Prompt create option', () => {
      const { result, onNavigate } = renderEditNavigation();

      const promptOption = result.current.createOptions.find(
        (option) => option.key === 'prompt',
      );
      promptOption?.onClick?.({ key: 'prompt', domEvent: {} as never });

      expect(onNavigate).toHaveBeenCalledWith('create:prompt');
    });

    it('offers the Skill create option regardless of the prompts feature flag', () => {
      const { result } = renderEditNavigation({ isPromptsEnabled: false });

      expect(
        result.current.createOptions.find((option) => option.key === 'skill'),
      ).toBeTruthy();
    });

    it("navigates to the skill editor from the Skill submenu's Write instructions option", () => {
      const { result, onNavigate } = renderEditNavigation();

      const skillOption = result.current.createOptions.find(
        (option) => option.key === 'skill',
      );
      const writeInstructions = skillOption?.children?.find(
        (child) => child.key === 'skill-write-instructions',
      );
      writeInstructions?.onClick?.({
        key: 'skill-write-instructions',
        domEvent: {} as never,
      });

      expect(onNavigate).toHaveBeenCalledWith('create:skill');
    });

    it('offers no nested children other than Write instructions and Upload under Skill', () => {
      const { result, onSkillUploadClick } = renderEditNavigation();

      const skillOption = result.current.createOptions.find(
        (option) => option.key === 'skill',
      );
      expect(skillOption?.children?.map((child) => child.key)).toEqual([
        'skill-write-instructions',
        'skill-upload',
      ]);

      const uploadOption = skillOption?.children?.find(
        (child) => child.key === 'skill-upload',
      );
      uploadOption?.onClick?.({ key: 'skill-upload', domEvent: {} as never });
      expect(onSkillUploadClick).toHaveBeenCalledOnce();
    });
  });
});
