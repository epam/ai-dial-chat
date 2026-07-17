import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';

/** Localised accessible labels for the `AttachmentTray` component. */
export interface AttachmentTrayLabels {
  /** Accessible label for the tray region. Defaults to `'Attached files'`. */
  ariaLabel?: string;
  /** Accessible label for each card's remove button. */
  removeLabel?: string;
  /** Accessible label for each card's retry button (error state only). */
  retryLabel?: string;
  /** Accessible label forwarded to each card's root when it is interactive. When omitted, the card's own default (`'Open attachment'`) applies. */
  clickLabel?: string;
}

/** Style overrides for the `AttachmentTray` component. */
export interface AttachmentTrayStyles {
  /** Extra class name(s) merged onto the root element. */
  className?: string;
}

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
  /** Called when the user clicks or keyboard-activates an attachment card. Receives the full `DisplayAttachment` object. */
  onAttachmentClick?: (attachment: DisplayAttachment) => void;
  /** Localised accessible labels for the tray region and each card's interactive elements. */
  labels?: AttachmentTrayLabels;
  /** Style overrides for the tray. */
  styles?: AttachmentTrayStyles;
}
