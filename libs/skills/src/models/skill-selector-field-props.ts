import type { CSSProperties } from 'react';

/** Translated text for a controlled skill field. */
export interface SkillSelectorFieldLabels {
  /** Visible and accessible field label. */
  fieldLabel: string;
  /** Empty selection text. */
  placeholder: string;
  /** Explanation shown when the selected model cannot use skills. */
  unsupportedTooltipLabel: string;
  /** Explanation shown when the field is disabled because the model cannot use skills and no skill is selected. Defaults to 'Selected model does not support skills. Select a different model to use a skill.'. */
  unavailableTooltipLabel?: string;
  /** Search input placeholder. Defaults to 'Search skills'. */
  searchPlaceholder?: string;
  /** Text shown when no skill is available. Defaults to 'No skills available'. */
  emptyLabel?: string;
  /** Text shown when the search matches no skill. Defaults to 'No matching skills'. */
  noMatchingSkillsLabel?: string;
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

/** One skill offered by the field's option list. */
export interface SkillSelectorOption {
  /** Stable skill reference: the `skills/{bucket}/{path}` resource URL. */
  id: string;
  /** Display name. */
  name: string;
}

/** Host-controlled multiple selection; the skill list belongs to the caller. */
export interface SkillSelectorFieldProps {
  /** Host-resolved skills offered as checkbox options. Defaults to an empty list. */
  skills?: SkillSelectorOption[];
  /** Explicit skill support for the selected model. */
  isSkillsSupported: boolean;
  /** Disables all controls. Defaults to false. */
  isDisabled?: boolean;
  /** Host validation message rendered and associated by the UI-kit Select. */
  error?: string;
  /** Translated visible and accessible text. */
  labels: SkillSelectorFieldLabels;
  /** Additional classes applied to the root. */
  className?: string;
  /** Theme and typography overrides. */
  styles?: SkillSelectorFieldStyles;
  /** Selected references in display order. */
  value: string[];
  /** Called with the complete selection after adding or removing a skill. */
  onChange: (value: string[]) => void;
  /** Host-resolved names keyed by reference; missing entries display the URL. */
  displayNames?: Record<string, string>;
}
