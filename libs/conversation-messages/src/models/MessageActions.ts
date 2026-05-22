import { MessageRole } from '@epam/ai-dial-chat-shared';

/** Tooltip labels for each message action button. All fields are optional; omitting a field falls back to the built-in default. */
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

/** Props accepted by the `MessageActions` component. */
export interface MessageActionsProps {
  /** Which action set to render — `'User'` shows Edit/Delete, `'Agent'` shows Regenerate/Copy/Markdown/Like/Dislike. Defaults to `'User'`. */
  role?: MessageRole;
  /** Extra class name(s) merged onto the root wrapper element. */
  className?: string;
  /** When `true`, actions are always visible instead of appearing only on group hover. */
  alwaysVisible?: boolean;
  /** Override tooltip labels for individual action buttons. */
  tooltips?: MessageActionTooltips;
  /** Called when the user clicks the Edit button (User source only). */
  onEdit?: () => void;
  /** Called when the user clicks the Delete button (User source only). */
  onDelete?: () => void;
  /** Called when the user clicks the Regenerate button (Agent source only). */
  onRegenerate?: () => void;
  /** Called when the user clicks the Copy button (Agent source only). */
  onCopy?: () => void;
  /** Called when the user clicks the Copy Markdown button (Agent source only). */
  onCopyMarkdown?: () => void;
  /** Called when the user clicks the Like button (Agent source only). */
  onLike?: () => void;
  /** Called when the user clicks the Dislike button (Agent source only). */
  onDislike?: () => void;
}
