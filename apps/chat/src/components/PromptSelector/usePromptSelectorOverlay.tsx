import { FavoriteEntityType } from '@epam/ai-dial-chat-hooks';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  usePromptSelectorOverlay as usePromptSelectorOverlayWorkflow,
  type FavoritePromptItem,
  type RenderPromptCatalogProps,
  type UsePromptSelectorOverlayResult,
} from '@epam/ai-dial-prompts';
import { lazy, Suspense, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  FavoritesI18nKeys,
  NavigationI18nKeys,
  PromptSelectorI18nKeys,
} from '../../constants/translation-keys';
import { useFavoriteApplications } from '../../context/FavoriteApplicationsContext';
import { usePrompts } from '../../context/PromptsContext';
import { useUiFeature } from '../../hooks/useUiFeature';

const PromptCatalogModal = lazy(async () => {
  const module = await import('./PromptCatalogModal');
  return { default: module.default };
});

/** Minimal prompt shape the "Prompt parameters" popup needs — a full `PromptResponseDto` satisfies it structurally. */
export type PendingParametersPrompt = FavoritePromptItem;

interface UseAppPromptSelectorOverlayOptions {
  /** Called with the resolved prompt text (parameters already substituted, if any). */
  onInsertText: (text: string) => void;
}

/**
 * Host adapter for `@epam/ai-dial-prompts`' `usePromptSelectorOverlay`: supplies the merged
 * prompt listing, favorites state, translated labels, and the lazy-loaded "Use prompt" browse
 * modal. Gated behind `OverlayFeature.Prompts`, matching `CatalogView`.
 */
export const usePromptSelectorOverlay = ({
  onInsertText,
}: UseAppPromptSelectorOverlayOptions): UsePromptSelectorOverlayResult => {
  const { t } = useTranslation();
  const isPromptsEnabled = useUiFeature(OverlayFeature.Prompts);
  const { prompts, sharedWithMe, publicPrompts } = usePrompts();
  const { favoriteIds, toggleFavorite } = useFavoriteApplications();

  const allPrompts = useMemo(
    () => [...prompts, ...sharedWithMe, ...publicPrompts],
    [prompts, sharedWithMe, publicPrompts],
  );

  const handleToggleFavorite = useCallback(
    (id: string) => toggleFavorite(id, false, FavoriteEntityType.Prompt),
    [toggleFavorite],
  );

  const renderCatalog = useCallback(
    ({ isOpen, onSelect, onClose }: RenderPromptCatalogProps) => (
      <Suspense fallback={null}>
        <PromptCatalogModal
          isOpen={isOpen}
          onClose={onClose}
          onSelect={(id) => {
            const prompt = allPrompts.find((p) => p.id === id);
            if (prompt) onSelect(prompt);
          }}
        />
      </Suspense>
    ),
    [allPrompts],
  );

  const labels = useMemo(
    () => ({
      panelLabels: {
        myCollectionLabel: t(PromptSelectorI18nKeys.MyCollectionLabel),
        emptyHintLabel: t(PromptSelectorI18nKeys.EmptyHint),
        browseLabel: t(PromptSelectorI18nKeys.BrowseLabel),
        removeFromFavoritesLabel: t(FavoritesI18nKeys.RemoveFromFavorites),
      },
      parametersLabels: {
        title: t(PromptSelectorI18nKeys.ParametersTitle),
        closeLabel: t(ButtonsI18nKeys.Close),
        backLabel: t(NavigationI18nKeys.Back),
        parametersLabel: t(PromptSelectorI18nKeys.ParametersLabel),
        detailsLabel: t(PromptSelectorI18nKeys.DetailsLabel),
        enterValuePlaceholder: t(PromptSelectorI18nKeys.EnterValuePlaceholder),
        cancelLabel: t(ButtonsI18nKeys.Cancel),
        submitLabel: t(ButtonsI18nKeys.Confirm),
      },
    }),
    [t],
  );

  return usePromptSelectorOverlayWorkflow({
    isEnabled: isPromptsEnabled,
    prompts: allPrompts,
    favoriteIds,
    onToggleFavorite: handleToggleFavorite,
    onInsertText,
    labels,
    renderCatalog,
  });
};
