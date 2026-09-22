import type { ReactNode } from 'react';
import type { FavoritePromptItem } from './favorite-prompt-item';
import type { FavoritePromptsPanelLabels } from './favorite-prompts-panel-props';
import type { PromptParametersPopupLabels } from './prompt-parameters-popup-props';

/** Labels forwarded to the favorites panel and the parameters popup rendered by {@link UsePromptSelectorOverlayResult}. */
export interface UsePromptSelectorOverlayLabels {
  /** Forwarded to the favorites panel's `labels`. */
  panelLabels?: FavoritePromptsPanelLabels;
  /** Forwarded to the parameters popup's `labels`. */
  parametersLabels?: PromptParametersPopupLabels;
}

/** Props the host's browse-modal renderer receives from {@link usePromptSelectorOverlay}. */
export interface RenderPromptCatalogProps {
  /** Whether the browse modal should be open. */
  isOpen: boolean;
  /** Called with the selected prompt's structural data. */
  onSelect: (item: FavoritePromptItem) => void;
  /** Called when the browse modal is dismissed. */
  onClose: () => void;
}

/** Options accepted by {@link usePromptSelectorOverlay}. */
export interface UsePromptSelectorOverlayOptions {
  /** Resolved host policy gating the whole workflow (e.g. an overlay feature flag). */
  isEnabled: boolean;
  /** Structural prompt listing the host has already merged from its own sources. */
  prompts: FavoritePromptItem[];
  /** Ids of the user's favorited prompts. */
  favoriteIds: ReadonlySet<string>;
  /** Called with a prompt's id to remove it from favorites. */
  onToggleFavorite: (id: string) => void;
  /** Called with the resolved prompt text (parameters already substituted, if any). */
  onInsertText: (text: string) => void;
  /** Labels forwarded to the rendered favorites panel and parameters popup. */
  labels?: UsePromptSelectorOverlayLabels;
  /** Renders the host's own lazy-loaded browse-modal content. */
  renderCatalog: (props: RenderPromptCatalogProps) => ReactNode;
}

/** Result returned by {@link usePromptSelectorOverlay}. */
export interface UsePromptSelectorOverlayResult {
  /**
   * Pass as the Add-menu Prompts entry's `renderOverlay`. `undefined` while disabled: the host
   * omits the entry entirely when this is `undefined`, so a stub renderer would leave the row in
   * place with nothing behind it.
   */
  renderOverlay: ((onClose: () => void) => ReactNode) | undefined;
  /** Render this element at a stable level outside the Add-menu popover. */
  promptCatalogModal: ReactNode;
  /** Render this element at a stable level outside the Add-menu popover. */
  parametersPopup: ReactNode;
  /**
   * Opens the parameters popup directly for a prompt that already came from outside the
   * Add-menu flow (e.g. a route-level "Use in chat" action). No back action is offered — there
   * is no browse modal to return to. A no-op while disabled.
   */
  openParametersPopup: (prompt: FavoritePromptItem) => void;
}
