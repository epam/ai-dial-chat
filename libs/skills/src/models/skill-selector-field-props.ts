import type { CSSProperties, ReactNode } from 'react';
import type { FavoriteSkillItem } from './favorite-skill-item';
import type { FavoriteSkillsPanelLabels } from './favorite-skills-panel-props';
import type { SkillCatalogModalProps } from './skill-catalog-modal-props';

/** Translated text for a controlled skill field. */
export interface SkillSelectorFieldLabels {
  /** Empty selection text. */
  placeholder: string;
  /** Browse dialog title. */
  modalTitle: string;
  /** Accessible name of the removal control. */
  removeSkillLabel: string;
  /** Explanation shown when the selected model cannot use skills. */
  unsupportedTooltipLabel: string;
  /** Favorites panel text; omitted entries use the panel's English defaults. */
  panelLabels?: FavoriteSkillsPanelLabels;
  /** Favorites search label and placeholder. Defaults to 'Search skills'. */
  searchPlaceholder?: string;
  /** Accessible search clear label. Defaults to 'Clear search'. */
  clearSearchLabel?: string;
}

/** Per-instance theme and typography overrides for the skill field. */
export interface SkillSelectorFieldStyles {
  /** Field color overrides; omitted values use the host theme. */
  colors?: {
    /** Text color. */
    text?: string;
    /** Field background. */
    background?: string;
    /** Field border. */
    border?: string;
    /** Invalid-state text and border. */
    error?: string;
  };
  /** Label typography overrides. */
  typography?: {
    /** CSS classes applied to the value. Defaults to 'dial-small-text'. */
    fontClassName?: string;
  };
  /** Additional classes applied to the input wrapper. */
  triggerClassName?: string;
  /** CSS custom properties merged after the typed overrides. */
  cssVars?: CSSProperties;
}

/** Host-controlled selection; catalog data and rendering belong to the caller. */
export interface SkillSelectorFieldProps {
  /** Selected reference, independent of catalog loading. */
  value?: string;
  /** Called to replace or remove the selected reference. */
  onChange: (value: string | undefined) => void;
  /** Resolved name; defaults to the full selected reference. */
  displayName?: string;
  /** Host-resolved favorite skills. Defaults to an empty list. */
  favorites?: FavoriteSkillItem[];
  /** Removes a skill from favorites; omitted hides the star action. */
  onToggleFavorite?: (id: string) => void;
  /** Opens host-owned skill details; omitted hides the details tooltip. */
  onViewDetails?: (item: FavoriteSkillItem) => void;
  /** Optional popup presentation, such as a mobile sheet. Defaults to a dropdown. */
  renderOverlay?: (
    panel: ReactNode,
    isOpen: boolean,
    onClose: () => void,
  ) => ReactNode;
  /** Explicit skill support for the selected model. */
  isSkillsSupported: boolean;
  /** Disables all controls. Defaults to false. */
  isDisabled?: boolean;
  /** Host validation state. Defaults to false. */
  isInvalid?: boolean;
  /** ID of the host-rendered label. */
  labelledById: string;
  /** ID of host-rendered feedback. */
  describedById?: string;
  /** Translated visible and accessible text. */
  labels: SkillSelectorFieldLabels;
  /** Catalog content that calls back with the selected reference. */
  renderCatalogContent: SkillCatalogModalProps['renderContent'];
  /** Additional classes applied to the root. */
  className?: string;
  /** Theme and typography overrides. */
  styles?: SkillSelectorFieldStyles;
}
