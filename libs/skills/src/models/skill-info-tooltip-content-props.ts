/** Props for the shared skill info tooltip content component. */
export interface SkillInfoTooltipContentProps {
  /** The skill's listing-sourced description paragraph. Omitted entirely when empty. */
  description?: string;
  /**
   * The unsupported-model message. While set, it replaces the whole content —
   * no description paragraph and no "View details" button render.
   */
  unsupportedMessage?: string;
  /** Label for the "View details" action. Defaults to `'View details'`. */
  viewDetailsLabel?: string;
  /** Called when the "View details" button is clicked. Unused while `unsupportedMessage` is set. */
  onViewDetails?: () => void;
}
