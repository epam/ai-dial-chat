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
  /** Called when a row is activated (click, Enter, or Space — or, in listbox mode, Enter in the owning text field while the row is active). */
  onSelect: (item: FavoriteSkillItem) => void;
  /** Removes a favorite by id; omitted hides the star action. */
  onToggleFavorite?: (id: string) => void;
  /** Called when the "Browse" button is clicked. */
  onBrowse: () => void;
  /** Opens skill details; omitted hides the details tooltip. */
  onViewDetails?: (item: FavoriteSkillItem) => void;
  /** Additional classes applied to the panel root. */
  className?: string;
  /** Additional classes applied to each favorite row. */
  rowClassName?: string;
  /**
   * When provided, the panel enters search mode: rows are filtered to names
   * containing this string case-insensitively and matched names render with a
   * highlight mark. An empty string shows every row. Omit to show all
   * favorites unfiltered.
   */
  searchQuery?: string;
  /**
   * When provided, the list renders as a `role="listbox"` with this `id` and
   * each row as a `role="option"` — the shape a list autocomplete (e.g. the
   * conversation input's `commandMenu`) drives from its text field. In this
   * mode Tab moves from row to row: a row's star and its tooltip's "View
   * details" stay clickable but leave the Tab sequence. Omit for the plain
   * list of button rows.
   */
  listboxId?: string;
  /**
   * Renders the rows and the "Browse" action as `role="menuitem"` for a host
   * that mounts the panel inside a `role="menu"` container (e.g. a submenu
   * whose arrow keys move between menu items). Ignored with `listboxId`.
   * Defaults to `false`: rows are `role="button"`.
   */
  isMenu?: boolean;
  /**
   * `id` of the row the owning text field has active, rendered with
   * `aria-selected="true"` and the row highlight — pass through the id the
   * text field reports; row ids are derived from `listboxId` and each item's
   * id. Used only with `listboxId`.
   */
  activeOptionId?: string | null;
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
