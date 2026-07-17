import type {
  CodeBlockTheme,
  DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import type { AttachmentTypeLabels } from './attachment-card';

/** How the unified attachment tile grid should render for a given total attachment count. */
export enum AttachmentTilesLayout {
  /** No attachments. */
  None = 'none',
  /** Below the collapse threshold, or expanded: every tile shown. */
  AllVisible = 'all-visible',
  /** At/above the collapse threshold, not yet expanded: a few tiles + a "+N" tile. */
  Collapsed = 'collapsed',
}

/** Rendering plan for the unified attachment tile grid. */
export interface AttachmentTilesPlan {
  /** Which rendering mode the grid should use. */
  layout: AttachmentTilesLayout;
  /** Number of tiles to actually render. */
  visibleCount: number;
  /** Number of attachments hidden behind the "+N" tile (0 unless `layout` is `Collapsed`). */
  hiddenCount: number;
}

/** Localised accessible labels for the `AttachmentGroup` component. */
export interface AttachmentGroupLabels extends AttachmentTypeLabels {
  /** Accessible label for the group region. Defaults to `'Attachments'`. */
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
   * Resolves the header count label (e.g. `'3 attachments'`) for a given
   * attachment count. Defaults to English `'{count} attachment'` /
   * `'{count} attachments'` pluralization.
   */
  getHeaderLabel?: (count: number) => string;
}

/** CSS custom-property overrides for the `AttachmentGroup` component. */
export interface AttachmentGroupColors {
  /** Group container background color. */
  background?: string;
  /** Group container border color. */
  border?: string;
  /** Header icon/label/download-all button text color. */
  text?: string;
}

/** Typography overrides for the `AttachmentGroup` component. */
export interface AttachmentGroupTypography {
  /** Typography class applied to the header's attachment-count label. Defaults to `'dial-tiny-semi-text'`. */
  headerLabelClassName?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: AttachmentGroupColors;
}

/** Style overrides for the `AttachmentGroup` component. */
export interface AttachmentGroupStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: AttachmentGroupColors;
  /** Typography overrides for the header label. */
  typography?: AttachmentGroupTypography;
  /** Extra class name(s) merged onto the root element. */
  className?: string;
}

/** Props accepted by the `AttachmentGroup` component. */
export interface AttachmentGroupProps {
  /** The message's full attachment list (images and files together). */
  attachments: DisplayAttachment[];
  /** Called when the user clicks/activates a previewable image tile or a file row (downloads it). */
  onAttachmentClick?: (attachment: DisplayAttachment) => void;
  /**
   * Called with every currently downloadable attachment when the user
   * activates the "download all" header action. Falls back to invoking
   * `onAttachmentClick` once per downloadable attachment when omitted.
   */
  onDownloadAll?: (attachments: DisplayAttachment[]) => void;
  /** Called when the user retries a failed upload. */
  onRetry?: (id: string) => void;
  /** Resolves the human-readable size label for an attachment, when derivable. Omitted from display when absent. */
  getSizeLabel?: (attachment: DisplayAttachment) => string | undefined;
  /** Localised accessible labels for the group region, its actions, and the non-extension attachment type names (prompt/pasted/image), forwarded to each tile. */
  labels?: AttachmentGroupLabels;
  /** Style overrides for the group. */
  styles?: AttachmentGroupStyles;
  /**
   * File tile surface color theme, matching the markdown code block's own
   * light/dark surface (never plain white). Forwarded to each
   * non-previewable file tile. Defaults to `'dark'`.
   */
  theme?: CodeBlockTheme;
}
