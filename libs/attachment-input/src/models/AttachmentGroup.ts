import type {
  CodeBlockTheme,
  DisplayAttachment,
} from '@epam/ai-dial-chat-shared';

/** Props accepted by the `AttachmentGroup` component. */
export interface AttachmentGroupProps {
  /** The message's full attachment list (images and files together). */
  attachments: DisplayAttachment[];
  /** Called when the user clicks/activates a previewable image tile or a file row (downloads it). */
  onAttachmentClick?: (attachment: DisplayAttachment) => void;
  /** Called when the user retries a failed upload. */
  onRetry?: (id: string) => void;
  /** Resolves the human-readable size label for an attachment, when derivable. Omitted from display when absent. */
  getSizeLabel?: (attachment: DisplayAttachment) => string | undefined;
  /** Accessible label for the group region. */
  ariaLabel?: string;
  /** Accessible label for each tile/row's click action. Defaults to `'Download attachment'`. */
  clickLabel?: string;
  /** Accessible label for each row's retry action. Defaults to `'Retry upload'`. */
  retryLabel?: string;
  /** Label for the "show less" header action, shown once the group has been expanded via the "+N" tile. Defaults to `'Show less'`. */
  showLessLabel?: string;
  /** Label for the "download all" header action, shown whenever the group has 2+ attachments. Defaults to `'Download all'`. */
  downloadAllLabel?: string;
  /**
   * File tile surface color theme, matching the markdown code block's own
   * light/dark surface (never plain white). Forwarded to each
   * non-previewable file tile. Defaults to `'dark'`.
   */
  theme?: CodeBlockTheme;
  /** Extra class name(s) merged onto the root element. */
  className?: string;
}
