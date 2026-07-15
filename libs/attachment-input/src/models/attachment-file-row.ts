import type {
  CodeBlockTheme,
  DisplayAttachment,
} from '@epam/ai-dial-chat-shared';

/** Localised labels for the `AttachmentFileRow` component. */
export interface AttachmentFileRowLabels {
  /** Accessible label for the download action. Defaults to `'Download attachment'`. */
  clickLabel?: string;
  /** Accessible label for the retry action. Defaults to `'Retry upload'`. */
  retryLabel?: string;
  /** Human-readable size text (e.g. `'2.4 MB'`), appended after the type label in the meta line (`'.pdf · 2.4 MB'`) when derivable; omitted from the meta line if absent. */
  sizeLabel?: string;
}

/** Style overrides for the `AttachmentFileRow` component. */
export interface AttachmentFileRowStyles {
  /** Typography class applied to the file name text. Defaults to `'dial-caption-text'`. */
  nameClassName?: string;
  /** Typography class applied to the bottom meta label (file type / status). Defaults to `'dial-caption-text'`. */
  metaClassName?: string;
}

/** Props accepted by the `AttachmentFileRow` component. */
export interface AttachmentFileRowProps {
  /** The non-previewable attachment this row represents. */
  attachment: DisplayAttachment;
  /** Called when the user clicks the row or its download button. */
  onClick?: (attachment: DisplayAttachment) => void;
  /** Called when the user retries a failed upload. */
  onRetry?: (id: string) => void;
  /** Localised labels for the download/retry actions and size text. */
  labels?: AttachmentFileRowLabels;
  /** Style overrides for the file name and meta label text. */
  styles?: AttachmentFileRowStyles;
  /**
   * Tile surface color theme, matching the markdown code block's own
   * light/dark surface (never plain white). Defaults to `'dark'`.
   */
  theme?: CodeBlockTheme;
  /** Extra class name(s) merged onto the root element. */
  className?: string;
}
