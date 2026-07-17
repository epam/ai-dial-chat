import type {
  AttachmentErrorReason,
  DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import { CSSProperties } from 'react';
import type { AttachmentTypeLabels } from './attachment-card';

/** Localised labels for the `FileAttachment` component. */
export interface FileAttachmentLabels extends AttachmentTypeLabels {
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

/** Typography overrides for the `FileAttachment` component. */
export interface FileAttachmentTypography {
  /** Typography class applied to the file name text. Defaults to `'dial-caption-text'`. */
  nameClassName?: string;
  /** Typography class applied to the bottom meta label (file type / status). Defaults to `'dial-caption-text'`. */
  metaClassName?: string;
}

/** Style overrides for the `FileAttachment` component. */
export interface FileAttachmentStyles {
  /** Typography overrides for the file name and meta label text. */
  typography?: FileAttachmentTypography;
  /** Extra class name(s) merged onto the root element. */
  className?: string;
}

/** Props accepted by the `FileAttachment` component. */
export interface FileAttachmentProps {
  /** The non-previewable attachment this row represents. */
  attachment: DisplayAttachment;
  /** Called when the user clicks the row or its download button. */
  onClick?: (id: string) => void;
  /** Called when the user retries a failed upload. */
  onRetry?: (id: string) => void;
  /** Called when the user expands a pasted attachment. */
  onExpand?: (id: string) => void;
  /** Called when the user clicks the download button. */
  onDownload?: (id: string) => void;
  /** Called when the user clicks the remove button. */
  onRemove?: (id: string) => void;
  /** Localised labels for the download/retry actions, size text, and the non-extension attachment type names (prompt/pasted/image). */
  labels?: FileAttachmentLabels;
  /** Style overrides for the row. */
  styles?: FileAttachmentStyles;
  /** Whether the attachment is pasted (vs. prompt). Defaults to `false`. */
  isPasted?: boolean;
  /** Whether the attachment is a link (vs. a file). Defaults to `false`. */
  isLink?: boolean;
  /** CSS custom properties applied to the root element. */
  cssVars?: CSSProperties;
  /** Whether the attachment is expandable (vs. clickable). Defaults to `false`. */
  isExpandable?: boolean;
}
