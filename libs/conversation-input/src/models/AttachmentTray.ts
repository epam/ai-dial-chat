import type { Attachment } from '@epam/ai-dial-chat-shared';

/** Props accepted by the `AttachmentTray` component. */
export interface AttachmentTrayProps {
  /** The list of attachments to display. */
  attachments: Attachment[];
  /** Called when the user removes an attachment card. */
  onRemove: (id: string) => void;
  /** Called when the user retries a failed attachment upload. */
  onRetry?: (id: string) => void;
  /** Accessible label for the tray region. */
  ariaLabel?: string;
  /** Accessible label for each card's remove button. */
  removeLabel?: string;
  /** Accessible label for each card's retry button (error state only). */
  retryLabel?: string;
  /** Extra class name(s) merged onto the root element. */
  className?: string;
}
