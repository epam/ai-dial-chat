import type { CodeBlockTheme } from '@epam/ai-dial-chat-shared';
import type { SidebarPanelStyles } from '@epam/ai-dial-sidebar';
import type { CSSProperties } from 'react';
import { AttachmentContentType } from '../types/attachment-canvas';

/** Content payload for plain-text attachments. */
export interface PlainTextCanvasContent {
  /** Discriminates the content type to select the correct renderer. */
  type: AttachmentContentType.PlainText;
  /** The raw text to display. */
  text: string;
}

/** Content payload for image attachments. */
export interface ImageCanvasContent {
  /** Discriminates the content type to select the correct renderer. */
  type: AttachmentContentType.Image;
  /** URL of the image to display (object URL or resolved download URL). */
  url: string;
}

/** Content payload for Markdown file attachments. */
export interface MarkdownCanvasContent {
  /** Discriminates the content type to select the correct renderer. */
  type: AttachmentContentType.Markdown;
  /** Raw Markdown string to render. */
  text: string;
}

/** Content payload for JSON file attachments. */
export interface JsonCanvasContent {
  /** Discriminates the content type to select the correct renderer. */
  type: AttachmentContentType.Json;
  /** Already-parsed JSON value. The lib never calls JSON.parse. */
  value: unknown;
}

/** Content payload for attachments whose format cannot be previewed. */
export interface UnsupportedCanvasContent {
  /** Discriminates the content type to select the correct renderer. */
  type: AttachmentContentType.Unsupported;
  /** Remote URL used to download the file even though it cannot be previewed. */
  url?: string;
}

/** The content payload passed to AttachmentCanvas. */
export type AttachmentCanvasContent =
  | PlainTextCanvasContent
  | ImageCanvasContent
  | MarkdownCanvasContent
  | JsonCanvasContent
  | UnsupportedCanvasContent;

/** Themeable color overrides for the AttachmentCanvas content body. */
export interface AttachmentCanvasColors {
  /** Primary text color for the content body. */
  text?: string;
}

/** Themeable typography overrides for the AttachmentCanvas content body. */
export interface AttachmentCanvasTypography {
  /** CSS font-family value. */
  fontFamily?: string;
  /** CSS font-size value. */
  fontSize?: string;
  /** CSS font-weight value. */
  fontWeight?: string | number;
  /** CSS line-height value. */
  lineHeight?: string | number;
  /** CSS letter-spacing value. */
  letterSpacing?: string;
  /**
   * A single CSS utility class applied to the content body instead of
   * individual typography vars. When set, individual typography fields
   * are ignored.
   */
  fontClassName?: string;
}

/** Combined style override prop for AttachmentCanvas. */
export interface AttachmentCanvasStyles {
  /** Color overrides for the content body, applied as CSS custom properties. */
  colors?: AttachmentCanvasColors;
  /** Typography overrides for the content body. */
  typography?: AttachmentCanvasTypography;
  /** Extra class name(s) merged onto the scrollable content body element. */
  bodyClassName?: string;
  /**
   * Arbitrary CSS custom properties applied inline to the content body.
   * Merged after the typed color/typography vars, so they can override them.
   */
  cssVars?: CSSProperties;
  /** Style overrides forwarded to the underlying SidebarPanel (panel chrome). */
  panelStyles?: SidebarPanelStyles;
}

/** Props for the AttachmentCanvas component. */
export interface AttachmentCanvasProps {
  /** Controls visibility of the side panel. */
  isOpen: boolean;
  /** Called when the user activates the built-in close button. */
  onClose: () => void;
  /** The attachment content to render inside the canvas. */
  content: AttachmentCanvasContent;
  /** File name displayed as the panel title. */
  fileName?: string;
  /** Accessible label for the panel region. */
  ariaLabel: string;
  /** Accessible label for the close button. Defaults to `'Close'`. */
  closeLabel?: string;
  /** Called when the user activates the download button. When omitted the download button is hidden. Hidden automatically when content type is `Unsupported`. */
  onDownload?: () => void;
  /** Called when the user activates the copy-as-markdown button. When omitted the button is hidden. Only relevant when content type is `Markdown`. */
  onCopyMarkdown?: () => void;
  /** Message shown in the canvas body when the content type is `Unsupported`. Defaults to `'Preview is not supported for this file'`. */
  unsupportedLabel?: string;
  /** Accessible label for the download button. Defaults to `'Download'`. */
  downloadLabel?: string;
  /** Tooltip and accessible label for the copy-as-markdown button in its default state. Defaults to `'Copy as Markdown'`. */
  copyMarkdownLabel?: string;
  /** Tooltip and accessible label for the copy-as-markdown button after a successful copy. Defaults to `'Copied!'`. */
  copiedMarkdownLabel?: string;
  /** Whether the viewport is in mobile breakpoint — disables drag-to-resize. */
  isMobile?: boolean;
  /** Initial panel width in pixels (when resizable). Defaults to `560`. */
  defaultWidth?: number;
  /** Minimum panel width in pixels (when resizable). Defaults to `320`. */
  minWidth?: number;
  /** Maximum panel width in pixels (when resizable). Defaults to `960`. */
  maxWidth?: number;
  /** Called with the new width in pixels after the user finishes a resize drag. */
  onResizeStop?: (width: number) => void;
  /** Style overrides for the content body and the underlying SidebarPanel chrome. */
  styles?: AttachmentCanvasStyles;
  /** Extra class name(s) merged onto the panel width wrapper. */
  className?: string;
  /** Syntax highlight color theme forwarded to MarkdownRenderer code blocks. */
  codeBlockTheme?: CodeBlockTheme;
}
