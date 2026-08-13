import type { PromptResponseDto } from '@epam/ai-dial-chat-api-client';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  extractPromptParams,
  resolvePromptParams,
} from '@epam/ai-dial-chat-shared';
import type { FavoritePromptItem } from '@epam/ai-dial-prompts';
import {
  lazy,
  Suspense,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  FavoriteEntityType,
  useFavoriteApplications,
} from '../../context/FavoriteApplicationsContext';
import { usePrompts } from '../../context/PromptsContext';
import { useUiFeature } from '../../hooks/useUiFeature';

const PromptSelectorOverlay = lazy(() => import('./PromptSelectorOverlay'));

const PromptCatalogModal = lazy(async () => {
  const module = await import('./PromptCatalogModal');
  return { default: module.default };
});

const PromptParametersPopupOverlay = lazy(
  () => import('./PromptParametersPopupOverlay'),
);

const buildFavoritePromptItem = (
  prompt: PromptResponseDto,
): FavoritePromptItem => ({
  id: prompt.id,
  name: prompt.name,
  description: prompt.description,
  content: prompt.content,
});

interface UsePromptSelectorOverlayOptions {
  /** Called with the resolved prompt text (parameters already substituted, if any). */
  onInsertText: (text: string) => void;
}

interface UsePromptSelectorOverlayResult {
  /** Pass directly as the `promptsMenuOverlay` prop of `ConversationInput`/`Input`. */
  renderOverlay: (onClose: () => void, onBack?: () => void) => ReactNode;
  /** Render this element at a stable level outside the popover (e.g. next to the input). */
  promptCatalogModal: ReactNode;
  /** Render this element at a stable level outside the popover (e.g. next to the input). */
  parametersPopup: ReactNode;
}

/**
 * Owns the Prompts Add-menu flow: the favorites overlay, the "Use prompt"
 * browse modal, and the parameter-resolution popup. Gated behind
 * `OverlayFeature.Prompts`, matching `CatalogView`.
 */
export function usePromptSelectorOverlay({
  onInsertText,
}: UsePromptSelectorOverlayOptions): UsePromptSelectorOverlayResult {
  const isPromptsEnabled = useUiFeature(OverlayFeature.Prompts);
  const { prompts, sharedWithMe, publicPrompts } = usePrompts();
  const { favoriteIds, toggleFavorite } = useFavoriteApplications();

  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<PromptResponseDto | null>(
    null,
  );
  const [openedFromBrowse, setOpenedFromBrowse] = useState(false);

  const allPrompts = useMemo(
    () => [...prompts, ...sharedWithMe, ...publicPrompts],
    [prompts, sharedWithMe, publicPrompts],
  );

  const favoritePromptItems = useMemo<FavoritePromptItem[]>(
    () =>
      allPrompts
        .filter((prompt) => favoriteIds.has(prompt.id))
        .map(buildFavoritePromptItem),
    [allPrompts, favoriteIds],
  );

  const handlePromptPicked = useCallback(
    (prompt: PromptResponseDto, fromBrowse: boolean) => {
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
    (onClose: () => void, onBack?: () => void): ReactNode => (
      <Suspense fallback={null}>
        <PromptSelectorOverlay
          favorites={favoritePromptItems}
          onSelect={(item) => {
            const prompt = allPrompts.find((p) => p.id === item.id);
            if (prompt) handlePromptPicked(prompt, false);
            onClose();
          }}
          onToggleFavorite={(id) =>
            toggleFavorite(id, false, FavoriteEntityType.Prompt)
          }
          onBrowse={() => {
            onClose();
            setIsCatalogOpen(true);
          }}
          onBack={onBack}
        />
      </Suspense>
    ),
    [favoritePromptItems, allPrompts, handlePromptPicked, toggleFavorite],
  );

  const promptCatalogModal = (
    <Suspense fallback={null}>
      <PromptCatalogModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        onSelect={(id) => {
          const prompt = allPrompts.find((p) => p.id === id);
          if (prompt) handlePromptPicked(prompt, true);
        }}
      />
    </Suspense>
  );

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

  const parametersPopup = pendingPrompt != null && (
    <Suspense fallback={null}>
      <PromptParametersPopupOverlay
        open
        promptName={pendingPrompt.name}
        content={pendingPrompt.content}
        description={pendingPrompt.description}
        parameters={extractPromptParams(pendingPrompt.content)}
        onBack={openedFromBrowse ? handleBackToBrowse : undefined}
        onClose={handleClosePopup}
        onCancel={handleClosePopup}
        onSubmit={handleSubmitPopup}
      />
    </Suspense>
  );

  if (!isPromptsEnabled) {
    return {
      renderOverlay: () => null,
      promptCatalogModal: null,
      parametersPopup: null,
    };
  }

  return { renderOverlay, promptCatalogModal, parametersPopup };
}
