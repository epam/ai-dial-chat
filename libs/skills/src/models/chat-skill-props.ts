/** Localizable string labels for {@link ChatSkillProps}'s component. */
export interface ChatSkillLabels {
  /** Label for the tooltip's "View details" action. Defaults to `'View details'`. */
  viewDetailsLabel?: string;
}

/** Props for the ChatSkill component. */
export interface ChatSkillProps {
  /** Display name, rendered after the `/` prefix in the button's label. */
  name: string;
  /**
   * The skill's resource URL (`skills/{bucket}/{path}`), passed to every
   * callback so the host never has to re-derive it.
   */
  path: string;
  /** The skill's description, shown in the tooltip. Omitted when empty. */
  description?: string;
  /**
   * Whether the description is still being resolved by the host. While
   * `true` the tooltip shows a spinner in the description's place.
   */
  isDescriptionLoading?: boolean;
  /** CSS class applied to the `/name` label. Defaults to `'dial-body-paragraph-text'`. */
  labelClassName?: string;
  /** Called with the skill's path when the tooltip's "View details" button is clicked. */
  onViewDetails: (path: string) => void;
  /**
   * Called with the skill's path each time the tooltip opens (hover or
   * focus) — the host's lazy-description trigger, wherever the component
   * renders.
   */
  onTooltipOpen?: (path: string) => void;
  /** Localizable string overrides. */
  labels?: ChatSkillLabels;
}
