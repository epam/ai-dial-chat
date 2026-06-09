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
  /** Called when the user activates the download button on an attachment card. When undefined, no download button is shown. */
  onDownload?: (id: string) => void;
  /** Accessible label for each card's download button. Defaults to `'Download'`. */
  downloadLabel?: string;
  /** Extra class name(s) merged onto the root element. */
  className?: string;
}
