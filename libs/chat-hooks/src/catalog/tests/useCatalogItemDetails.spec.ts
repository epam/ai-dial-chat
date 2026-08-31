import type { CatalogItem } from '@epam/ai-dial-catalog';
import type {
  DeploymentDetailsDto,
  DeploymentLimitsResponseDto,
  PromptResponseDto,
  SkillFileListResponseDto,
  SkillMetadataItemDto,
} from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeploymentLimitsLabels } from '../map-deployment-limits-to-catalog';
import type {
  CatalogDetailsApi,
  UseCatalogItemDetailsOptions,
} from '../useCatalogItemDetails';
import { useCatalogItemDetails } from '../useCatalogItemDetails';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const makeItem = (
  type: CatalogEntityType,
  id: string,
  overrides?: Partial<CatalogItem>,
): CatalogItem => ({
  id,
  type,
  name: 'Test item',
  version: '1.0',
  lastUsed: 'never',
  description: 'desc',
  folder: [],
  topics: [],
  ...overrides,
});

/** Produces a fake fetch `Response` whose bytes match `text`. */
const makeTextResponse = (
  text: string,
  contentType = 'text/plain',
): Response => {
  const bytes = new TextEncoder().encode(text);
  return {
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'content-length')
          return String(bytes.byteLength);
        if (name.toLowerCase() === 'content-type') return contentType;
        return null;
      },
    },
    arrayBuffer: () => Promise.resolve(bytes.buffer as ArrayBuffer),
  } as unknown as Response;
};

/** Fake response that reports `ok: false`. */
const makeErrorResponse = (status = 500): Response =>
  ({
    ok: false,
    status,
    headers: { get: () => null },
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  }) as unknown as Response;

const MANIFEST_TEXT = '---\ndescription: My skill\n---\nBody text';
const SKILL_ID = 'skills/my-bucket/my-skill';
const SKILL_BUCKET = 'my-bucket';
const SKILL_PATH = 'my-skill';

/** Stable empty array — avoids creating a new reference on every render call in `makeOptions`. */
const EMPTY_SKILLS: SkillMetadataItemDto[] = [];

const PROMPT_DTO: PromptResponseDto = {
  id: 'my-prompt',
  bucket: 'user-bucket',
  name: 'My Prompt',
  content: 'Hello {{name}}',
  folderId: '',
  createdAt: 0,
  updatedAt: 0,
};

const MODEL_DTO: DeploymentDetailsDto = {
  id: 'gpt-4o',
  type: 'model',
};

const AGENT_DTO: DeploymentDetailsDto = {
  id: 'my-agent',
  type: 'application',
};

const TOOLSET_DTO: DeploymentDetailsDto = {
  id: 'toolsets/public/search__1.0',
  type: 'toolset',
  toolsetDetails: {
    allowedTools: ['search', 'browse'],
  },
};

const MODEL_LIMITS: DeploymentLimitsResponseDto = {
  dayTokenStats: { total: 10_000, used: 5_000 },
};

const FILE_LIST: SkillFileListResponseDto = {
  bucket: SKILL_BUCKET,
  path: SKILL_PATH,
  items: [
    {
      name: 'SKILL.md',
      path: `${SKILL_PATH}/SKILL.md`,
      url: `skills/${SKILL_BUCKET}/${SKILL_PATH}/SKILL.md`,
      bucket: SKILL_BUCKET,
      nodeType: 'ITEM' as never,
      updatedAt: 0,
    },
  ],
};

const DEPLOYMENT_LIMITS_LABELS: DeploymentLimitsLabels = {
  tokenGroup: 'Tokens',
  tokensPerDay: 'Tokens/day',
  tokensPerWeek: 'Tokens/week',
  tokensPerMonth: 'Tokens/month',
  followsCostLimit: 'Follows cost limit',
  formatSpentCaption: (amount) => `$${amount} spent`,
  formatValueLabel: (used, total) => `${used}/${total}`,
  formatProgressAriaLabel: ({ label, used, total }) =>
    `${label}: ${used}/${total}`,
  formatFollowsCostLimitAriaLabel: ({ label, used }) => `${label}: ${used}`,
};

const DEFAULT_LABELS: Pick<
  UseCatalogItemDetailsOptions,
  'skillOverviewLabels' | 'promptOverviewLabels' | 'deploymentLimitsLabels'
> = {
  skillOverviewLabels: {
    whenToUseLabel: 'When to use',
    allowedToolsLabel: 'Allowed tools',
    bundledResourcesLabel: 'Bundled resources',
    specificationSectionTitle: 'Specification',
    authorLabel: 'Author',
    updatedLabel: 'Updated',
    fileCountLabel: 'File count',
    detailsSectionTitle: 'Details',
  },
  promptOverviewLabels: {
    authorLabel: 'Author',
    updatedLabel: 'Updated',
    sectionTitle: 'Details',
  },
  deploymentLimitsLabels: DEPLOYMENT_LIMITS_LABELS,
};

/* ── Mock api factory ─────────────────────────────────────────────────────── */

const makeApi = (
  overrides?: Partial<CatalogDetailsApi>,
): CatalogDetailsApi => ({
  getDeploymentDetails: vi.fn().mockResolvedValue(MODEL_DTO),
  getDeploymentLimits: vi.fn().mockResolvedValue(MODEL_LIMITS),
  getPrompt: vi.fn().mockResolvedValue(PROMPT_DTO),
  getPublicPrompt: vi.fn().mockResolvedValue(PROMPT_DTO),
  downloadSkillFile: vi.fn().mockResolvedValue(makeTextResponse(MANIFEST_TEXT)),
  listSkillFiles: vi.fn().mockResolvedValue(FILE_LIST),
  ...overrides,
});

const makeOptions = (
  api: CatalogDetailsApi,
  overrides?: Partial<UseCatalogItemDetailsOptions>,
): UseCatalogItemDetailsOptions => ({
  api,
  skills: EMPTY_SKILLS,
  isAdmin: false,
  dialCoreExternalUrl: 'https://dial.example.com',
  ...DEFAULT_LABELS,
  ...overrides,
});

/* ── Tests ────────────────────────────────────────────────────────────────── */

describe('useCatalogItemDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ── onFetchDetails — Prompt ─────────────────────────────────────────── */

  describe('onFetchDetails — Prompt', () => {
    it('calls getPublicPrompt for organisation prompts (not isMyApp, not sharedWithMe)', async () => {
      const api = makeApi();
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );
      const item = makeItem(
        CatalogEntityType.Prompt,
        'prompts/public/my-prompt',
      );

      const details = await result.current.onFetchDetails(item);

      expect(api.getPublicPrompt).toHaveBeenCalledWith(
        'prompts/public/my-prompt',
      );
      expect(api.getPrompt).not.toHaveBeenCalled();
      expect(details).toMatchObject({
        promptContent: { content: PROMPT_DTO.content },
      });
    });

    it('calls getPrompt(path, bucket) for a shared prompt with a resource URL', async () => {
      const api = makeApi();
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );
      const item = makeItem(
        CatalogEntityType.Prompt,
        'prompts/owner-bucket/Work/AI/summarize',
        { sharedWithMe: true },
      );

      await result.current.onFetchDetails(item);

      expect(api.getPrompt).toHaveBeenCalledWith(
        'Work/AI/summarize',
        'owner-bucket',
      );
    });

    it('calls getPrompt(item.id) for a personal prompt with a bare path', async () => {
      const api = makeApi();
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );
      const item = makeItem(CatalogEntityType.Prompt, 'Work/AI/summarize', {
        isMyApp: true,
      });

      await result.current.onFetchDetails(item);

      expect(api.getPrompt).toHaveBeenCalledWith('Work/AI/summarize');
    });

    it('returns promptContent and overview on success', async () => {
      const api = makeApi();
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      const details = await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Prompt, 'prompts/public/my-prompt'),
      );

      expect(details?.promptContent?.content).toBe(PROMPT_DTO.content);
    });

    it('returns undefined when prompt fetch throws', async () => {
      const api = makeApi({
        getPublicPrompt: vi.fn().mockRejectedValue(new Error('not found')),
      });
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      const details = await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Prompt, 'my-prompt'),
      );

      expect(details).toBeUndefined();
    });
  });

  /* ── onFetchDetails — Skill ──────────────────────────────────────────── */

  describe('onFetchDetails — Skill', () => {
    it('returns promptContent and overview when both manifest and files resolve', async () => {
      const api = makeApi();
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      const details = await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Skill, SKILL_ID),
      );

      expect(details).toBeDefined();
      /* The manifest body is returned as promptContent.content */
      expect(details?.promptContent?.content).toBe('Body text');
    });

    it('returns undefined for a malformed skill id', async () => {
      const api = makeApi();
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      const details = await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Skill, 'not-a-skill-url'),
      );

      expect(details).toBeUndefined();
    });

    it('returns overview only when manifest download fails', async () => {
      const api = makeApi({
        downloadSkillFile: vi.fn().mockRejectedValueOnce(new Error('network')),
      });
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      const details = await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Skill, SKILL_ID),
      );

      /* No manifest → no promptContent; files still resolved → overview present */
      expect(details?.promptContent).toBeUndefined();
    });

    it('downloads the manifest using bucket, path, and SKILL_MANIFEST_FILE', async () => {
      const api = makeApi();
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Skill, SKILL_ID),
      );

      expect(api.downloadSkillFile).toHaveBeenCalledWith(
        SKILL_BUCKET,
        SKILL_PATH,
        'SKILL.md',
      );
    });

    it('lists files recursively', async () => {
      const api = makeApi();
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Skill, SKILL_ID),
      );

      expect(api.listSkillFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          bucket: SKILL_BUCKET,
          path: SKILL_PATH,
          recursive: true,
        }),
      );
    });

    it('returns undefined when both manifest and file list fail', async () => {
      const api = makeApi({
        downloadSkillFile: vi.fn().mockRejectedValue(new Error('network')),
        listSkillFiles: vi.fn().mockRejectedValue(new Error('network')),
      });
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      const details = await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Skill, SKILL_ID),
      );

      expect(details).toBeUndefined();
    });

    it('includes the description frontmatter field in promptContent', async () => {
      const api = makeApi({
        downloadSkillFile: vi
          .fn()
          .mockResolvedValue(makeTextResponse(MANIFEST_TEXT)),
      });
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      const details = await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Skill, SKILL_ID),
      );

      expect(details?.promptContent?.description).toBe('My skill');
    });
  });

  /* ── onFetchDetails — Deployment (MODEL) ─────────────────────────────── */

  describe('onFetchDetails — Model', () => {
    it('calls getDeploymentDetails and getDeploymentLimits', async () => {
      const api = makeApi({
        getDeploymentDetails: vi.fn().mockResolvedValue(MODEL_DTO),
      });
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Model, 'gpt-4o'),
      );

      expect(api.getDeploymentDetails).toHaveBeenCalledWith('gpt-4o');
      expect(api.getDeploymentLimits).toHaveBeenCalledWith('gpt-4o');
    });

    it('returns the mapped limits in the result', async () => {
      const api = makeApi({
        getDeploymentDetails: vi.fn().mockResolvedValue(MODEL_DTO),
        getDeploymentLimits: vi.fn().mockResolvedValue(MODEL_LIMITS),
      });
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      const details = await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Model, 'gpt-4o'),
      );

      expect(details?.limits).toBeDefined();
    });

    it('still resolves when getDeploymentLimits rejects (limits are optional)', async () => {
      const api = makeApi({
        getDeploymentDetails: vi.fn().mockResolvedValue(MODEL_DTO),
        getDeploymentLimits: vi.fn().mockRejectedValue(new Error('403')),
      });
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      const details = await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Model, 'gpt-4o'),
      );

      expect(details).toBeDefined();
      expect(details?.limits).toBeUndefined();
    });
  });

  /* ── onFetchDetails — Deployment (AGENT) ─────────────────────────────── */

  describe('onFetchDetails — Agent', () => {
    it('does not call getDeploymentLimits for an Agent', async () => {
      const api = makeApi({
        getDeploymentDetails: vi.fn().mockResolvedValue(AGENT_DTO),
      });
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Agent, 'my-agent'),
      );

      expect(api.getDeploymentLimits).not.toHaveBeenCalled();
    });

    it('returns defined details on success', async () => {
      const api = makeApi({
        getDeploymentDetails: vi.fn().mockResolvedValue(AGENT_DTO),
      });
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      const details = await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Agent, 'my-agent'),
      );

      expect(details).toBeDefined();
    });
  });

  /* ── onFetchDetails — Deployment (TOOLSET) ───────────────────────────── */

  describe('onFetchDetails — Toolset', () => {
    it('maps credentials via mapToolsetCredentials', async () => {
      const api = makeApi({
        getDeploymentDetails: vi.fn().mockResolvedValue(TOOLSET_DTO),
      });
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api, { isAdmin: true })),
      );

      const details = await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Toolset, 'toolsets/public/search__1.0'),
      );

      expect(details?.credentials).toBeDefined();
    });

    it('does not call getDeploymentLimits for a Toolset', async () => {
      const api = makeApi({
        getDeploymentDetails: vi.fn().mockResolvedValue(TOOLSET_DTO),
      });
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Toolset, 'toolsets/public/search__1.0'),
      );

      expect(api.getDeploymentLimits).not.toHaveBeenCalled();
    });
  });

  /* ── onFetchDetails — Deployment error ──────────────────────────────── */

  it('returns undefined when getDeploymentDetails throws', async () => {
    const api = makeApi({
      getDeploymentDetails: vi.fn().mockRejectedValue(new Error('500')),
    });
    const { result } = renderHook(() =>
      useCatalogItemDetails(makeOptions(api)),
    );

    const details = await result.current.onFetchDetails(
      makeItem(CatalogEntityType.Model, 'gpt-4o'),
    );

    expect(details).toBeUndefined();
  });

  /* ── onLoadContentFile ───────────────────────────────────────────────── */

  describe('onLoadContentFile', () => {
    it('returns undefined when no skill details have been opened', async () => {
      const api = makeApi();
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      const text = await result.current.onLoadContentFile('SKILL.md');

      expect(text).toBeUndefined();
    });

    it('returns undefined for a folder-like file id (no download path)', async () => {
      const api = makeApi();
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      /* Open a skill first to set openSkillRef */
      await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Skill, SKILL_ID),
      );

      /* The root `files/` directory id — resolveSkillFileDownloadPath returns null for it */
      const text = await result.current.onLoadContentFile(
        `${SKILL_PATH}/files`,
      );

      expect(text).toBeUndefined();
    });

    it('returns text content for a valid file inside the open skill', async () => {
      const fileText = 'const x = 1;';
      const api = makeApi({
        downloadSkillFile: vi
          .fn()
          .mockResolvedValueOnce(
            makeTextResponse(MANIFEST_TEXT),
          ) /* onFetchDetails */
          .mockResolvedValueOnce(
            makeTextResponse(fileText),
          ) /* onLoadContentFile */,
      });
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Skill, SKILL_ID),
      );
      const text = await result.current.onLoadContentFile(
        `skills/${SKILL_BUCKET}/${SKILL_PATH}/util.ts`,
      );

      expect(text).toBe(fileText);
    });

    it('parses the manifest body when loading SKILL.md', async () => {
      const api = makeApi({
        downloadSkillFile: vi
          .fn()
          .mockResolvedValue(makeTextResponse(MANIFEST_TEXT)),
      });
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Skill, SKILL_ID),
      );
      const text = await result.current.onLoadContentFile(
        `${SKILL_PATH}/files/SKILL.md`,
      );

      /* Body section of the manifest (after the frontmatter fence) */
      expect(text).toBe('Body text');
    });
  });

  /* ── onLoadSkillDetailsFile ──────────────────────────────────────────── */

  describe('onLoadSkillDetailsFile', () => {
    it('throws when no skill details have been opened', async () => {
      const api = makeApi();
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      await expect(
        result.current.onLoadSkillDetailsFile('SKILL.md'),
      ).rejects.toThrow('No skill details are open');
    });

    it('throws for a folder id (resolveSkillFileDownloadPath returns null)', async () => {
      const api = makeApi();
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );
      await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Skill, SKILL_ID),
      );

      await expect(
        result.current.onLoadSkillDetailsFile(`${SKILL_PATH}/files`),
      ).rejects.toThrow('folder cannot be previewed');
    });

    it('throws with the HTTP status when the download responds with an error', async () => {
      const api = makeApi({
        downloadSkillFile: vi
          .fn()
          .mockResolvedValueOnce(
            makeTextResponse(MANIFEST_TEXT),
          ) /* onFetchDetails */
          .mockResolvedValueOnce(
            makeErrorResponse(403),
          ) /* onLoadSkillDetailsFile */,
      });
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Skill, SKILL_ID),
      );

      const err: unknown = await result.current
        .onLoadSkillDetailsFile(`skills/${SKILL_BUCKET}/${SKILL_PATH}/util.ts`)
        .catch((e) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as { status: number }).status).toBe(403);
    });

    it('throws when the file exceeds the preview size limit', async () => {
      /* Create a buffer just over the 256 KiB limit */
      const bigBytes = new Uint8Array(256 * 1024 + 1);
      const bigResponse = {
        ok: true,
        status: 200,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'content-length'
              ? String(bigBytes.byteLength)
              : null,
        },
        arrayBuffer: () => Promise.resolve(bigBytes.buffer as ArrayBuffer),
      } as unknown as Response;

      const api = makeApi({
        downloadSkillFile: vi
          .fn()
          .mockResolvedValueOnce(makeTextResponse(MANIFEST_TEXT))
          .mockResolvedValueOnce(bigResponse),
      });
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Skill, SKILL_ID),
      );

      await expect(
        result.current.onLoadSkillDetailsFile(
          `skills/${SKILL_BUCKET}/${SKILL_PATH}/big-file.bin`,
        ),
      ).rejects.toThrow('preview size limit');
    });

    it('returns bytes and mimeType for a valid file', async () => {
      const api = makeApi({
        downloadSkillFile: vi
          .fn()
          .mockResolvedValueOnce(makeTextResponse(MANIFEST_TEXT))
          .mockResolvedValueOnce(
            makeTextResponse('ts source', 'text/typescript'),
          ),
      });
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Skill, SKILL_ID),
      );

      const file = await result.current.onLoadSkillDetailsFile(
        `skills/${SKILL_BUCKET}/${SKILL_PATH}/util.ts`,
      );

      expect(file.bytes).toBeInstanceOf(Uint8Array);
      expect(file.mimeType).toBe('text/typescript');
    });

    it('strips the generic application/octet-stream mime type', async () => {
      const api = makeApi({
        downloadSkillFile: vi
          .fn()
          .mockResolvedValueOnce(makeTextResponse(MANIFEST_TEXT))
          .mockResolvedValueOnce(
            makeTextResponse('data', 'application/octet-stream'),
          ),
      });
      const { result } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      await result.current.onFetchDetails(
        makeItem(CatalogEntityType.Skill, SKILL_ID),
      );

      const file = await result.current.onLoadSkillDetailsFile(
        `skills/${SKILL_BUCKET}/${SKILL_PATH}/data.bin`,
      );

      expect(file.mimeType).toBeUndefined();
    });
  });

  /* ── Callback stability ─────────────────────────────────────────────── */

  describe('callback stability', () => {
    it('onFetchDetails is stable across unrelated re-renders', async () => {
      const api = makeApi();
      const { result, rerender } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      await waitFor(() => expect(result.current.onFetchDetails).toBeDefined());

      const before = result.current.onFetchDetails;
      rerender();

      expect(result.current.onFetchDetails).toBe(before);
    });

    it('onLoadContentFile is stable across unrelated re-renders', () => {
      const api = makeApi();
      const { result, rerender } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      const before = result.current.onLoadContentFile;
      rerender();

      expect(result.current.onLoadContentFile).toBe(before);
    });

    it('onLoadSkillDetailsFile is stable across unrelated re-renders', () => {
      const api = makeApi();
      const { result, rerender } = renderHook(() =>
        useCatalogItemDetails(makeOptions(api)),
      );

      const before = result.current.onLoadSkillDetailsFile;
      rerender();

      expect(result.current.onLoadSkillDetailsFile).toBe(before);
    });

    it('onFetchDetails changes identity when the api reference changes', () => {
      const api1 = makeApi();
      const api2 = makeApi();

      const { result, rerender } = renderHook(
        ({ api }: { api: CatalogDetailsApi }) =>
          useCatalogItemDetails(makeOptions(api)),
        { initialProps: { api: api1 } },
      );

      const before = result.current.onFetchDetails;
      rerender({ api: api2 });

      expect(result.current.onFetchDetails).not.toBe(before);
    });
  });

  /* ── openSkillRef mutation ──────────────────────────────────────────── */

  it('updates the open skill when a second skill is fetched', async () => {
    const SKILL_2 = 'skills/other-bucket/other-skill';
    const api = makeApi();
    const { result } = renderHook(() =>
      useCatalogItemDetails(makeOptions(api)),
    );

    /* Open first skill */
    await result.current.onFetchDetails(
      makeItem(CatalogEntityType.Skill, SKILL_ID),
    );
    /* Open second skill */
    await result.current.onFetchDetails(
      makeItem(CatalogEntityType.Skill, SKILL_2),
    );

    /* Subsequent file operation should use the second skill's coordinates */
    vi.mocked(api.downloadSkillFile).mockResolvedValueOnce(
      makeTextResponse('content'),
    );
    await result.current.onLoadContentFile(
      `skills/other-bucket/other-skill/util.ts`,
    );

    const lastCall = vi.mocked(api.downloadSkillFile).mock.calls.at(-1);
    expect(lastCall?.[0]).toBe('other-bucket');
    expect(lastCall?.[1]).toBe('other-skill');
  });
});
