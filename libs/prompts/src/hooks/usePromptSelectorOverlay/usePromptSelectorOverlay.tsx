import {
  extractPromptParams,
  resolvePromptParams,
} from '@epam/ai-dial-chat-shared';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { FavoritePromptsPanel } from '../../components/FavoritePromptsPanel/FavoritePromptsPanel';
import { PromptParametersPopup } from '../../components/PromptParametersPopup/LazyPromptParametersPopup';
import type { FavoritePromptItem } from '../../models/favorite-prompt-item';
import type {
  UsePromptSelectorOverlayOptions,
  UsePromptSelectorOverlayResult,
} from '../../models/prompt-selector-overlay';

/**
 * Owns the prompt-selection workflow: the favorites overlay, the browse/parameter transitions,
 * and parameter resolution. The host supplies the merged prompt listing, favorites state,
 * labels, insertion callback, and its own lazy-loaded browse-modal renderer — this hook never
 * imports generated API DTOs, parent providers, routing, or i18n.
 */
export const usePromptSelectorOverlay = ({
  isEnabled,
  prompts,
  favoriteIds,
  onToggleFavorite,
  onInsertText,
  labels,
  renderCatalog,
}: UsePromptSelectorOverlayOptions): UsePromptSelectorOverlayResult => {
  const { panelLabels, parametersLabels } = labels ?? {};

  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<FavoritePromptItem | null>(
    null,
  );
  const [openedFromBrowse, setOpenedFromBrowse] = useState(false);

  const favoritePromptItems = useMemo(
    () => prompts.filter((prompt) => favoriteIds.has(prompt.id)),
    [prompts, favoriteIds],
  );

  const handlePromptPicked = useCallback(
    (prompt: FavoritePromptItem, fromBrowse: boolean) => {
      const parameters = extractPromptParams(prompt.content);
      if (parameters.length === 0) {
        onInsertText(prompt.content);
        setIsCatalogOpen(false);
        return;
      }
      setPendingPrompt(prompt);
      setOpenedFromBrowse(fromBrowse);
    },
    [onInsertText],
  );

  const renderOverlay = useCallback(
    (onClose: () => void): ReactNode => (
      <FavoritePromptsPanel
        favorites={favoritePromptItems}
        onSelect={(item) => {
          handlePromptPicked(item, false);
          onClose();
        }}
        onToggleFavorite={onToggleFavorite}
        onBrowse={() => {
          onClose();
          setIsCatalogOpen(true);
        }}
        labels={panelLabels}
      />
    ),
    [favoritePromptItems, handlePromptPicked, onToggleFavorite, panelLabels],
  );

  const promptCatalogModal = renderCatalog({
    isOpen: isCatalogOpen,
    onSelect: (item) => handlePromptPicked(item, true),
    onClose: () => setIsCatalogOpen(false),
  });

  const openParametersPopup = useCallback((prompt: FavoritePromptItem) => {
    setOpenedFromBrowse(false);
    setPendingPrompt(prompt);
  }, []);

  const handleClosePopup = useCallback(() => {
    setPendingPrompt(null);
  }, []);

  const handleBackToBrowse = useCallback(() => {
    setPendingPrompt(null);
    setIsCatalogOpen(true);
  }, []);

  const handleSubmitPopup = useCallback(
    (values: Record<string, string>) => {
      if (pendingPrompt) {
        onInsertText(resolvePromptParams(pendingPrompt.content, values));
      }
      setPendingPrompt(null);
      setIsCatalogOpen(false);
    },
    [pendingPrompt, onInsertText],
  );

  const pendingParameters = useMemo(
    () =>
      pendingPrompt != null ? extractPromptParams(pendingPrompt.content) : [],
    [pendingPrompt],
  );

  const parametersPopup = pendingPrompt != null && (
    <PromptParametersPopup
      open
      promptName={pendingPrompt.name}
      content={pendingPrompt.content}
      description={pendingPrompt.description}
      parameters={pendingParameters}
      onBack={openedFromBrowse ? handleBackToBrowse : undefined}
      onClose={handleClosePopup}
      onCancel={handleClosePopup}
      onSubmit={handleSubmitPopup}
      labels={parametersLabels}
    />
  );

  if (!isEnabled) {
    return {
      renderOverlay: undefined,
      promptCatalogModal: null,
      parametersPopup: null,
      openParametersPopup: () => undefined,
    };
  }

  return {
    renderOverlay,
    promptCatalogModal,
    parametersPopup,
    openParametersPopup,
  };
};
