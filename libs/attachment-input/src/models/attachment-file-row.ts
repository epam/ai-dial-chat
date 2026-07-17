import type {
  AttachmentErrorReason,
  CodeBlockTheme,
  DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import type { AttachmentTypeLabels } from './attachment-card';

/** Localised labels for the `AttachmentFileRow` component. */
export interface AttachmentFileRowLabels {
  /** Accessible label for the download action. Defaults to `'Download attachment'`. */
  clickLabel?: string;
  /** Accessible label for the retry action. Defaults to `'Retry upload'`. */
  retryLabel?: string;
  /** Human-readable size text (e.g. `'2.4 MB'`), appended after the type label in the meta line (`'.pdf · 2.4 MB'`) when derivable; omitted from the meta line if absent. */
  sizeLabel?: string;
  /** Accessible label for the in-progress upload progress bar. Defaults to `'Uploading'`. */
  uploadingLabel?: string;
  /** Per-`AttachmentErrorReason` error title text, shown as the tile's tooltip/title in error state. Defaults to built-in English reason text. */
  errorReasonLabels?: Partial<Record<AttachmentErrorReason, string>>;
  /** Fallback error title used when `errorReason` is absent or has no entry in `errorReasonLabels`. Defaults to `'Upload failed'`. */
  genericErrorLabel?: string;
}

/** CSS custom-property overrides for the `AttachmentFileRow` component. */
export interface AttachmentFileRowColors {
  /** Tile background color in the default state. */
  background?: string;
  /** Tile border color in the default state. */
  border?: string;
  /** Tile border color on hover. */
  borderHover?: string;
  /** Tile focus outline color. */
  focusOutline?: string;
  /** Tile background color in the error state. */
  backgroundError?: string;
  /** Tile border color in the error state. */
  borderError?: string;
  /** File name/type text color in the error state. */
  errorText?: string;
  /** File name text color. */
  nameText?: string;
  /** Type/meta text color. */
  typeText?: string;
  /** Hover download icon background color. */
  hoverIconBackground?: string;
  /** Hover download icon color. */
  hoverIconColor?: string;
  /** Upload progress track background color. */
  trackBackground?: string;
  /** Upload progress indeterminate fill color. */
  fillBackground?: string;
}

/** Style overrides for the `AttachmentFileRow` component. */
export interface AttachmentFileRowStyles {
  /** Typography class applied to the file name text. Defaults to `'dial-caption-text'`. */
  nameClassName?: string;
  /** Typography class applied to the bottom meta label (file type / status). Defaults to `'dial-caption-text'`. */
  metaClassName?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: AttachmentFileRowColors;
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
  /** Localised labels for the non-extension attachment type names (prompt/pasted/image). */
  typeLabels?: AttachmentTypeLabels;
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
