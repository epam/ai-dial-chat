import type { CatalogItem } from '@epam/ai-dial-catalog';
import type {
  ApplicationSchemaSummaryDto,
  DeploymentItemDto,
} from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { act, renderHook } from '@testing-library/react';
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
  createToolset: 'Create toolset',
  createCustomApp: 'Create custom app',
  createSkill: 'Skill',
  createSkillWriteInstructions: 'Write instructions',
  createSkillUpload: 'Upload',
  createPrompt: 'Create prompt',
  deleteError: 'delete-error',
};

const quickAppSchema: ApplicationSchemaSummaryDto = {
  id: 'foo-quickapps2',
  displayName: 'Quick app 2.0',
  editorUrl: 'https://editor.example/quickapps',
};

const EDITOR_URL = 'https://editor.example/runner';
const SCHEMA_ENDPOINT = 'https://runner.example/schema';

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
      schemas: [],
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
        schemas: [quickAppSchema],
      });
      const item = makeCatalogItem({
        id: 'applications/b/Quick One__1.0',
        type: CatalogEntityType.Agent,
      });

      result.current.handleEdit(item);

      expect(onNavigate).toHaveBeenCalledWith(
        'edit:quick-app:foo-quickapps2:applications/b/Quick One__1.0',
      );
    });

    it("opens the schema editor under the deployment's own runner schema", () => {
      const deployments: DeploymentItemDto[] = [
        {
          id: 'applications/b/Mind Map__1.0',
          displayName: 'Mind Map',
          type: 'application',
          isMy: true,
          applicationTypeSchemaId: 'mind-map-schema',
        } as DeploymentItemDto,
      ];
      const { result, onNavigate } = renderEditNavigation({
        deployments,
        schemas: [
          quickAppSchema,
          { id: 'mind-map-schema', editorUrl: EDITOR_URL },
        ],
      });
      const item = makeCatalogItem({
        id: 'applications/b/Mind Map__1.0',
        type: CatalogEntityType.Agent,
      });

      result.current.handleEdit(item);

      expect(onNavigate).toHaveBeenCalledWith(
        'edit:quick-app:mind-map-schema:applications/b/Mind Map__1.0',
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
        schemas: [quickAppSchema],
      });

      expect(
        result.current.createOptions.find(
          (option) => option.key === 'runner:foo-quickapps2',
        ),
      ).toBeTruthy();
    });

    it('hides Create Quick App when schema-apps is disabled', () => {
      const { result } = renderEditNavigation({
        schemas: [quickAppSchema],
        isSchemaAppsEnabled: false,
      });

      expect(
        result.current.createOptions.find(
          (option) => option.key === 'runner:foo-quickapps2',
        ),
      ).toBeUndefined();
    });

    it('hides Create Quick App when hide-custom-app-creation is enabled', () => {
      const { result } = renderEditNavigation({
        schemas: [quickAppSchema],
        isHideCustomAppCreationEnabled: true,
      });

      expect(
        result.current.createOptions.find(
          (option) => option.key === 'runner:foo-quickapps2',
        ),
      ).toBeUndefined();
    });

    it('navigates using the schema id from the Quick App create option', () => {
      const { result, onNavigate } = renderEditNavigation({
        schemas: [quickAppSchema],
      });

      const quickAppOption = result.current.createOptions.find(
        (option) => option.key === 'runner:foo-quickapps2',
      );
      quickAppOption?.onClick?.({
        key: 'runner:foo-quickapps2',
        domEvent: {} as never,
      });

      expect(onNavigate).toHaveBeenCalledWith(
        'create:quick-app:foo-quickapps2',
      );
    });

    it('offers one create option per runner schema, labelled with its display name and sorted with the static options', () => {
      const { result, onNavigate } = renderEditNavigation({
        isCustomAppsEnabled: true,
        schemas: [
          quickAppSchema,
          {
            id: 'ocr-schema',
            displayName: 'OCR',
            schemaEndpoint: SCHEMA_ENDPOINT,
          },
          {
            id: 'ocr-schema',
            displayName: 'OCR',
            schemaEndpoint: SCHEMA_ENDPOINT,
          },
          {
            id: 'custom_app',
            displayName: 'Custom app',
            editorUrl: EDITOR_URL,
          },
          { displayName: 'No id', editorUrl: EDITOR_URL },
          {
            id: 'foo-quickapps',
            displayName: 'Quick app',
            editorUrl: EDITOR_URL,
          },
          {
            id: 'editorless-runner',
            displayName: 'No editor',
          },
        ],
      });

      expect(
        result.current.createOptions.map((option) => [
          option.key,
          option.label,
        ]),
      ).toEqual([
        ['custom-app', 'Create custom app'],
        ['prompt', 'Create prompt'],
        ['toolset', 'Create toolset'],
        ['runner:editorless-runner', 'No editor'],
        ['runner:ocr-schema', 'OCR'],
        ['runner:foo-quickapps', 'Quick app'],
        ['runner:foo-quickapps2', 'Quick app 2.0'],
        ['skill', 'Skill'],
      ]);

      result.current.createOptions
        .find((option) => option.key === 'runner:ocr-schema')
        ?.onClick?.({
          key: 'runner:ocr-schema',
          domEvent: {} as never,
        });
      expect(onNavigate).toHaveBeenCalledWith('create:quick-app:ocr-schema');
    });

    it('lists every runner option, sorted alphabetically', () => {
      const names = [
        'Zeta',
        'alpha',
        'Mind map',
        'Beta',
        'OCR',
        'Delta',
        'Kappa',
        'Gamma',
        'Epsilon',
        'Iota',
        'Theta',
        'Lambda',
      ];
      const { result } = renderEditNavigation({
        schemas: names.map((name) => ({
          id: name,
          displayName: name,
          editorUrl: EDITOR_URL,
        })),
      });

      const runnerLabels = result.current.createOptions
        .filter((option) => option.key.startsWith('runner:'))
        .map((option) => option.label);

      expect(runnerLabels).toEqual([
        'alpha',
        'Beta',
        'Delta',
        'Epsilon',
        'Gamma',
        'Iota',
        'Kappa',
        'Lambda',
        'OCR',
        'Theta',
        'Zeta',
      ]);
    });

    it('omits Mind Map runners from the Create menu', () => {
      const { result } = renderEditNavigation({
        schemas: [
          { id: 'mind-map', displayName: 'Mind map', editorUrl: EDITOR_URL },
          {
            id: 'https://runner.example/schemas/mindmap',
            displayName: 'Brainstorm',
            editorUrl: EDITOR_URL,
          },
          { id: 'ocr', displayName: 'OCR', schemaEndpoint: SCHEMA_ENDPOINT },
        ],
      });

      const runnerKeys = result.current.createOptions
        .filter((option) => option.key.startsWith('runner:'))
        .map((option) => option.key);

      expect(runnerKeys).toEqual(['runner:ocr']);
      expect(
        result.current.createMenuByType[CatalogEntityType.Agent]?.options.map(
          (option) => option.key,
        ),
      ).not.toContain('runner:mind-map');
    });

    it('offers no search field when Mind Map is the only runner', () => {
      const { result } = renderEditNavigation({
        schemas: [
          { id: 'mind-map', displayName: 'Mind map', editorUrl: EDITOR_URL },
        ],
      });

      expect(result.current.createSearch).toBeUndefined();
    });

    it('filters runner and static options by the search query, case-insensitively', () => {
      const { result } = renderEditNavigation({
        schemas: [
          quickAppSchema,
          { id: 'mind-map', displayName: 'Mind map', editorUrl: EDITOR_URL },
          { id: 'ocr', displayName: 'OCR', schemaEndpoint: SCHEMA_ENDPOINT },
        ],
      });

      act(() => result.current.createSearch?.onChange('oCr'));

      expect(result.current.createSearch?.value).toBe('oCr');
      expect(result.current.createOptions.map((option) => option.key)).toEqual([
        'runner:ocr',
      ]);

      act(() => result.current.createSearch?.onChange('upload'));

      expect(result.current.createOptions.map((option) => option.key)).toEqual([
        'skill',
      ]);
      expect(
        result.current.createOptions[0].children?.map((child) => child.key),
      ).toEqual(['skill-upload']);
    });

    it('offers no search field when no runner option is available', () => {
      const { result: noRunners } = renderEditNavigation();
      expect(noRunners.current.createSearch).toBeUndefined();

      const { result: disabled } = renderEditNavigation({
        schemas: [quickAppSchema],
        isSchemaAppsEnabled: false,
      });
      expect(disabled.current.createSearch).toBeUndefined();
    });

    it('offers a runner that has only a schema endpoint', () => {
      const { result } = renderEditNavigation({
        schemas: [
          {
            id: 'external-apps',
            displayName: 'External app',
            schemaEndpoint: 'https://runner.example/schema',
          },
        ],
      });

      expect(
        result.current.createOptions.find(
          (option) => option.key === 'runner:external-apps',
        )?.label,
      ).toBe('External app');
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

  describe('createMenuByType', () => {
    const keysOf = (
      menu: { options: { key: string }[] } | undefined,
    ): string[] | undefined => menu?.options.map((option) => option.key);

    it('splits the Create menu by entity type and gives models no entry', () => {
      const { result } = renderEditNavigation({
        isCustomAppsEnabled: true,
        schemas: [quickAppSchema],
      });
      const menu = result.current.createMenuByType;

      expect(menu[CatalogEntityType.Model]).toBeUndefined();
      expect(keysOf(menu[CatalogEntityType.Agent])).toEqual([
        'custom-app',
        'runner:foo-quickapps2',
      ]);
      expect(keysOf(menu[CatalogEntityType.Toolset])).toEqual(['toolset']);
      expect(keysOf(menu[CatalogEntityType.Skill])).toEqual([
        'skill-write-instructions',
        'skill-upload',
      ]);
      expect(keysOf(menu[CatalogEntityType.Prompt])).toEqual(['prompt']);
    });

    it('gives the agent menu the runner search field', () => {
      const { result } = renderEditNavigation({ schemas: [quickAppSchema] });

      expect(
        result.current.createMenuByType[CatalogEntityType.Agent]?.search,
      ).toBe(result.current.createSearch);
    });

    it('leaves a disabled type with no options', () => {
      const { result } = renderEditNavigation({
        isToolsetsEnabled: false,
        isPromptsEnabled: false,
      });
      const menu = result.current.createMenuByType;

      expect(keysOf(menu[CatalogEntityType.Toolset])).toEqual([]);
      expect(keysOf(menu[CatalogEntityType.Prompt])).toEqual([]);
      expect(keysOf(menu[CatalogEntityType.Agent])).toEqual([]);
    });
  });

  describe('creation permissions', () => {
    const schemaA: ApplicationSchemaSummaryDto = {
      id: 'schema-A',
      displayName: 'Runner',
    };
    const schemaB: ApplicationSchemaSummaryDto = {
      id: 'schema-B',
      displayName: 'Runner',
    };
    const keysOf = (options: { key: string }[] | undefined) =>
      options?.map((option) => option.key);
    const ALL_DENIED = {
      canCreateCustomApp: false,
      canCreateToolset: false,
      canCreatePrompt: false,
      canCreateSkill: false,
      canCreateSchema: () => false,
    };

    it('keeps the flag-only menu when a host passes no creation inputs', () => {
      const { result } = renderEditNavigation({
        isCustomAppsEnabled: true,
        schemas: [quickAppSchema],
      });

      expect(keysOf(result.current.createOptions)).toEqual([
        'custom-app',
        'prompt',
        'toolset',
        'runner:foo-quickapps2',
        'skill',
      ]);
      expect(result.current.hasCreateOptions).toBe(true);
      expect(result.current.createSearch).toBeDefined();
    });

    it('removes only the custom-app option when custom-app creation is denied', () => {
      const deployment = {
        id: 'apps/custom',
        applicationTypeSchemaId: undefined,
      } as unknown as DeploymentItemDto;
      const { result, onNavigate } = renderEditNavigation({
        isCustomAppsEnabled: true,
        canCreateCustomApp: false,
        deployments: [deployment],
        schemas: [quickAppSchema],
      });

      const keys = keysOf(result.current.createOptions);
      expect(keys).not.toContain('custom-app');
      expect(keys).toContain('runner:foo-quickapps2');
      expect(keys).toContain('toolset');

      result.current.handleEdit(
        makeCatalogItem({ id: 'apps/custom', type: CatalogEntityType.Agent }),
      );
      expect(onNavigate).toHaveBeenCalledWith('edit:custom-app:apps/custom');
    });

    it.each([
      ['toolset', { canCreateToolset: false }],
      ['prompt', { canCreatePrompt: false }],
    ])('removes the %s option when its creation is denied', (key, denial) => {
      const { result } = renderEditNavigation(denial);

      expect(keysOf(result.current.createOptions)).not.toContain(key);
      expect(keysOf(result.current.createOptions)).toContain('skill');
    });

    it('removes the Skill group and both children from every menu when skill creation is denied', () => {
      const { result } = renderEditNavigation({ canCreateSkill: false });

      expect(keysOf(result.current.createOptions)).not.toContain('skill');
      expect(
        keysOf(
          result.current.createMenuByType[CatalogEntityType.Skill]?.options,
        ),
      ).toEqual([]);
    });

    it('cannot reach a denied Skill child through the search', () => {
      const { result } = renderEditNavigation({
        canCreateSkill: false,
        schemas: [quickAppSchema],
      });

      act(() => result.current.createSearch?.onChange('upload'));

      expect(result.current.createOptions).toEqual([]);
      expect(result.current.hasCreateOptions).toBe(true);
    });

    it('offers only the permitted one of two schemas sharing a label', () => {
      const { result, onNavigate } = renderEditNavigation({
        schemas: [schemaA, schemaB],
        canCreateSchema: (schemaId) => schemaId === 'schema-B',
        deployments: [
          {
            id: 'apps/a',
            applicationTypeSchemaId: 'schema-A',
          } as unknown as DeploymentItemDto,
        ],
      });

      const keys = keysOf(result.current.createOptions);
      expect(keys).toContain('runner:schema-B');
      expect(keys).not.toContain('runner:schema-A');

      result.current.handleEdit(
        makeCatalogItem({ id: 'apps/a', type: CatalogEntityType.Agent }),
      );
      expect(onNavigate).toHaveBeenCalledWith('edit:quick-app:schema-A:apps/a');
    });

    it('drops the search when no runner schema is creatable', () => {
      const { result } = renderEditNavigation({
        schemas: [schemaA, schemaB],
        canCreateSchema: () => false,
      });

      expect(result.current.createSearch).toBeUndefined();
      expect(
        result.current.createMenuByType[CatalogEntityType.Agent]?.search,
      ).toBeUndefined();
      expect(
        keysOf(result.current.createOptions)?.filter((key) =>
          key.startsWith('runner:'),
        ),
      ).toEqual([]);
    });

    it('merges into one list without a header when only one section is creatable', () => {
      const { result } = renderEditNavigation({
        isCustomAppsEnabled: true,
        canCreateCustomApp: false,
        schemas: [quickAppSchema],
        canCreateSchema: () => false,
      });

      expect(keysOf(result.current.createOptions)).toEqual([
        'prompt',
        'toolset',
        'skill',
      ]);
    });

    it('reports no create options when every action is denied', () => {
      const { result } = renderEditNavigation({
        isCustomAppsEnabled: true,
        schemas: [quickAppSchema],
        ...ALL_DENIED,
      });

      expect(result.current.hasCreateOptions).toBe(false);
      expect(result.current.createOptions).toEqual([]);
      expect(result.current.createSearch).toBeUndefined();
      for (const type of [
        CatalogEntityType.Agent,
        CatalogEntityType.Toolset,
        CatalogEntityType.Skill,
        CatalogEntityType.Prompt,
      ]) {
        expect(result.current.createMenuByType[type]?.options).toEqual([]);
      }
    });

    it('keeps hasCreateOptions true when a search matches nothing', () => {
      const { result } = renderEditNavigation({ schemas: [quickAppSchema] });

      act(() => result.current.createSearch?.onChange('zzz'));

      expect(result.current.createOptions).toEqual([]);
      expect(result.current.hasCreateOptions).toBe(true);
      expect(result.current.createSearch?.value).toBe('zzz');
    });

    it('does not let a creation permission re-enable a disabled feature', () => {
      const { result } = renderEditNavigation({
        isToolsetsEnabled: false,
        isPromptsEnabled: false,
        isCustomAppsEnabled: false,
        isSchemaAppsEnabled: false,
        canCreateSkill: false,
        canCreateToolset: true,
        canCreatePrompt: true,
        canCreateCustomApp: true,
        schemas: [quickAppSchema],
      });

      expect(result.current.hasCreateOptions).toBe(false);
    });

    it('still deletes an item whose type is denied for creation', async () => {
      const { result, deletePrompt } = renderEditNavigation(ALL_DENIED);

      await act(() =>
        result.current.handleDelete(
          makeCatalogItem({ id: 'prompts/p', type: CatalogEntityType.Prompt }),
        ),
      );

      expect(deletePrompt).toHaveBeenCalledWith('prompts/p');
    });
  });
});
