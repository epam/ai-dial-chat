import type { CatalogItem } from '@epam/ai-dial-catalog';
import type { PromptResponseDto } from '@epam/ai-dial-chat-api-client';
import { FavoriteEntityType } from '@epam/ai-dial-chat-hooks';
import {
  CatalogEntityType,
  triggerBlobDownload,
} from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { isValidElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillDetailsFilePreview } from '../../../components/CatalogView/SkillDetailsFilePreview';
import { CatalogI18nKeys } from '../../../constants/translation-keys';
import { getPrompt, getPublicPrompt } from '../../../server-api/prompts.api';
import { downloadSkill } from '../../../server-api/skills.api';
import { ROUTES } from '../../../types/routes';
import { triggerBrowserDownload } from '../../../utils/file-download';
import { useCatalogItemActions } from '../useCatalogItemActions';

vi.mock('../../../server-api/prompts.api', () => ({
  getPrompt: vi.fn(),
  getPublicPrompt: vi.fn(),
}));

vi.mock('../../../server-api/skills.api', () => ({
  downloadSkill: vi.fn(),
}));

vi.mock('../../../utils/file-download', () => ({
  triggerBrowserDownload: vi.fn(),
}));

/* Only the download trigger is stubbed; the mappers still need the real helpers. */
vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-shared')>()),
  triggerBlobDownload: vi.fn(),
}));

/* Matches the global `react-i18next` mock (`t(key) => key`) used by every other spec in this app. */
const t = ((key: string) => key) as unknown as TFunction;

const makeCatalogItem = (overrides?: Partial<CatalogItem>): CatalogItem => ({
  id: 'gpt-4o',
  type: CatalogEntityType.Model,
  name: 'GPT-4o',
  version: '1.0',
  lastUsed: 'now',
  description: '',
  folder: [],
  topics: [],
  isMyApp: true,
  ...overrides,
});

type UseCatalogItemActionsParams = Parameters<typeof useCatalogItemActions>[0];

const renderItemActions = (
  overrides: Partial<UseCatalogItemActionsParams> = {},
) => {
  const navigate = vi.fn();
  const onClose = vi.fn();
  const onSelect = vi.fn();
  const setSelectedItemId = vi.fn();
  const toggleFavorite = vi.fn().mockResolvedValue(undefined);
  const showSuccessNotification = vi.fn();
  const showErrorNotification = vi.fn();
  const notifyOperationSuccess = vi.fn();
  const onLoadSkillDetailsFile = vi
    .fn()
    .mockResolvedValue({ bytes: new ArrayBuffer(0) });

  const view = renderHook(() =>
    useCatalogItemActions({
      t,
      navigate,
      onClose,
      onSelect: undefined,
      setSelectedItemId,
      catalogItems: [],
      isLoading: false,
      toggleFavorite,
      showSuccessNotification,
      showErrorNotification,
      notifyOperationSuccess,
      onLoadSkillDetailsFile,
      ...overrides,
    }),
  );

  return {
    ...view,
    navigate,
    onClose,
    onSelect,
    setSelectedItemId,
    toggleFavorite,
    showSuccessNotification,
    showErrorNotification,
    notifyOperationSuccess,
    onLoadSkillDetailsFile,
  };
};

describe('useCatalogItemActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchPromptDto', () => {
    it('fetches a personal prompt through getPrompt', async () => {
      const dto: PromptResponseDto = {
        id: 'prompts/my-bucket/Work/AI/summarize',
        name: 'summarize',
        description: '',
        content: 'Summarize',
        folderId: 'Work/AI',
        createdAt: 1,
        updatedAt: 2,
      };
      vi.mocked(getPrompt).mockResolvedValue(dto);
      const { result } = renderItemActions();
      const item = makeCatalogItem({
        id: 'prompts/my-bucket/Work/AI/summarize',
        type: CatalogEntityType.Prompt,
      });

      const resolved = await result.current.fetchPromptDto(item);

      expect(getPrompt).toHaveBeenCalledWith(
        'prompts/my-bucket/Work/AI/summarize',
      );
      expect(getPublicPrompt).not.toHaveBeenCalled();
      expect(resolved).toBe(dto);
    });

    it('fetches an organisation prompt through getPublicPrompt using its bucket-relative path', async () => {
      const dto: PromptResponseDto = {
        id: 'prompts/public/Public/translate',
        name: 'translate',
        description: '',
        content: 'Translate',
        folderId: 'Public',
        createdAt: 1,
        updatedAt: 2,
      };
      vi.mocked(getPublicPrompt).mockResolvedValue(dto);
      const { result } = renderItemActions();
      const item = makeCatalogItem({
        id: 'prompts/public/Public/translate',
        type: CatalogEntityType.Prompt,
        isMyApp: false,
      });

      await result.current.fetchPromptDto(item);

      expect(getPublicPrompt).toHaveBeenCalledWith('Public/translate');
      expect(getPrompt).not.toHaveBeenCalled();
    });
  });

  describe('onToggleFavorite', () => {
    it('toggles a toolset favorite and shows a success notification', async () => {
      const { result, toggleFavorite, showSuccessNotification } =
        renderItemActions({
          catalogItems: [
            makeCatalogItem({
              id: 'toolsets/b/search__0.0.1',
              type: CatalogEntityType.Toolset,
              name: 'Search',
            }),
          ],
        });

      await result.current.onToggleFavorite('toolsets/b/search__0.0.1', true);

      expect(toggleFavorite).toHaveBeenCalledWith(
        'toolsets/b/search__0.0.1',
        true,
        FavoriteEntityType.Toolset,
      );
      expect(showSuccessNotification).toHaveBeenCalled();
    });

    it('toggles a prompt favorite and shows a success notification', async () => {
      const { result, toggleFavorite, showSuccessNotification } =
        renderItemActions({
          catalogItems: [
            makeCatalogItem({
              id: 'prompts/my-bucket/Work/AI/summarize',
              type: CatalogEntityType.Prompt,
              name: 'summarize',
            }),
          ],
        });

      await result.current.onToggleFavorite(
        'prompts/my-bucket/Work/AI/summarize',
        true,
      );

      expect(toggleFavorite).toHaveBeenCalledWith(
        'prompts/my-bucket/Work/AI/summarize',
        true,
        FavoriteEntityType.Prompt,
      );
      expect(showSuccessNotification).toHaveBeenCalled();
    });

    it('does nothing while the catalog is still loading', async () => {
      const { result, toggleFavorite } = renderItemActions({
        isLoading: true,
      });

      await result.current.onToggleFavorite('gpt-4o', true);

      expect(toggleFavorite).not.toHaveBeenCalled();
    });

    it('shows an error notification carrying the trace id when toggleFavorite rejects', async () => {
      const toggleFavorite = vi.fn().mockRejectedValue(new Error('502'));
      const { result, showErrorNotification, showSuccessNotification } =
        renderItemActions({ toggleFavorite });

      await result.current.onToggleFavorite('gpt-4o', true);

      expect(showErrorNotification).toHaveBeenCalled();
      expect(showSuccessNotification).not.toHaveBeenCalled();
    });
  });

  describe('handleUseInChat', () => {
    it('selects the model as the deployment and navigates to the root route', async () => {
      const { result, navigate, setSelectedItemId } = renderItemActions();
      const item = makeCatalogItem({
        id: 'gpt-4o',
        type: CatalogEntityType.Model,
      });

      await result.current.handleUseInChat(item);

      expect(setSelectedItemId).toHaveBeenCalledWith('gpt-4o');
      expect(navigate).toHaveBeenCalledWith(ROUTES.Root, {
        state: { deploymentId: 'gpt-4o' },
      });
    });

    it('selects the application as the deployment and navigates to the root route', async () => {
      const { result, navigate, setSelectedItemId } = renderItemActions();
      const item = makeCatalogItem({
        id: 'my-app',
        type: CatalogEntityType.Agent,
        name: 'My App',
      });

      await result.current.handleUseInChat(item);

      expect(setSelectedItemId).toHaveBeenCalledWith('my-app');
      expect(navigate).toHaveBeenCalledWith(ROUTES.Root, {
        state: { deploymentId: 'my-app' },
      });
    });

    it('navigates to the composer with the body in router state, leaving the deployment selection alone', async () => {
      const { result, navigate, setSelectedItemId } = renderItemActions();
      const item = makeCatalogItem({
        id: 'prompts/my-bucket/Work/AI/summarize',
        type: CatalogEntityType.Prompt,
        name: 'summarize',
        details: {
          promptContent: { content: 'Summarize the following text:' },
        } as CatalogItem['details'],
      });

      await result.current.handleUseInChat(item);

      expect(navigate).toHaveBeenCalledWith(ROUTES.Root, {
        state: { promptContent: 'Summarize the following text:' },
      });
      expect(setSelectedItemId).not.toHaveBeenCalled();
    });

    it('resolves the body through getPrompt when the item did not carry it', async () => {
      vi.mocked(getPrompt).mockResolvedValue({
        id: 'prompts/my-bucket/Work/AI/summarize',
        name: 'summarize',
        description: '',
        content: 'Summarize the following text:',
        folderId: 'Work/AI',
        createdAt: 1,
        updatedAt: 2,
      });
      const { result, navigate } = renderItemActions();
      const item = makeCatalogItem({
        id: 'prompts/my-bucket/Work/AI/summarize',
        type: CatalogEntityType.Prompt,
        name: 'summarize',
      });

      await result.current.handleUseInChat(item);

      expect(getPrompt).toHaveBeenCalledWith(
        'prompts/my-bucket/Work/AI/summarize',
      );
      expect(navigate).toHaveBeenCalledWith(ROUTES.Root, {
        state: { promptContent: 'Summarize the following text:' },
      });
    });

    it('navigates with a pendingPrompt payload instead of raw content when the prompt has parameters', async () => {
      const { result, navigate } = renderItemActions();
      const item = makeCatalogItem({
        id: 'prompts/my-bucket/Work/AI/summarize',
        type: CatalogEntityType.Prompt,
        name: 'summarize',
        description: 'A summarizer prompt',
        details: {
          promptContent: {
            content: 'Summarize {{text}} in {{tone}} tone',
          },
        } as CatalogItem['details'],
      });

      await result.current.handleUseInChat(item);

      expect(navigate).toHaveBeenCalledWith(ROUTES.Root, {
        state: {
          pendingPrompt: {
            id: 'prompts/my-bucket/Work/AI/summarize',
            name: 'summarize',
            content: 'Summarize {{text}} in {{tone}} tone',
            description: 'A summarizer prompt',
          },
        },
      });
    });

    it('stays on the catalog and notifies when the body cannot be resolved', async () => {
      vi.mocked(getPrompt).mockRejectedValue(new Error('502'));
      const { result, navigate, showErrorNotification } = renderItemActions();
      const item = makeCatalogItem({
        id: 'prompts/my-bucket/Work/AI/summarize',
        type: CatalogEntityType.Prompt,
        name: 'summarize',
      });

      await result.current.handleUseInChat(item);

      expect(showErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: CatalogI18nKeys.DetailsPromptLoadError,
        }),
      );
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('isPrimaryActionVisible', () => {
    it('is always visible for a prompt item', () => {
      const { result } = renderItemActions();

      expect(
        result.current.isPrimaryActionVisible(
          makeCatalogItem({ type: CatalogEntityType.Prompt }),
        ),
      ).toBe(true);
    });

    it('is hidden for a Toolset item', () => {
      const { result } = renderItemActions();

      expect(
        result.current.isPrimaryActionVisible(
          makeCatalogItem({ type: CatalogEntityType.Toolset }),
        ),
      ).toBe(false);
    });

    it('is hidden for an Application with no chat interface', () => {
      const { result } = renderItemActions();

      expect(
        result.current.isPrimaryActionVisible(
          makeCatalogItem({
            type: CatalogEntityType.Agent,
            supportsChat: false,
          }),
        ),
      ).toBe(false);
    });

    it('is visible for an Application supporting chat', () => {
      const { result } = renderItemActions();

      expect(
        result.current.isPrimaryActionVisible(
          makeCatalogItem({ type: CatalogEntityType.Agent }),
        ),
      ).toBe(true);
    });
  });

  describe('handleCardSelect', () => {
    it('commits the pick to setSelectedItemId when no onSelect is supplied', () => {
      const { result, setSelectedItemId, onSelect, onClose } =
        renderItemActions({ onSelect: undefined });
      const item = makeCatalogItem({ id: 'gpt-4o' });

      result.current.handleCardSelect(item);

      expect(setSelectedItemId).toHaveBeenCalledWith('gpt-4o');
      expect(onSelect).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('routes the pick through onSelect instead of setSelectedItemId when onSelect is supplied', () => {
      const onSelect = vi.fn();
      const { result, setSelectedItemId, onClose } = renderItemActions({
        onSelect,
      });
      const item = makeCatalogItem({ id: 'gpt-4o' });

      result.current.handleCardSelect(item);

      expect(onSelect).toHaveBeenCalledWith('gpt-4o');
      expect(setSelectedItemId).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  describe('isDownloadVisible', () => {
    it('offers download for a prompt and a skill', () => {
      const { result } = renderItemActions();

      expect(
        result.current.isDownloadVisible(
          makeCatalogItem({ type: CatalogEntityType.Prompt }),
        ),
      ).toBe(true);
      expect(
        result.current.isDownloadVisible(
          makeCatalogItem({ type: CatalogEntityType.Skill }),
        ),
      ).toBe(true);
    });

    it('offers no download for an item that is not a prompt or a skill', () => {
      const { result } = renderItemActions();

      expect(
        result.current.isDownloadVisible(
          makeCatalogItem({ type: CatalogEntityType.Model }),
        ),
      ).toBe(false);
    });
  });

  describe('handleDownload — prompt', () => {
    const personalPrompt: PromptResponseDto = {
      id: 'prompts/my-bucket/Work/AI/summarize',
      name: 'summarize',
      description: 'Summarize a document',
      content: 'Summarize:\n\n{{document}}',
      folderId: 'Work/AI',
      createdAt: 1,
      updatedAt: 2,
    };

    it('confirms a completed download with a success notification', async () => {
      vi.mocked(getPrompt).mockResolvedValue(personalPrompt);
      const { result, notifyOperationSuccess } = renderItemActions();
      const item = makeCatalogItem({
        id: personalPrompt.id,
        type: CatalogEntityType.Prompt,
        name: personalPrompt.name,
      });

      await result.current.handleDownload(item);

      expect(triggerBlobDownload).toHaveBeenCalledOnce();
      expect(notifyOperationSuccess).toHaveBeenCalled();
    });

    it('raises no success notification when the download fails', async () => {
      vi.mocked(getPrompt).mockRejectedValue(new Error('boom'));
      const { result, notifyOperationSuccess, showErrorNotification } =
        renderItemActions();
      const item = makeCatalogItem({
        id: personalPrompt.id,
        type: CatalogEntityType.Prompt,
        name: personalPrompt.name,
      });

      await result.current.handleDownload(item);

      expect(triggerBlobDownload).not.toHaveBeenCalled();
      expect(notifyOperationSuccess).not.toHaveBeenCalled();
      expect(showErrorNotification).toHaveBeenCalled();
    });

    it('reports a failed download and writes no file', async () => {
      vi.mocked(getPrompt).mockRejectedValue(new Error('502'));
      const { result, showErrorNotification } = renderItemActions();
      const item = makeCatalogItem({
        id: personalPrompt.id,
        type: CatalogEntityType.Prompt,
        name: personalPrompt.name,
      });

      await result.current.handleDownload(item);

      expect(showErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: CatalogI18nKeys.DetailsPromptDownloadError,
        }),
      );
      expect(triggerBlobDownload).not.toHaveBeenCalled();
    });
  });

  describe('handleDownload — skill archive', () => {
    it('downloads the whole skill through the archive endpoint and notifies success', async () => {
      vi.mocked(downloadSkill).mockResolvedValue(new Response('zip-bytes'));
      const { result, notifyOperationSuccess } = renderItemActions();
      const item = makeCatalogItem({
        id: 'skills/my-bucket/analysis/revenue-skill',
        type: CatalogEntityType.Skill,
        name: 'revenue-skill',
      });

      await result.current.handleDownload(item);

      expect(downloadSkill).toHaveBeenCalledWith(
        'my-bucket',
        'analysis/revenue-skill',
      );
      expect(triggerBrowserDownload).toHaveBeenCalledOnce();
      expect(notifyOperationSuccess).toHaveBeenCalled();
    });

    it('reports a failed download and shows no success notification', async () => {
      vi.mocked(downloadSkill).mockRejectedValue(new Error('502'));
      const { result, notifyOperationSuccess, showErrorNotification } =
        renderItemActions();
      const item = makeCatalogItem({
        id: 'skills/my-bucket/analysis/revenue-skill',
        type: CatalogEntityType.Skill,
        name: 'revenue-skill',
      });

      await result.current.handleDownload(item);

      expect(showErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: CatalogI18nKeys.DetailsSkillDownloadError,
        }),
      );
      expect(notifyOperationSuccess).not.toHaveBeenCalled();
      expect(triggerBrowserDownload).not.toHaveBeenCalled();
    });

    it('treats a non-OK response as a failure without decoding the body', async () => {
      vi.mocked(downloadSkill).mockResolvedValue(
        new Response('error body', { status: 500 }),
      );
      const { result, showErrorNotification } = renderItemActions();
      const item = makeCatalogItem({
        id: 'skills/my-bucket/analysis/revenue-skill',
        type: CatalogEntityType.Skill,
        name: 'revenue-skill',
      });

      await result.current.handleDownload(item);

      expect(showErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.any(String) }),
      );
      expect(triggerBrowserDownload).not.toHaveBeenCalled();
    });

    it('builds the fallback filename from the sanitized skill name', async () => {
      vi.mocked(downloadSkill).mockResolvedValue(new Response('zip-bytes'));
      const { result } = renderItemActions();
      const item = makeCatalogItem({
        id: 'skills/my-bucket/analysis/revenue-skill',
        type: CatalogEntityType.Skill,
        name: 'revenue-skill',
      });

      await result.current.handleDownload(item);

      expect(triggerBrowserDownload).toHaveBeenCalledWith(
        expect.anything(),
        'revenue-skill.zip',
      );
    });

    it('sanitizes unsafe characters out of the fallback filename', async () => {
      vi.mocked(downloadSkill).mockResolvedValue(new Response('zip-bytes'));
      const { result } = renderItemActions();
      const item = makeCatalogItem({
        id: 'skills/my-bucket/analysis/revenue-skill',
        type: CatalogEntityType.Skill,
        name: 'revenue:skill/v2',
      });

      await result.current.handleDownload(item);

      expect(triggerBrowserDownload).toHaveBeenCalledWith(
        expect.anything(),
        expect.not.stringMatching(/[:/]/),
      );
    });

    it('passes a Unicode skill name through unchanged in the fallback filename', async () => {
      vi.mocked(downloadSkill).mockResolvedValue(new Response('zip-bytes'));
      const { result } = renderItemActions();
      const item = makeCatalogItem({
        id: 'skills/my-bucket/analysis/revenue-skill',
        type: CatalogEntityType.Skill,
        name: 'выручка-skill',
      });

      await result.current.handleDownload(item);

      expect(triggerBrowserDownload).toHaveBeenCalledWith(
        expect.anything(),
        'выручка-skill.zip',
      );
    });
  });

  describe('renderContentFilePreview', () => {
    it('supplies the shared Skill Builder preview component wired to onLoadSkillDetailsFile', () => {
      const { result, onLoadSkillDetailsFile } = renderItemActions();

      const view = result.current.renderContentFilePreview(
        'analysis/revenue-skill/files/openai.yaml',
        'openai.yaml',
      );

      expect(isValidElement(view)).toBe(true);
      const typed = view as ReturnType<
        typeof result.current.renderContentFilePreview
      > & {
        type: unknown;
        props: {
          fileId: string;
          fileName: string;
          onLoadFile: unknown;
        };
      };
      expect(typed.type).toBe(SkillDetailsFilePreview);
      expect(typed.props.fileId).toBe(
        'analysis/revenue-skill/files/openai.yaml',
      );
      expect(typed.props.fileName).toBe('openai.yaml');
      expect(typed.props.onLoadFile).toBe(onLoadSkillDetailsFile);
    });
  });
});
