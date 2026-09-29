import type { SkillUnresolvedReason } from '../types/skill-unresolved-reason';

/** Props for the shared skill info tooltip content component. */
export interface SkillInfoTooltipContentProps {
  /** The skill's listing-sourced description paragraph. Omitted entirely when empty. */
  description?: string;
  /**
   * The unsupported-model message. While set, it replaces the whole content —
   * no description paragraph and no "View details" button render.
   */
  unsupportedMessage?: string;
  /**
   * Why the skill's url resolved to no loaded listing entry. While set, it
   * takes precedence over `unsupportedMessage` and replaces the whole
   * content with an icon and the matching fixed message — no description
   * paragraph and no "View details" button render. Required alongside
   * `deletedMessage`/`notSharedMessage`, whichever this value selects.
   */
  unresolvedReason?: SkillUnresolvedReason;
  /** Message shown alone, with a trash-can icon, while `unresolvedReason` is `SkillUnresolvedReason.Deleted`. */
  deletedMessage?: string;
  /** Message shown alone, with a lock icon, while `unresolvedReason` is `SkillUnresolvedReason.NotShared`. */
  notSharedMessage?: string;
  /** Label for the "View details" action. Defaults to `'View details'`. */
  viewDetailsLabel?: string;
  /** Called when the "View details" button is clicked. Unused while `unsupportedMessage` is set. */
  onViewDetails?: () => void;
  /**
   * `tabIndex` of the "View details" button. Pass `-1` to keep it out of the
   * Tab sequence (still clickable) where the tooltip hangs off a list row and
   * Tab should move from row to row. Unset keeps the button's default.
   */
  viewDetailsTabIndex?: number;
}
