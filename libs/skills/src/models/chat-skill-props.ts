import type { SkillUnresolvedReason } from '../types/skill-unresolved-reason';

/** Localizable string labels for {@link ChatSkillProps}'s component. */
export interface ChatSkillLabels {
  /** Label for the tooltip's "View details" action. Defaults to `'View details'`. */
  viewDetailsLabel?: string;
  /**
   * Message shown alone in the tooltip while `isUnsupported` is set, stating
   * that the selected model does not support skills and that the user should
   * remove the skill or select a different model to proceed.
   */
  unsupportedTooltipLabel?: string;
  /**
   * Message shown alone in the tooltip, with a trash-can icon, while
   * `unresolvedReason` is `SkillUnresolvedReason.Deleted`, stating that the
   * skill has been deleted and its details are no longer available.
   */
  deletedTooltipLabel?: string;
  /**
   * Message shown alone in the tooltip, with a lock icon, while
   * `unresolvedReason` is `SkillUnresolvedReason.NotShared`, stating that the
   * viewer lacks access to the skill and should ask the chat owner to share it.
   */
  notSharedTooltipLabel?: string;
}

/** How a skill chip opens its description card. */
export type ChatSkillDetailsTrigger = 'hover' | 'click';

/** Props for the ChatSkill component. */
export interface ChatSkillProps {
  /** Display name, rendered after the `/` prefix in the button's label. */
  name: string;
  /**
   * The skill's resource URL (`skills/{bucket}/{path}`), passed to every
   * callback so the host never has to re-derive it.
   */
  path: string;
  /** The skill's listing-sourced description, shown in the tooltip. Omitted when empty. */
  description?: string;
  /**
   * Whether the current model/application does not support skills. While
   * `true` the `/{name}` label carries `unsupportedLabelClassName`, the chip
   * carries `unsupportedClassName`, and the tooltip shows the
   * unsupported-model message alone — no description paragraph and no
   * "View details" button.
   */
  isUnsupported?: boolean;
  /**
   * Why this skill's url resolved to no loaded listing entry (absent from
   * every pool). While set, it takes precedence over `isUnsupported` and the
   * tooltip shows a fixed icon-plus-message for that reason alone — no
   * description paragraph and no "View details" button, since there is no
   * metadata to fetch and no panel to open. The `/{name}` label itself is
   * unaffected — it keeps rendering with `labelClassName` alone.
   */
  unresolvedReason?: SkillUnresolvedReason;
  /** CSS class applied to the `/name` label. Defaults to `'dial-body-paragraph-text'`. */
  labelClassName?: string;
  /**
   * Color class applied to the `/{name}` label in addition to
   * `labelClassName` while `isUnsupported` is set. Defaults to `'text-error'`.
   */
  unsupportedLabelClassName?: string;
  /**
   * Class applied to the chip in addition to its layout classes while
   * `isUnsupported` is set. Defaults to `'bg-error'`.
   */
  unsupportedClassName?: string;
  /**
   * How the description card opens. Defaults to `'hover'` so existing hosts
   * retain their hover-and-focus behaviour.
   */
  detailsTrigger?: ChatSkillDetailsTrigger;
  /** Called with the skill's path when the tooltip's "View details" button is clicked. */
  onViewDetails: (path: string) => void;
  /** Localizable string overrides. */
  labels?: ChatSkillLabels;
}
