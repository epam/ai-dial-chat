import type { FavoriteSkillItem } from './favorite-skill-item';

/** Localizable string labels for {@link FavoriteSkillsPanelProps}'s component. */
export interface FavoriteSkillsPanelLabels {
  /** Header above the favorites list. Defaults to `'My Collection'`. */
  myCollectionLabel?: string;
  /** Hint shown when there are no favorites. Defaults to `'Star a skill to pin it here'`. */
  emptyHintLabel?: string;
  /** Label for the footer action button. Defaults to `'Browse'`. */
  browseLabel?: string;
  /** Accessible label for a row's remove-from-favorites star button. Defaults to `'Remove from favorites'`. */
  removeFromFavoritesLabel?: string;
  /** Label for a row tooltip's "View details" action. Defaults to `'View details'`. */
  viewDetailsLabel?: string;
  /** Hint shown when `searchQuery` filters out every favorite. Defaults to `'No matching skills'`. */
  noMatchingSkillsLabel?: string;
}

/** CSS custom-property overrides for the favorites panel. */
export interface FavoriteSkillsPanelColors {
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
export interface FavoriteSkillsPanelProps {
  /** The user's favorited skills, already resolved by the host. */
  favorites: FavoriteSkillItem[];
  /** Called when a row is activated (click, Enter, or Space). */
  onSelect: (item: FavoriteSkillItem) => void;
  /** Called with a skill's id when its row's star button is clicked to remove it from favorites. */
  onToggleFavorite: (id: string) => void;
  /** Called when the "Browse" button is clicked. */
  onBrowse: () => void;
  /** Called when a row tooltip's "View details" button is clicked. */
  onViewDetails: (item: FavoriteSkillItem) => void;
  /** Called with a skill's id each time one of its row's interactive tooltips opens (hover or focus). */
  onItemTooltipOpen?: (id: string) => void;
  /**
   * When provided, the panel enters search mode: rows are filtered to names
   * containing this string case-insensitively and matched names render with a
   * highlight mark. An empty string shows every row. Omit to show all
   * favorites unfiltered.
   */
  searchQuery?: string;
  /** Localizable string overrides. */
  labels?: FavoriteSkillsPanelLabels;
  /** Color overrides applied as CSS custom properties. */
  colors?: FavoriteSkillsPanelColors;
  /** CSS class applied to a row's skill name. Defaults to `'dial-small-text'`. */
  nameClassName?: string;
  /** CSS class applied to the "My Collection" header. Defaults to `'dial-tiny-lead-semi-text'`, which uppercases the label itself. */
  headerClassName?: string;
  /** CSS class applied to the empty-favorites hint. Defaults to `'dial-small-text'`. */
  emptyHintClassName?: string;
}
