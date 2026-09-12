/** Props for the shared skill info tooltip content component. */
export interface SkillInfoTooltipContentProps {
  /** The skill's description paragraph. Omitted entirely when empty. */
  description?: string;
  /**
   * Whether the description is still being resolved by the host. While
   * `true` a spinner renders in the description's place.
   */
  isDescriptionLoading?: boolean;
  /** Label for the "View details" action. Defaults to `'View details'`. */
  viewDetailsLabel?: string;
  /** Called when the "View details" button is clicked. */
  onViewDetails: () => void;
}
