import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';

/** Props accepted by the `AttachmentTray` component. */
export interface AttachmentTrayProps {
  /** The list of attachments to display. */
  attachments: DisplayAttachment[];
  /** Called when the user removes an attachment card. */
  onRemove?: (id: string) => void;
  /** Called when the user retries a failed attachment upload. */
  onRetry?: (id: string) => void;
  /** Called when the user clicks a pasted-text card to expand its content back into the input. */
  onExpand?: (id: string) => void;
  /** Accessible label for the tray region. */
  ariaLabel?: string;
  /** Accessible label for each card's remove button. */
  removeLabel?: string;
  /** Accessible label for each card's retry button (error state only). */
  retryLabel?: string;
  /** Called when the user clicks or keyboard-activates an attachment card. Receives the full `DisplayAttachment` object. */
  onAttachmentClick?: (attachment: DisplayAttachment) => void;
  /** Accessible label forwarded to each card's root when it is interactive. When omitted, the card's own default (`'Open attachment'`) applies. */
  clickLabel?: string;
  /** Extra class name(s) merged onto the root element. */
  className?: string;
}
