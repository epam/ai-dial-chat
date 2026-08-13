import type { FavoritePromptItem } from './favorite-prompt-item';

/** Localizable string labels for {@link FavoritePromptsPanelProps}'s component. */
export interface FavoritePromptsPanelLabels {
  /** Header above the favorites list. Defaults to `'My Collection'`. */
  myCollectionLabel?: string;
  /** Hint shown when there are no favorites. Defaults to `'Star a prompt to pin it here'`. */
  emptyHintLabel?: string;
  /** Label for the footer action button. Defaults to `'Browse'`. */
  browseLabel?: string;
  /** Accessible label for a row's remove-from-favorites star button. Defaults to `'Remove from favorites'`. */
  removeFromFavoritesLabel?: string;
  /** Accessible label for the back chevron, shown only when `onBack` is provided. Defaults to `'Back'`. */
  backLabel?: string;
}

/** CSS custom-property overrides for the favorites panel. */
export interface FavoritePromptsPanelColors {
  /** Background color of a row on hover. Defaults to `--bg-layer-sunken`. */
  rowHoverBackground?: string;
  /** Text color of the "My Collection" header. Defaults to `--text-tertiary`. */
  headerText?: string;
  /** Text color of the empty-favorites hint. Defaults to `--text-icon-tertiary`. */
  emptyHintText?: string;
  /** Fill color of a row's star icon. Defaults to `--text-warning-icon`. */
  starColor?: string;
  /** Border color above the footer's Browse button. Defaults to `--stroke-tertiary`. */
  footerBorder?: string;
}

/** Props for the favorites panel component. */
export interface FavoritePromptsPanelProps {
  /** The user's favorited prompts, already resolved by the host. */
  favorites: FavoritePromptItem[];
  /** Called when a row is activated (click, Enter, or Space). */
  onSelect: (item: FavoritePromptItem) => void;
  /** Called with a prompt's id when its row's star button is clicked to remove it from favorites. */
  onToggleFavorite: (id: string) => void;
  /** Called when the "Browse" button is clicked. */
  onBrowse: () => void;
  /**
   * Called to return to the previous screen (the main attachment menu). When
   * omitted, no back chevron is rendered in the header.
   */
  onBack?: () => void;
  /** Localizable string overrides. */
  labels?: FavoritePromptsPanelLabels;
  /** Color overrides applied as CSS custom properties. */
  colors?: FavoritePromptsPanelColors;
  /** CSS class applied to a row's prompt name. Defaults to `'dial-small-text'`. */
  nameClassName?: string;
  /** CSS class applied to the "My Collection" header. Defaults to `'dial-tiny-semi-text'`. */
  headerClassName?: string;
  /** CSS class applied to the empty-favorites hint. Defaults to `'dial-small-text'`. */
  emptyHintClassName?: string;
}
