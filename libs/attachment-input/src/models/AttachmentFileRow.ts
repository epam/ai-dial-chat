import type {
  CodeBlockTheme,
  DisplayAttachment,
} from '@epam/ai-dial-chat-shared';

/** Props accepted by the `AttachmentFileRow` component. */
export interface AttachmentFileRowProps {
  /** The non-previewable attachment this row represents. */
  attachment: DisplayAttachment;
  /** Byte size, when derivable; omitted from the meta line if absent. */
  sizeLabel?: string;
  /** Called when the user clicks the row or its download button. */
  onClick?: (attachment: DisplayAttachment) => void;
  /** Called when the user retries a failed upload. */
  onRetry?: (id: string) => void;
  /** Accessible label for the download action. Defaults to `'Download attachment'`. */
  clickLabel?: string;
  /** Accessible label for the retry action. Defaults to `'Retry upload'`. */
  retryLabel?: string;
  /**
   * Tile surface color theme, matching the markdown code block's own
   * light/dark surface (never plain white). Defaults to `'dark'`.
   */
  theme?: CodeBlockTheme;
  /** Extra class name(s) merged onto the root element. */
  className?: string;
}
