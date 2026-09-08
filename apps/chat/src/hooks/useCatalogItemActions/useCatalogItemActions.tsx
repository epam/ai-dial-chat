import type { CatalogItem } from '@epam/ai-dial-catalog';
import type { PromptResponseDto } from '@epam/ai-dial-chat-api-client';
import {
  buildPromptExportEnvelope,
  buildPromptExportFileName,
  CatalogPrimaryActionType,
  EXPORT_APP_NAME,
  getApiErrorDetails,
  isOrganisationPromptItem,
  parsePromptResourceUrl,
  parseSkillResourceUrl,
  resolveCatalogPrimaryAction,
  sanitizeFileName,
  serializePromptExport,
  type SkillFileContent,
} from '@epam/ai-dial-chat-hooks';
import {
  CatalogEntityType,
  triggerBlobDownload,
} from '@epam/ai-dial-chat-shared';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { useCallback } from 'react';
import type { NavigateFunction } from 'react-router';
import { SkillDetailsFilePreview } from '../../components/CatalogView/SkillDetailsFilePreview';
import {
  CatalogI18nKeys,
  FavoritesI18nKeys,
} from '../../constants/translation-keys';
import { getPrompt, getPublicPrompt } from '../../server-api/prompts.api';
import { downloadSkill } from '../../server-api/skills.api';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../types/entity-notification';
import { ROUTES } from '../../types/routes';
import { resolveFavoriteEntityType } from '../../utils/favorites';
import { triggerBrowserDownload } from '../../utils/file-download';
import type { useOperationNotification } from '../useOperationNotification';

interface NotificationParams {
  message: string;
  title?: string;
  requestId?: string;
}

interface UseCatalogItemActionsParams {
  t: TFunction;
  navigate: NavigateFunction;
  /** Called after a card selection commits in picker mode, so the host can close the modal. */
  onClose?: () => void;
  /**
   * Called with the selected deployment's id when a card is picked in
   * selector mode, instead of committing the pick to `DeploymentsContext`.
   */
  onSelect?: (id: string) => void;
  setSelectedItemId: (id: string | null) => void;
  /** The full catalog item list, used to look up a toggled item's name/type. */
  catalogItems: CatalogItem[];
  /** Guards `onToggleFavorite` against firing while the catalog is still loading. */
  isLoading: boolean;
  toggleFavorite: (
    id: string,
    isFavorite: boolean,
    entityType?: ReturnType<typeof resolveFavoriteEntityType>,
  ) => Promise<void>;
  showSuccessNotification: (params: NotificationParams) => void;
  showErrorNotification: (params: NotificationParams) => void;
  notifyOperationSuccess: ReturnType<
    typeof useOperationNotification
  >['notifyOperationSuccess'];
  /** Loads a skill's supporting file for the details panel's Content tab preview. */
  onLoadSkillDetailsFile: (fileId: string) => Promise<SkillFileContent>;
}

interface UseCatalogItemActionsResult {
  fetchPromptDto: (item: CatalogItem) => Promise<PromptResponseDto>;
  onToggleFavorite: (id: string, isFavorite: boolean) => Promise<void>;
  handleUseInChat: (item: CatalogItem) => Promise<void>;
  handleCardSelect: (item: CatalogItem) => void;
  handleDownload: (item: CatalogItem) => Promise<void>;
  isDownloadVisible: (item: CatalogItem) => boolean;
  isPrimaryActionVisible: (item: CatalogItem) => boolean;
  renderContentFilePreview: (fileId: string, fileName: string) => ReactNode;
}

/**
 * Owns the catalog's per-item action surface: resolving a prompt's body
 * through whichever endpoint owns it, the "Use in chat" primary action, the
 * selector-mode card pick, the prompt/skill download flow and its visibility
 * rule, the primary-action visibility rule, the favorite toggle, and the
 * content-file preview renderer used by the details panel's Content tab.
 */
export const useCatalogItemActions = ({
  t,
  navigate,
  onClose,
  onSelect,
  setSelectedItemId,
  catalogItems,
  isLoading,
  toggleFavorite,
  showSuccessNotification,
  showErrorNotification,
  notifyOperationSuccess,
  onLoadSkillDetailsFile,
}: UseCatalogItemActionsParams): UseCatalogItemActionsResult => {
  /*
   * Reads a prompt item back through whichever endpoint owns it. `item.id` is
   * always the full `prompts/{bucket}/{path}` resource path — the owner
   * bucket for a shared prompt, the caller's own bucket otherwise — so the
   * personal endpoint takes it unconditionally. The organisation source still
   * routes through the separate public endpoint, which kept its
   * bucket-relative `path` argument, so its qualified id is parsed back down
   * to that sub-path first.
   */
  const fetchPromptDto = useCallback(
    (item: CatalogItem): Promise<PromptResponseDto> => {
      if (!isOrganisationPromptItem(item)) return getPrompt(item.id);
      const parsed = parsePromptResourceUrl(item.id);
      return getPublicPrompt(parsed?.path ?? item.id);
    },
    [],
  );

  const onToggleFavorite = useCallback(
    async (id: string, isFavorite: boolean) => {
      if (isLoading) return;
      const item = catalogItems.find((catalogItem) => catalogItem.id === id);
      const name = item?.name ?? id;

      try {
        await toggleFavorite(
          id,
          isFavorite,
          resolveFavoriteEntityType(item?.type),
        );

        /* Removing a favourite is as successful an outcome as adding one. */
        showSuccessNotification({
          title: t(
            isFavorite
              ? FavoritesI18nKeys.AddedTitle
              : FavoritesI18nKeys.RemovedTitle,
          ),
          message: t(
            isFavorite ? FavoritesI18nKeys.Added : FavoritesI18nKeys.Removed,
            { name },
          ),
        });
      } catch (error) {
        const { traceId } = await getApiErrorDetails(error);
        showErrorNotification({
          title: t(
            isFavorite
              ? FavoritesI18nKeys.AddFailedTitle
              : FavoritesI18nKeys.RemoveFailedTitle,
          ),
          message: t(
            isFavorite
              ? FavoritesI18nKeys.AddFailed
              : FavoritesI18nKeys.RemoveFailed,
            { name },
          ),
          requestId: traceId,
        });
      }
    },
    [
      isLoading,
      toggleFavorite,
      catalogItems,
      showSuccessNotification,
      showErrorNotification,
      t,
    ],
  );

  const handleUseInChat = useCallback(
    async (item: CatalogItem) => {
      /*
       * A prompt contributes text, not a runtime: it seeds the composer and
       * leaves the user's selected deployment untouched. The body travels as
       * router state rather than a query param — it can run to 50 000
       * characters, which would blow the URL length limit and leak content
       * into browser history.
       */
      let action;
      try {
        action = await resolveCatalogPrimaryAction(item, fetchPromptDto);
      } catch (err) {
        const { traceId } = await getApiErrorDetails(err);
        showErrorNotification({
          message: t(CatalogI18nKeys.DetailsPromptLoadError),
          requestId: traceId,
        });
        return;
      }

      if (action.kind === CatalogPrimaryActionType.Prompt) {
        if (action.hasParameters) {
          navigate(ROUTES.Root, {
            state: {
              pendingPrompt: {
                id: action.id,
                name: action.name,
                content: action.content,
                description: action.description,
              },
            },
          });
          return;
        }
        navigate(ROUTES.Root, { state: { promptContent: action.content } });
        return;
      }

      /*
       * The pick is persisted as the user's own preference *and* carried in
       * router state: the new-chat route resets an unstated selection back to
       * the configured default on mount, which would otherwise discard this
       * one before the persisted value has propagated.
       */
      setSelectedItemId(action.id);
      navigate(ROUTES.Root, { state: { deploymentId: action.id } });
    },
    [setSelectedItemId, navigate, showErrorNotification, t, fetchPromptDto],
  );

  /* Picker mode: a card click selects it and closes the modal immediately,
   * without opening its details. When `onSelect` is supplied (a form-owned
   * selection, decoupled from the chat input's active deployment), the pick
   * is routed there instead of committing to `DeploymentsContext`. */
  const handleCardSelect = useCallback(
    (item: CatalogItem) => {
      if (onSelect) {
        onSelect(item.id);
      } else {
        setSelectedItemId(item.id);
      }
      onClose?.();
    },
    [onSelect, setSelectedItemId, onClose],
  );

  /*
   * The body is re-fetched rather than taken from `item.details.promptContent`:
   * the listing seeds that field, so a prompt edited in another tab would be
   * written to disk stale. Organisation prompts download through the public
   * endpoint, exactly as their details do.
   */
  const handleDownload = useCallback(
    async (item: CatalogItem) => {
      if (item.type === CatalogEntityType.Prompt) {
        try {
          const dto = await fetchPromptDto(item);
          triggerBlobDownload(
            serializePromptExport(buildPromptExportEnvelope(dto)),
            buildPromptExportFileName(dto.name, EXPORT_APP_NAME),
          );
          notifyOperationSuccess(
            NotifiableEntity.Prompt,
            EntityOperation.Downloaded,
            { name: dto.name },
          );
        } catch (err) {
          const { traceId } = await getApiErrorDetails(err);
          showErrorNotification({
            message: t(CatalogI18nKeys.DetailsPromptDownloadError),
            requestId: traceId,
          });
        }
        return;
      }

      if (item.type === CatalogEntityType.Skill) {
        const openSkill = parseSkillResourceUrl(item.id);
        if (openSkill == null) return;
        try {
          const response = await downloadSkill(
            openSkill.bucket,
            openSkill.path,
          );
          if (!response.ok) {
            throw new Error(`Download failed with status ${response.status}`);
          }
          const fallbackName = `${sanitizeFileName(item.name)}.zip`;
          const savedName = await triggerBrowserDownload(
            response,
            fallbackName,
          );
          notifyOperationSuccess(
            NotifiableEntity.Skill,
            EntityOperation.Downloaded,
            { name: savedName },
          );
        } catch (err) {
          const { traceId } = await getApiErrorDetails(err);
          showErrorNotification({
            message: t(CatalogI18nKeys.DetailsSkillDownloadError),
            requestId: traceId,
          });
        }
      }
    },
    [notifyOperationSuccess, showErrorNotification, t, fetchPromptDto],
  );

  /* A prompt has a downloadable body and a skill has a whole-archive download; every other type is backed by config the catalog does not export. */
  const isDownloadVisible = useCallback(
    (item: CatalogItem) =>
      item.type === CatalogEntityType.Prompt ||
      item.type === CatalogEntityType.Skill,
    [],
  );

  const renderContentFilePreview = useCallback(
    (fileId: string, fileName: string) => (
      <SkillDetailsFilePreview
        fileId={fileId}
        fileName={fileName}
        onLoadFile={onLoadSkillDetailsFile}
      />
    ),
    [onLoadSkillDetailsFile],
  );

  const isPrimaryActionVisible = useCallback((item: CatalogItem) => {
    /*
     * A prompt contributes text rather than a runtime, so it is always
     * usable in chat; `supportsChat` describes a deployment's interfaces
     * and is absent on prompt items.
     */
    if (item.type === CatalogEntityType.Prompt) return true;
    return (
      (item.type === CatalogEntityType.Model ||
        item.type === CatalogEntityType.Agent) &&
      item.supportsChat !== false
    );
  }, []);

  return {
    fetchPromptDto,
    onToggleFavorite,
    handleUseInChat,
    handleCardSelect,
    handleDownload,
    isDownloadVisible,
    isPrimaryActionVisible,
    renderContentFilePreview,
  };
};
