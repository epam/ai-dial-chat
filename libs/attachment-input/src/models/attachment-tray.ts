import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import type { AttachmentCardStyles } from './attachment-card';

/** Localised accessible labels for the `AttachmentTray` component. */
export interface AttachmentTrayLabels {
  /** Accessible label for the tray region. Defaults to `'Attached files'`. */
  ariaLabel?: string;
  /** Accessible label for each card's remove button. */
  removeLabel?: string;
  /** Accessible label for each card's retry button (error state only). */
  retryLabel?: string;
  /** Accessible name forwarded to each card's root when it is interactive via `onAttachmentClick`. When omitted, the card's own default applies (`'Open attachment'` on image tiles, `'Download attachment'` on file, link and pasted-text tiles). */
  clickLabel?: string;
  /** Accessible name forwarded to each pasted-text card's root when it is interactive via `onExpand`. Defaults to `'Expand pasted text'`. */
  expandLabel?: string;
  /** Accessible label for each card's in-progress upload progress bar. Defaults to `'Uploading'`. */
  uploadingLabel?: string;
}

/** Style overrides for the `AttachmentTray` component. */
export interface AttachmentTrayStyles {
  /** Extra class name(s) merged onto the root element. */
  className?: string;
  /** Colors, typography, and shape forwarded to every card in the tray. */
  card?: AttachmentCardStyles;
}

/** Props accepted by the `AttachmentTray` component. */
export interface AttachmentTrayProps {
  /** The list of attachments to display. */
  attachments: DisplayAttachment[];
  /** Called when the user removes an attachment card. */
  onRemove?: (id: string) => void;
  /** Called when the user retries a failed attachment upload. */
  onRetry?: (id: string) => void;
  /** Called when the user clicks or keyboard-activates a pasted-text card to expand its content back into the input. Takes precedence over `onAttachmentClick` on pasted-text cards. */
  onExpand?: (id: string) => void;
  /** Called when the user clicks or keyboard-activates an attachment card. Receives the attachment `id`. When omitted, cards without an applicable `onExpand` are non-interactive. */
  onAttachmentClick?: (id: string) => void;
  /** Localised accessible labels for the tray region and each card's interactive elements. */
  labels?: AttachmentTrayLabels;
  /** Style overrides for the tray. */
  styles?: AttachmentTrayStyles;
}
