import { MessageRating, MessageRole } from '@epam/ai-dial-chat-shared';

/** Tooltip overrides for each action button. Omitted fields fall back to built-in defaults. */
export interface MessageActionTooltips {
  /** Tooltip for the Edit button. */
  edit?: string;
  /** Tooltip for the Delete button. */
  delete?: string;
  /** Tooltip for the Regenerate button. */
  regenerate?: string;
  /** Tooltip for the Copy button in its default state. */
  copy?: string;
  /** Tooltip shown on the Copy button immediately after copying. */
  copied?: string;
  /** Tooltip for the Copy as Markdown button in its default state. */
  copyMarkdown?: string;
  /** Tooltip shown on the Copy as Markdown button immediately after copying. */
  copiedMarkdown?: string;
  /** Tooltip for the Like button. */
  like?: string;
  /** Tooltip for the Dislike button. */
  dislike?: string;
}

/** aria-label overrides for each action button. Omitted fields fall back to built-in English defaults. */
export interface MessageActionAriaLabels {
  /** aria-label for the Edit button. */
  editMessage?: string;
  /** aria-label for the Delete button. */
  deleteMessage?: string;
  /** aria-label for the Regenerate button. */
  regenerateResponse?: string;
  /** aria-label for the Copy button. */
  copyResponse?: string;
  /** aria-label for the Copy as Markdown button. */
  copyAsMarkdown?: string;
  /** aria-label for the Like button. */
  likeResponse?: string;
  /** aria-label for the Dislike button. */
  dislikeResponse?: string;
  /** aria-label for the toolbar container. */
  actionsGroup?: string;
  /** Announced after copying the response text. */
  copiedStatus?: string;
  /** Announced after copying the response as Markdown. */
  copiedMarkdownStatus?: string;
}

/** Tooltip and aria-label overrides for `MessageActions`. */
export interface MessageActionLabels {
  /** Tooltip overrides per button. */
  tooltips?: MessageActionTooltips;
  /** aria-label overrides per button. */
  ariaLabels?: MessageActionAriaLabels;
}

/** Color overrides for `MessageActions`, applied as CSS custom properties with app theme fallbacks. */
export interface MessageActionColors {
  /** Icon color of the active Like/Dislike button. Fallback: `--text-accent`. */
  activeRatingText?: string;
}

/** Props for the `MessageActions` component. */
export interface MessageActionsProps {
  /** Which actions are shown. `'User'` = Edit/Delete; `'Agent'` = Regenerate/Copy/Like/Dislike. Defaults to `'User'`. */
  role?: MessageRole;
  /** Extra class(es) on the root element. */
  className?: string;
  /** Shows actions permanently instead of on group hover only. */
  isAlwaysVisible?: boolean;
  /** Tooltip and aria-label overrides. */
  labels?: MessageActionLabels;
  /** Fires on Edit click. User role only. */
  onEdit?: () => void;
  /** Fires on Edit hover; useful for preloading the edit UI. User role only. */
  onEditHover?: () => void;
  /** Fires on Delete click. User role only. */
  onDelete?: () => void;
  /** Fires on Regenerate click. Agent role only. */
  onRegenerate?: () => void;
  /** Fires on Copy click. Agent role only. */
  onCopy?: () => void;
  /** Fires on Copy Markdown click. Agent role only. */
  onCopyMarkdown?: () => void;
  /** Fires on Like click. Agent role only. */
  onLike?: () => void;
  /** Fires on Dislike click. Agent role only. */
  onDislike?: () => void;
  /** Active rating; highlights the matching Like/Dislike button when set. */
  activeRating?: MessageRating;
  /** Color overrides. */
  colors?: MessageActionColors;
}
