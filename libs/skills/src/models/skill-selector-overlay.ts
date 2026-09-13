import type {
  CommandMenuConfig,
  MenuOverlayConfig,
} from '@epam/ai-dial-conversation-input';
import type { ComponentType, ReactNode } from 'react';
import type { SkillListingEntry } from './favorite-skill-item';
import type { FavoriteSkillsPanelLabels } from './favorite-skills-panel-props';

/** Props accepted by the details-panel component injected into `useSkillSelectorOverlay`. */
export interface SkillDetailsPanelComponentProps {
  /** Resource URL of the skill whose details are shown; `null` renders nothing. */
  skillId: string | null;
  /** Called when the panel should close (close button or backdrop click). */
  onClose: () => void;
  /**
   * Called with the skill's resource URL when the panel's "Use in chat" is
   * clicked; the hook also closes the panel.
   */
  onUseInChat: (skillId: string) => void;
}

/** Localizable string labels for the skill selector overlay flow. */
export interface SkillSelectorOverlayLabels {
  /** Add-menu entry label and mobile sheet title. Defaults to `'Skills'`. */
  addMenuLabel?: string;
  /** Accessible label for the mobile sheet's back arrow. Defaults to `'Back'`. */
  backLabel?: string;
  /** Header title of the "Use skill" browse modal. Defaults to `'Use skill'`. */
  catalogModalTitleLabel?: string;
  /**
   * Hint rendered in the text area right after the `/` while the slash menu
   * is open with an empty query. Defaults to `'Type to filter'`.
   */
  emptyQueryHintLabel?: string;
  /** Labels forwarded to the favorites panel rendered as the overlay. */
  panelLabels?: FavoriteSkillsPanelLabels;
}

/** Options accepted by `useSkillSelectorOverlay`. */
export interface UseSkillSelectorOverlayOptions {
  /**
   * Whether the skill flow is enabled. While `false` the hook returns empty
   * outputs: no menu entry, no modal, no panel, no chips.
   */
  isEnabled: boolean;
  /** The user's own skills. */
  skills: SkillListingEntry[];
  /** Skills shared with the user, when the host distinguishes them. */
  sharedWithMe?: SkillListingEntry[];
  /** Public skills, when the host distinguishes them. */
  publicSkills?: SkillListingEntry[];
  /** Ids (`skills/{bucket}/{path}` URLs) of the user's favorited skills. */
  favoriteIds: ReadonlySet<string>;
  /** Removes a skill from favorites; fired by a row's star button. */
  onToggleFavorite: (id: string) => void;
  /**
   * Resolves a skill's manifest description for its row tooltip. Returning
   * `null` marks the skill as description-less for the rest of the session.
   */
  fetchSkillDescription: (skillId: string) => Promise<string | null>;
  /** Localizable string overrides. */
  labels?: SkillSelectorOverlayLabels;
  /**
   * Renders the browse modal's picker content (e.g. a host catalog view);
   * receives the selection and close callbacks to wire into it, and is
   * mounted only while the modal is open.
   */
  renderCatalogContent: (
    onSelect: (id: string) => void,
    onClose: () => void,
  ) => ReactNode;
  /** The skill details side panel; may be a lazily loaded component. */
  detailsPanelComponent: ComponentType<SkillDetailsPanelComponentProps>;
}

/** Returned by `useSkillSelectorOverlay`. */
export interface UseSkillSelectorOverlayResult {
  /**
   * The Skills entry for the `menuOverlays` prop of
   * `ConversationInput`/`Input`. `undefined` while `isEnabled` is `false`: the
   * host omits the entry entirely when this is `undefined`, so a stub renderer
   * would leave the menu item in place with nothing behind it.
   */
  skillMenuOverlay?: MenuOverlayConfig;
  /**
   * The Skills entry for the `commandMenu` prop of
   * `ConversationInput`/`Input`: typing `/` into an empty textarea opens the
   * favorites panel in search mode above the input. `undefined` while
   * `isEnabled` is `false`, disabling the slash menu entirely.
   */
  commandMenu?: CommandMenuConfig;
  /**
   * The browse modal element. Render at a stable level outside the popover
   * (e.g. next to the input); `null` while `isEnabled` is `false`.
   */
  skillCatalogModal: ReactNode;
  /**
   * The skill details side panel opened by a row tooltip's "View details".
   * `null` while `isEnabled` is `false`.
   */
  skillDetailsPanel: ReactNode;
  /**
   * The selected skill as a `ChatSkill` element for the conversation input's
   * `inlineStartSlot` — at most one, replaced on every selection, carrying
   * the shared tooltip (with the same lazy description fetch as the favorite
   * rows). The element has no remove control of its own; removal is the
   * input's Backspace-at-start gesture, wired through `removeSelectedSkill`.
   * `null` while `isEnabled` is `false` or nothing is selected.
   */
  selectedSkillElement: ReactNode;
  /**
   * Selects a skill by its resource URL (`skills/{bucket}/{path}`), replacing
   * any prior selection.
   */
  selectSkill: (skillId: string) => void;
  /**
   * Clears the selected skill. Wire to the input's `onInlineStartRemove` —
   * Backspace with the caret collapsed at position 0 while the selected
   * skill's element is shown.
   */
  removeSelectedSkill: () => void;
}
