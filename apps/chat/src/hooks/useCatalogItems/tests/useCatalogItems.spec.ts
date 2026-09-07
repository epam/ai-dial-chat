import type {
  DeploymentItemDto,
  DialToolsetDto,
  PromptResponseDto,
  SkillMetadataItemDto,
} from '@epam/ai-dial-chat-api-client';
import { SKILL_MANIFEST_MAX_BYTES } from '@epam/ai-dial-chat-hooks';
import { renderHook } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogI18nKeys } from '../../../constants/translation-keys';
import { getDeploymentLimits } from '../../../server-api/deployment-limits';
import { getDeploymentDetails } from '../../../server-api/deployments';
import { getPrompt, getPublicPrompt } from '../../../server-api/prompts.api';
import {
  downloadSkillFile,
  listSkillFiles,
} from '../../../server-api/skills.api';
import { useCatalogItems } from '../useCatalogItems';

vi.mock('../../../server-api/deployments', () => ({
  getDeploymentDetails: vi.fn(),
}));

vi.mock('../../../server-api/deployment-limits', () => ({
  getDeploymentLimits: vi.fn(),
}));

vi.mock('../../../server-api/prompts.api', () => ({
  getPrompt: vi.fn(),
  getPublicPrompt: vi.fn(),
}));

vi.mock('../../../server-api/skills.api', () => ({
  downloadSkillFile: vi.fn(),
  listSkillFiles: vi.fn(),
}));

/* Matches the global `react-i18next` mock (`t(key) => key`) used by every other spec in this app. */
const t = ((key: string) => key) as unknown as TFunction;

/** Asserts a `.find()` result was found, avoiding a non-null assertion at every call site. */
const requireItem = <T>(item: T | undefined): T => {
  if (item == null) throw new Error('Expected item to be found');
  return item;
};

type UseCatalogItemsParams = Parameters<typeof useCatalogItems>[0];

const makeParams = (
  overrides: Partial<UseCatalogItemsParams> = {},
): UseCatalogItemsParams => ({
  schemas: [],
  deployments: [],
  favoriteIds: new Set(),
  t,
  language: 'en',
  toolsets: [],
  isAdmin: false,
  dialCoreExternalUrl: 'https://dial.example.com',
  isToolsetsEnabled: true,
  isCustomAppsEnabled: true,
  isPromptsEnabled: true,
  isSkillsEnabled: true,
  prompts: [],
  sharedPrompts: [],
  publicPrompts: [],
  skills: [],
  sharedSkills: [],
  publicSkills: [],
  isSelectorMode: false,
  visibleTypes: new Set(),
  isCatalogHideMyAppsEnabled: false,
  persistedFilterTopics: new Set(),
  ...overrides,
});

const personalPrompt: PromptResponseDto = {
  id: 'prompts/my-bucket/Work/AI/summarize',
  name: 'summarize',
  description: 'Summarize a document',
  content: 'Summarize the following text:',
  folderId: 'Work/AI',
  createdAt: 1,
  updatedAt: 2,
};

const organisationPrompt: PromptResponseDto = {
  ...personalPrompt,
  id: 'prompts/public/Public/translate',
  name: 'translate',
  folderId: 'Public',
};

const personalSkill: SkillMetadataItemDto = {
  name: 'revenue-skill',
  path: 'analysis/revenue-skill',
  url: 'skills/my-bucket/analysis/revenue-skill',
  bucket: 'my-bucket',
  nodeType: 'item',
  parentPath: 'analysis/',
  author: 'alice',
  updatedAt: 2,
};

const organisationSkill: SkillMetadataItemDto = {
  ...personalSkill,
  name: 'shared-skill',
  path: 'shared-skill',
  url: 'skills/public/shared-skill',
  bucket: 'public',
  parentPath: undefined,
};

describe('useCatalogItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('catalogItems / visibleCatalogItems derivation', () => {
    it('adds toolsets from deployments context to catalog items', () => {
      const deployments = [
        { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' },
      ] as DeploymentItemDto[];
      const toolsets = [
        {
          id: 'toolsets/b/search__0.0.1',
          toolset: 'toolsets/b/search__0.0.1',
          displayName: 'Search',
        },
      ] as DialToolsetDto[];

      const { result } = renderHook(() =>
        useCatalogItems(makeParams({ deployments, toolsets })),
      );

      expect(
        result.current.visibleCatalogItems.map(
          (item) => `${item.id}:${item.type}`,
        ),
      ).toEqual(['gpt-4o:MODEL', 'toolsets/b/search__0.0.1:TOOLSET']);
    });

    it('excludes toolset items when toolsets is disabled', () => {
      const toolsets = [
        {
          id: 'toolsets/b/search__0.0.1',
          toolset: 'toolsets/b/search__0.0.1',
          displayName: 'Search',
          isMy: true,
        },
      ] as DialToolsetDto[];

      const { result } = renderHook(() =>
        useCatalogItems(makeParams({ toolsets, isToolsetsEnabled: false })),
      );

      expect(
        result.current.visibleCatalogItems.map((item) => item.id),
      ).not.toContain('toolsets/b/search__0.0.1');
    });

    it("excludes the current user's own items when catalog-hide-my-apps is enabled", () => {
      const toolsets = [
        {
          id: 'toolsets/b/search__0.0.1',
          toolset: 'toolsets/b/search__0.0.1',
          displayName: 'Search',
          isMy: true,
        },
      ] as DialToolsetDto[];

      const { result } = renderHook(() =>
        useCatalogItems(
          makeParams({ toolsets, isCatalogHideMyAppsEnabled: true }),
        ),
      );

      expect(
        result.current.visibleCatalogItems.map((item) => item.id),
      ).not.toContain('toolsets/b/search__0.0.1');
    });

    it('adds prompt items to the catalog when the feature is enabled', () => {
      const { result } = renderHook(() =>
        useCatalogItems(
          makeParams({
            prompts: [personalPrompt],
            publicPrompts: [organisationPrompt],
          }),
        ),
      );

      const ids = result.current.visibleCatalogItems.map((item) => item.id);
      expect(ids).toContain('prompts/my-bucket/Work/AI/summarize');
      expect(ids).toContain('prompts/public/Public/translate');
    });

    it('adds no prompt items when the feature is disabled', () => {
      const { result } = renderHook(() =>
        useCatalogItems(
          makeParams({
            isPromptsEnabled: false,
            prompts: [personalPrompt],
            publicPrompts: [organisationPrompt],
          }),
        ),
      );

      expect(
        result.current.visibleCatalogItems.some(
          (item) => item.type === 'PROMPT',
        ),
      ).toBe(false);
    });

    it('excludes prompts from the model picker in selector mode', () => {
      const { result } = renderHook(() =>
        useCatalogItems(
          makeParams({
            isSelectorMode: true,
            visibleTypes: new Set(),
            prompts: [personalPrompt],
            publicPrompts: [organisationPrompt],
          }),
        ),
      );

      expect(
        result.current.visibleCatalogItems.some(
          (item) => item.type === 'PROMPT',
        ),
      ).toBe(false);
    });

    it('filters personal prompts out when catalog-hide-my-apps is enabled', () => {
      const { result } = renderHook(() =>
        useCatalogItems(
          makeParams({
            isCatalogHideMyAppsEnabled: true,
            prompts: [personalPrompt],
            publicPrompts: [organisationPrompt],
          }),
        ),
      );

      const ids = result.current.visibleCatalogItems.map((item) => item.id);
      expect(ids).not.toContain('prompts/my-bucket/Work/AI/summarize');
      expect(ids).toContain('prompts/public/Public/translate');
    });

    it('keeps a shared prompt distinct from a personal prompt at the same path', () => {
      const sharedPrompt = {
        ...personalPrompt,
        id: 'prompts/owner-bucket/Work/AI/summarize',
      };

      const { result } = renderHook(() =>
        useCatalogItems(
          makeParams({
            prompts: [personalPrompt],
            sharedPrompts: [sharedPrompt],
          }),
        ),
      );

      const ids = result.current.visibleCatalogItems.map((item) => item.id);
      expect(ids).toContain('prompts/my-bucket/Work/AI/summarize');
      expect(ids).toContain('prompts/owner-bucket/Work/AI/summarize');
    });

    it('marks a prompt whose id is in favoriteIds as starred', () => {
      const { result } = renderHook(() =>
        useCatalogItems(
          makeParams({
            prompts: [personalPrompt],
            favoriteIds: new Set(['prompts/my-bucket/Work/AI/summarize']),
          }),
        ),
      );

      expect(result.current.favorites.map((item) => item.id)).toContain(
        'prompts/my-bucket/Work/AI/summarize',
      );
    });

    it('adds skill items to the catalog when the feature is enabled', () => {
      const { result } = renderHook(() =>
        useCatalogItems(
          makeParams({
            skills: [personalSkill],
            publicSkills: [organisationSkill],
          }),
        ),
      );

      const ids = result.current.visibleCatalogItems.map((item) => item.id);
      expect(ids).toContain('skills/my-bucket/analysis/revenue-skill');
      expect(ids).toContain('skills/public/shared-skill');
    });

    it('adds no skill items when the feature is disabled', () => {
      const { result } = renderHook(() =>
        useCatalogItems(
          makeParams({
            isSkillsEnabled: false,
            skills: [personalSkill],
            publicSkills: [organisationSkill],
          }),
        ),
      );

      expect(
        result.current.visibleCatalogItems.some(
          (item) => item.type === 'SKILL',
        ),
      ).toBe(false);
    });

    it('excludes skills from the model picker in selector mode', () => {
      const { result } = renderHook(() =>
        useCatalogItems(
          makeParams({
            isSelectorMode: true,
            visibleTypes: new Set(),
            skills: [personalSkill],
            publicSkills: [organisationSkill],
          }),
        ),
      );

      expect(
        result.current.visibleCatalogItems.some(
          (item) => item.type === 'SKILL',
        ),
      ).toBe(false);
    });
  });

  describe('catalogItems memoization', () => {
    it('recomputes when a dependency changes but keeps its identity across an unrelated rerender', () => {
      const initialParams = makeParams({
        deployments: [
          { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' },
        ] as DeploymentItemDto[],
      });
      const { result, rerender } = renderHook(
        (params: UseCatalogItemsParams) => useCatalogItems(params),
        { initialProps: initialParams },
      );
      const firstItems = result.current.catalogItems;

      /* Changing a value outside the dependency array must not recompute. */
      rerender(
        makeParams({
          ...initialParams,
          dialCoreExternalUrl: 'https://another.example.com',
        }),
      );
      expect(result.current.catalogItems).toBe(firstItems);

      /* Changing `deployments` (a listed dependency) must recompute. */
      rerender(
        makeParams({
          ...initialParams,
          deployments: [
            { id: 'claude', displayName: 'Claude', type: 'model' },
          ] as DeploymentItemDto[],
        }),
      );
      expect(result.current.catalogItems).not.toBe(firstItems);
    });
  });

  describe('reconciledFilterTopics', () => {
    it('drops a persisted topic filter that no longer exists in the current items', () => {
      const deployments = [
        { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' },
      ] as DeploymentItemDto[];

      const { result } = renderHook(() =>
        useCatalogItems(
          makeParams({
            deployments,
            persistedFilterTopics: new Set(['deprecated-topic']),
          }),
        ),
      );

      expect(result.current.reconciledFilterTopics).toEqual(new Set());
    });
  });

  describe('onFetchDetails', () => {
    describe('prompt fetch wiring', () => {
      it('fetches a personal prompt through getPrompt and never the deployment endpoints', async () => {
        vi.mocked(getPrompt).mockResolvedValue(personalPrompt);

        const { result } = renderHook(() =>
          useCatalogItems(makeParams({ prompts: [personalPrompt] })),
        );
        const item = requireItem(
          result.current.visibleCatalogItems.find(
            (candidate) => candidate.id === personalPrompt.id,
          ),
        );
        const details = await result.current.onFetchDetails(item);

        expect(getPrompt).toHaveBeenCalledWith(personalPrompt.id);
        expect(getPublicPrompt).not.toHaveBeenCalled();
        expect(getDeploymentDetails).not.toHaveBeenCalled();
        expect(getDeploymentLimits).not.toHaveBeenCalled();
        expect(details?.promptContent?.content).toContain(
          'Summarize the following text:',
        );
      });

      it('fetches an organisation prompt through getPublicPrompt using its bucket-relative path', async () => {
        vi.mocked(getPublicPrompt).mockResolvedValue(organisationPrompt);

        const { result } = renderHook(() =>
          useCatalogItems(makeParams({ publicPrompts: [organisationPrompt] })),
        );
        const item = requireItem(
          result.current.visibleCatalogItems.find(
            (candidate) => candidate.id === organisationPrompt.id,
          ),
        );
        await result.current.onFetchDetails(item);

        expect(getPublicPrompt).toHaveBeenCalledWith('Public/translate');
        expect(getPrompt).not.toHaveBeenCalled();
      });

      it('fetches a shared prompt using its full owner-bucket-qualified id', async () => {
        const sharedPrompt: PromptResponseDto = {
          ...personalPrompt,
          id: 'prompts/owner-bucket/Work/AI/summarize',
        };
        vi.mocked(getPrompt).mockResolvedValue(sharedPrompt);

        const { result } = renderHook(() =>
          useCatalogItems(
            makeParams({ prompts: [], sharedPrompts: [sharedPrompt] }),
          ),
        );
        const item = requireItem(
          result.current.visibleCatalogItems.find(
            (candidate) => candidate.id === sharedPrompt.id,
          ),
        );
        await result.current.onFetchDetails(item);

        expect(getPrompt).toHaveBeenCalledWith(
          'prompts/owner-bucket/Work/AI/summarize',
        );
      });

      it('resolves undefined when the prompt fetch fails', async () => {
        vi.mocked(getPrompt).mockRejectedValue(new Error('502'));

        const { result } = renderHook(() =>
          useCatalogItems(makeParams({ prompts: [personalPrompt] })),
        );
        const item = requireItem(
          result.current.visibleCatalogItems.find(
            (candidate) => candidate.id === personalPrompt.id,
          ),
        );

        await expect(
          result.current.onFetchDetails(item),
        ).resolves.toBeUndefined();
      });
    });

    it('maps a fetched application DeploymentDetailsDto into specification/capabilities/configuration', async () => {
      const deployments = [
        { id: 'my-app', displayName: 'My App', type: 'application' },
      ] as DeploymentItemDto[];
      vi.mocked(getDeploymentDetails).mockResolvedValue({
        id: 'my-app',
        type: 'application',
        applicationDetails: {
          routes: ['default', 'health'],
          owner: 'Yauheniya Hladkaya',
          inputAttachmentTypes: ['text/*'],
          features: { mcp: false, tools: false, cache: false },
        },
      } as never);

      const { result } = renderHook(() =>
        useCatalogItems(makeParams({ deployments })),
      );
      const item = result.current.visibleCatalogItems.find(
        (candidate) => candidate.id === 'my-app',
      );
      const details = await result.current.onFetchDetails(requireItem(item));

      expect(details?.overview?.sections).toEqual([
        {
          title: 'Specification',
          specs: [
            { label: 'Hosted by', value: 'Yauheniya Hladkaya' },
            { label: 'Routes', value: 'default · health' },
          ],
        },
        {
          title: 'Capabilities',
          specs: [{ label: 'Tools', value: false }],
        },
        {
          title: 'Configuration',
          specs: [{ label: 'Input attachments', value: 'Text files' }],
        },
      ]);
    });

    it('maps a fetched toolset DeploymentDetailsDto into authentication and Tools tab data', async () => {
      const deployments = [
        { id: 'search-tool', displayName: 'Search Tool', type: 'toolset' },
      ] as DeploymentItemDto[];
      vi.mocked(getDeploymentDetails).mockResolvedValue({
        id: 'search-tool',
        type: 'toolset',
        toolsetDetails: {
          transport: 'HTTP',
          allowedTools: ['search', 'fetch'],
          allToolNames: ['search', 'fetch', 'browse'],
          owner: 'Anastasiia Harkot',
          features: { mcp: true, cache: false, systemPrompt: true },
          authSettings: {
            authenticationType: 'OAUTH',
            globalAuthStatus: 'SIGNED_OUT',
            appLevelAuthStatus: 'SIGNED_OUT',
            userLevelAuthStatus: 'SIGNED_IN',
            scopesSupported: ['read', 'write'],
            authorizationEndpoint: 'https://mcp.example.com/oauth/authorize',
            tokenEndpoint: 'https://mcp.example.com/oauth/token',
          },
        },
      } as never);

      const { result } = renderHook(() =>
        useCatalogItems(makeParams({ deployments })),
      );
      const item = result.current.visibleCatalogItems.find(
        (candidate) => candidate.id === 'search-tool',
      );
      const details = await result.current.onFetchDetails(requireItem(item));

      expect(details?.overview?.sections).toEqual([
        {
          title: 'Specification',
          specs: [
            { label: 'Authentication', value: 'OAUTH' },
            { label: 'Hosted by', value: 'Anastasiia Harkot' },
            { label: 'OAuth scopes', value: 'read · write' },
            {
              label: 'Authorization endpoint',
              value: 'https://mcp.example.com/oauth/authorize',
            },
            {
              label: 'Token endpoint',
              value: 'https://mcp.example.com/oauth/token',
            },
          ],
        },
      ]);
      expect((details as never as { tools: unknown }).tools).toEqual({
        tools: [{ name: 'search' }, { name: 'fetch' }],
      });
      expect(
        (details as never as { api: { resource: { endpointUrl: string } } }).api
          .resource.endpointUrl,
      ).toBe('https://dial.example.com/v1/toolset/search-tool/mcp');
    });

    it('resolves undefined without throwing when the details fetch fails', async () => {
      const deployments = [
        { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' },
      ] as DeploymentItemDto[];
      vi.mocked(getDeploymentDetails).mockRejectedValue(new Error('502'));

      const { result } = renderHook(() =>
        useCatalogItems(makeParams({ deployments })),
      );
      const item = result.current.visibleCatalogItems.find(
        (candidate) => candidate.id === 'gpt-4o',
      );

      await expect(
        result.current.onFetchDetails(requireItem(item)),
      ).resolves.toBeUndefined();
    });

    describe('skill details', () => {
      const makeManifestResponse = (body: string) =>
        new Response(body, {
          headers: { 'content-length': String(body.length) },
        });

      const skillFileItems = [
        {
          name: 'SKILL.md',
          path: 'SKILL.md',
          url: 'skills/my-bucket/analysis/revenue-skill/SKILL.md',
          bucket: 'my-bucket',
          nodeType: 'item' as const,
          updatedAt: 3,
        },
        {
          name: 'run.py',
          path: 'scripts/run.py',
          url: 'skills/my-bucket/analysis/revenue-skill/scripts/run.py',
          bucket: 'my-bucket',
          nodeType: 'item' as const,
          updatedAt: 4,
        },
      ];

      const mockSkillDetailRequests = (manifest: string) => {
        vi.mocked(downloadSkillFile).mockResolvedValue(
          makeManifestResponse(manifest),
        );
        vi.mocked(listSkillFiles).mockResolvedValue({
          bucket: 'my-bucket',
          path: 'analysis/revenue-skill',
          items: skillFileItems,
        });
      };

      const getSkillItem = (result: {
        current: ReturnType<typeof useCatalogItems>;
      }) =>
        requireItem(
          result.current.visibleCatalogItems.find(
            (candidate) =>
              candidate.id === 'skills/my-bucket/analysis/revenue-skill',
          ),
        );

      it('resolves a skill through the skills endpoints, never the deployment ones', async () => {
        vi.mocked(downloadSkillFile).mockResolvedValue(
          makeManifestResponse('Revenue skill manifest'),
        );
        vi.mocked(listSkillFiles).mockResolvedValue({
          bucket: 'my-bucket',
          path: 'analysis/revenue-skill',
          items: [
            {
              name: 'SKILL.md',
              path: 'SKILL.md',
              url: 'skills/my-bucket/analysis/revenue-skill/SKILL.md',
              bucket: 'my-bucket',
              nodeType: 'item',
              updatedAt: 3,
            },
          ],
        });

        const { result } = renderHook(() =>
          useCatalogItems(makeParams({ skills: [personalSkill] })),
        );
        const details = await result.current.onFetchDetails(
          getSkillItem(result),
        );

        expect(downloadSkillFile).toHaveBeenCalledWith(
          'my-bucket',
          'analysis/revenue-skill',
          'SKILL.md',
        );
        expect(listSkillFiles).toHaveBeenCalledWith({
          bucket: 'my-bucket',
          path: 'analysis/revenue-skill',
          filePath: '',
          recursive: true,
        });
        expect(getDeploymentDetails).not.toHaveBeenCalled();
        expect(getDeploymentLimits).not.toHaveBeenCalled();
        expect(details?.promptContent?.content).toContain(
          'Revenue skill manifest',
        );
      });

      it('keeps the file overview when the manifest read fails', async () => {
        vi.mocked(downloadSkillFile).mockRejectedValue(new Error('404'));
        vi.mocked(listSkillFiles).mockResolvedValue({
          bucket: 'my-bucket',
          path: 'analysis/revenue-skill',
          items: [],
        });

        const { result } = renderHook(() =>
          useCatalogItems(makeParams({ skills: [personalSkill] })),
        );
        const details = await result.current.onFetchDetails(
          getSkillItem(result),
        );

        expect(details?.overview).toBeDefined();
        expect(details?.promptContent).toBeUndefined();
      });

      it('keeps the manifest when the file listing fails', async () => {
        vi.mocked(downloadSkillFile).mockResolvedValue(
          makeManifestResponse('Revenue skill manifest'),
        );
        vi.mocked(listSkillFiles).mockRejectedValue(new Error('502'));

        const { result } = renderHook(() =>
          useCatalogItems(makeParams({ skills: [personalSkill] })),
        );
        const details = await result.current.onFetchDetails(
          getSkillItem(result),
        );

        expect(details?.promptContent?.content).toContain(
          'Revenue skill manifest',
        );
        expect(details?.overview).toBeUndefined();
      });

      it('resolves null when both skill requests fail', async () => {
        vi.mocked(downloadSkillFile).mockRejectedValue(new Error('404'));
        vi.mocked(listSkillFiles).mockRejectedValue(new Error('502'));

        const { result } = renderHook(() =>
          useCatalogItems(makeParams({ skills: [personalSkill] })),
        );
        const details = await result.current.onFetchDetails(
          getSkillItem(result),
        );

        expect(details).toBeUndefined();
      });

      it('drops an oversized manifest but keeps the overview', async () => {
        const oversized = 'x'.repeat(SKILL_MANIFEST_MAX_BYTES + 1);
        vi.mocked(downloadSkillFile).mockResolvedValue(
          makeManifestResponse(oversized),
        );
        vi.mocked(listSkillFiles).mockResolvedValue({
          bucket: 'my-bucket',
          path: 'analysis/revenue-skill',
          items: [],
        });

        const { result } = renderHook(() =>
          useCatalogItems(makeParams({ skills: [personalSkill] })),
        );
        const details = await result.current.onFetchDetails(
          getSkillItem(result),
        );

        expect(details?.overview).toBeDefined();
        expect(details?.promptContent).toBeUndefined();
      });

      it('lifts the frontmatter out of the body and into the summary and Specification', async () => {
        mockSkillDetailRequests(
          '---\nname: Revenue\ndescription: Finds revenue figures\nallowed_tools: [search]\n---\n\n# Instructions\nDo the thing.',
        );

        const { result } = renderHook(() =>
          useCatalogItems(makeParams({ skills: [personalSkill] })),
        );
        const details = await result.current.onFetchDetails(
          getSkillItem(result),
        );

        /* The fence and its keys must not survive into the rendered body. */
        expect(details?.promptContent?.content).not.toContain('allowed_tools');
        expect(details?.promptContent?.content).toContain('# Instructions');
        expect(details?.promptContent?.description).toBe(
          'Finds revenue figures',
        );
      });

      it('renders a manifest with no frontmatter as body only', async () => {
        mockSkillDetailRequests('# Instructions\nDo the thing.');

        const { result } = renderHook(() =>
          useCatalogItems(makeParams({ skills: [personalSkill] })),
        );
        const details = await result.current.onFetchDetails(
          getSkillItem(result),
        );

        expect(details?.promptContent?.content).toContain('# Instructions');
        expect(details?.promptContent?.description).toBeUndefined();
      });

      it('keeps the whole manifest as the body when its frontmatter is malformed', async () => {
        mockSkillDetailRequests(
          '---\ndescription: "unbalanced\n---\n\n# Instructions',
        );

        const { result } = renderHook(() =>
          useCatalogItems(makeParams({ skills: [personalSkill] })),
        );
        const details = await result.current.onFetchDetails(
          getSkillItem(result),
        );

        expect(details?.promptContent?.content).toContain('# Instructions');
        expect(details?.promptContent?.content).toContain('unbalanced');
      });

      it('builds a hierarchical file tree, keeping an empty grouping folder visible', async () => {
        vi.mocked(downloadSkillFile).mockResolvedValue(
          makeManifestResponse('# Instructions'),
        );
        vi.mocked(listSkillFiles).mockResolvedValue({
          bucket: 'my-bucket',
          path: 'analysis/revenue-skill',
          items: [
            ...skillFileItems,
            {
              name: 'scripts',
              path: 'scripts',
              url: 'skills/my-bucket/analysis/revenue-skill/scripts',
              bucket: 'my-bucket',
              nodeType: 'folder' as const,
              updatedAt: 5,
            },
            {
              name: 'assets',
              path: 'assets',
              url: 'skills/my-bucket/analysis/revenue-skill/assets',
              bucket: 'my-bucket',
              nodeType: 'folder' as const,
              updatedAt: 6,
            },
          ],
        });

        const { result } = renderHook(() =>
          useCatalogItems(makeParams({ skills: [personalSkill] })),
        );
        const details = await result.current.onFetchDetails(
          getSkillItem(result),
        );

        expect(details?.promptContent?.files).toEqual([
          { type: 'file', id: 'SKILL.md', name: 'SKILL.md' },
          {
            type: 'folder',
            id: 'assets',
            name: 'assets',
            items: [],
          },
          {
            type: 'folder',
            id: 'scripts',
            name: 'scripts',
            items: [{ type: 'file', id: 'scripts/run.py', name: 'run.py' }],
          },
        ]);
        expect(details?.promptContent?.selectedFileId).toBe('SKILL.md');
        expect(details?.overview?.sections[0].specs).toContainEqual({
          label: CatalogI18nKeys.DetailsSkillFileCount,
          value: '2',
        });
      });

      it('selects the manifest by its opaque listing id when Core returns a prefixed path', async () => {
        const manifestPath = 'analysis/revenue-skill/files/SKILL.md';
        vi.mocked(downloadSkillFile).mockResolvedValue(
          makeManifestResponse('# Instructions'),
        );
        vi.mocked(listSkillFiles).mockResolvedValue({
          bucket: 'my-bucket',
          path: 'analysis/revenue-skill',
          items: [
            {
              name: 'SKILL.md',
              path: manifestPath,
              parentPath: 'analysis/revenue-skill/files',
              url: `skills/my-bucket/${manifestPath}`,
              bucket: 'my-bucket',
              nodeType: 'item',
              updatedAt: 3,
            },
            {
              name: 'notes.md',
              path: 'analysis/revenue-skill/files/notes.md',
              parentPath: 'analysis/revenue-skill/files',
              url: 'skills/my-bucket/analysis/revenue-skill/files/notes.md',
              bucket: 'my-bucket',
              nodeType: 'item',
              updatedAt: 4,
            },
          ],
        });

        const { result } = renderHook(() =>
          useCatalogItems(makeParams({ skills: [personalSkill] })),
        );
        const details = await result.current.onFetchDetails(
          getSkillItem(result),
        );

        expect(details?.promptContent?.selectedFileId).toBe(manifestPath);
      });

      it('offers an empty tree when the file listing fails', async () => {
        vi.mocked(downloadSkillFile).mockResolvedValue(
          makeManifestResponse('# Instructions'),
        );
        vi.mocked(listSkillFiles).mockRejectedValue(new Error('502'));

        const { result } = renderHook(() =>
          useCatalogItems(makeParams({ skills: [personalSkill] })),
        );
        const details = await result.current.onFetchDetails(
          getSkillItem(result),
        );

        expect(details?.promptContent?.files).toEqual([]);
      });

      it('issues no request for a skill whose id is not a skill resource URL', async () => {
        const malformedSkill: SkillMetadataItemDto = {
          ...personalSkill,
          url: 'files/my-bucket/report.pdf',
        };

        const { result } = renderHook(() =>
          useCatalogItems(makeParams({ skills: [malformedSkill] })),
        );
        const item = requireItem(
          result.current.visibleCatalogItems.find(
            (candidate) => candidate.id === 'files/my-bucket/report.pdf',
          ),
        );

        await expect(
          result.current.onFetchDetails(item),
        ).resolves.toBeUndefined();
        expect(downloadSkillFile).not.toHaveBeenCalled();
        expect(listSkillFiles).not.toHaveBeenCalled();
      });
    });
  });
});
