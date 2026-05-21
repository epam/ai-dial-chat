import { MessageRole } from '@epam/ai-dial-chat-shared';

/** Props accepted by the `MessageActions` component. */
export interface MessageActionsProps {
  /** Which action set to render — `'User'` shows Edit/Delete, `'Agent'` shows Regenerate/Copy/Markdown/Like/Dislike. Defaults to `'User'`. */
  role?: MessageRole;
  /** Extra class name(s) merged onto the root wrapper element. */
  className?: string;
  /** When `true`, actions are always visible instead of appearing only on group hover. */
  alwaysVisible?: boolean;
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
