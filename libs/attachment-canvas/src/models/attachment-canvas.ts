import type {
  CodeBlockTheme,
  CustomVisualizerDataLayout,
} from '@epam/ai-dial-chat-shared';
import type { SidebarPanelStyles } from '@epam/ai-dial-sidebar';
import type { InputHighlightData } from '@epam/pdf-highlighter-kit';
import type { CSSProperties } from 'react';
import {
  AttachmentContentType,
  AttachmentErrorType,
} from '../types/attachment-canvas';

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

/** Content payload for PDF file attachments. */
export interface PdfCanvasContent {
  /** Discriminates the content type to select the correct renderer. */
  type: AttachmentContentType.Pdf;
  /** Resolved download URL or object URL for the PDF file. */
  url: string;
  /** Highlight regions to render over the PDF pages. */
  highlights?: InputHighlightData[];
  /** ID of the highlight to scroll to and select on initial load. */
  selectedHighlightId?: string;
}

/** Content payload for audio file attachments. */
export interface AudioCanvasContent {
  /** Discriminates the content type to select the correct renderer. */
  type: AttachmentContentType.Audio;
  /** Playback URL — object URL or resolved remote URL. */
  url: string;
  /** MIME type forwarded to the `<audio>` element (e.g. `audio/webm`). */
  mimeType?: string;
}

/** Content payload for syntax-highlighted source-code or text file attachments. */
export interface CodeCanvasContent {
  /** Discriminates the content type to select the correct renderer. */
  type: AttachmentContentType.Code;
  /** The raw source text to display. */
  text: string;
  /** `react-syntax-highlighter` language identifier (e.g. `'typescript'`). `undefined` renders plain monospace. */
  language?: string;
}

/** Content payload for HTML file attachments or external HTML URL sources. */
export interface HtmlCanvasContent {
  /** Discriminates the content type to select the correct renderer. */
  type: AttachmentContentType.Html;
  /** Full HTML text rendered via `srcdoc` in a sandboxed iframe. Used for file attachments. */
  srcdoc?: string;
  /** External URL rendered via `src` in a sandboxed iframe. Used for external link sources. */
  url?: string;
}

/** Content payload for a custom-visualizer attachment rendered inside a sandboxed iframe. */
export interface VisualizerCanvasContent {
  /** Discriminates the content type to select the correct renderer. */
  type: AttachmentContentType.Visualizer;
  /** Iframe `src`, resolved from the matching registry entry's `url`. */
  url: string;
  /** The attachment's own MIME type (not the registry entry's raw, possibly comma-separated, `contentType`). */
  mimeType: string;
  /** Opaque attachment payload consumed by the visualizer. */
  data: unknown;
  /** Presentation layout hints (`themeId`, `width`, `height`, `mobileHeight`). */
  layout: CustomVisualizerDataLayout;
  /** postMessage protocol namespace — MUST equal the registry entry's `title`, or the iframe never receives data. */
  visualizerName: string;
  /** Milliseconds to wait for a `send()` request's response before rejecting. From the registry entry; does NOT bound the handshake. */
  requestTimeout?: number;
}

/** Content payload for attachments whose format cannot be previewed. */
export interface UnsupportedCanvasContent {
  /** Discriminates the content type to select the correct renderer. */
  type: AttachmentContentType.Unsupported;
  /** Remote URL used to download the file even though it cannot be previewed. */
  url?: string;
}

/** Content payload for attachments whose file failed to load or that the user cannot access. */
export interface ErrorCanvasContent {
  /** Discriminates the content type to select the correct renderer. */
  type: AttachmentContentType.Error;
  /** The kind of failure that occurred. */
  errorType: AttachmentErrorType;
  /** Remote URL of the file, if known. Ignored for download purposes when `errorType` is `Forbidden`. */
  url?: string;
}

/** The content payload passed to AttachmentCanvas. */
export type AttachmentCanvasContent =
  | PlainTextCanvasContent
  | ImageCanvasContent
  | AudioCanvasContent
  | MarkdownCanvasContent
  | JsonCanvasContent
  | PdfCanvasContent
  | CodeCanvasContent
  | HtmlCanvasContent
  | VisualizerCanvasContent
  | UnsupportedCanvasContent
  | ErrorCanvasContent;

/** Themeable color overrides for the AttachmentCanvas content body. */
export interface AttachmentCanvasColors {
  /** Primary text color for the content body. */
  text?: string;
  /** Status/summary line text color. Defaults to `--text-secondary`. */
  statusText?: string;
  /** Error icon color. Defaults to `--text-error`. */
  errorIcon?: string;
  /** "Open in new tab" link color in the blocked-iframe panel. Defaults to `--text-accent`. */
  openInNewTabText?: string;
  /** Border color of the JSON viewer wrapper. Defaults to `--stroke-secondary`. */
  jsonBorder?: string;
  /** Background color of the JSON viewer wrapper. Defaults to `--bg-layer-1`. */
  jsonBackground?: string;
  /** JSON key/label color. Defaults to `--text-primary`. */
  jsonLabel?: string;
  /** JSON expandable key/label color. Defaults to `--text-primary`. */
  jsonClickableLabel?: string;
  /** JSON punctuation (braces, commas, colons) color. Defaults to `--text-secondary`. */
  jsonPunctuation?: string;
  /** JSON string-literal color. Defaults to `--text-success`. */
  jsonString?: string;
  /** JSON number-literal color. Defaults to `--text-accent`. */
  jsonNumber?: string;
  /** JSON boolean-literal color. Defaults to `--text-warning`. */
  jsonBoolean?: string;
  /** JSON `null`-literal color. Defaults to `--text-secondary`. */
  jsonNull?: string;
  /** Expand/collapse triangle color. Defaults to `--text-secondary`. */
  jsonToggleIcon?: string;
  /** Expand/collapse triangle color on hover. Defaults to `--text-primary`. */
  jsonToggleIconHover?: string;
  /** Text color of the collapsed-content ellipsis. Defaults to `--text-secondary`. */
  jsonCollapsedText?: string;
  /** Background color of the collapsed-content ellipsis. Defaults to `--bg-layer-raised`. */
  jsonCollapsedBackground?: string;
}

/** Themeable typography overrides for the AttachmentCanvas plain-text content body. */
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
   * A single CSS utility class applied to the content body instead of the
   * individual typography fields above. When set, those fields are ignored.
   */
  fontClassName?: string;
  /** CSS utility class applied to the JSON tree viewer. Defaults to `'dial-code-text'`. */
  jsonClassName?: string;
}

/** Combined style override prop for AttachmentCanvas. */
export interface AttachmentCanvasStyles {
  /** Color overrides for the content body, applied as CSS custom properties. */
  colors?: AttachmentCanvasColors;
  /** Typography overrides for the content body. */
  typography?: AttachmentCanvasTypography;
  /** Extra class name(s) merged onto the scrollable content body element. */
  bodyClassName?: string;
  /** Extra class name(s) merged onto the panel width wrapper. */
  className?: string;
  /**
   * Arbitrary CSS custom properties applied inline to the content body.
   * Merged after the typed color/typography vars, so they can override them.
   */
  cssVars?: CSSProperties;
  /** Style overrides forwarded to the underlying SidebarPanel (panel chrome). */
  panelStyles?: SidebarPanelStyles;
}

/** User-visible strings for the `AttachmentCanvas` component. */
export interface AttachmentCanvasLabels {
  /** Accessible label for the panel region. */
  ariaLabel: string;
  /** Accessible label for the close button. Defaults to `'Close'`. */
  closeLabel?: string;
  /** Message shown in the canvas body when the content type is `Unsupported`. Defaults to `'Preview is not supported for this file'`. */
  unsupportedLabel?: string;
  /** Message shown in the canvas body when content type is `Error` with `errorType: LoadFailed`. Defaults to `'Failed to load file'`. */
  loadErrorLabel?: string;
  /** Message shown in the canvas body when content type is `Error` with `errorType: Forbidden`. Defaults to `"You don't have permission to access this file"`. */
  forbiddenErrorLabel?: string;
  /** Accessible label for the download button. Defaults to `'Download'`. */
  downloadLabel?: string;
  /** Tooltip and accessible label for the copy-text button in its default state. Defaults to `'Copy text'`. */
  copyTextLabel?: string;
  /** Tooltip and accessible label for the copy-text button after a successful copy. Defaults to `'Copied!'`. */
  copiedTextLabel?: string;
  /** Tooltip and accessible label for the copy-as-markdown button in its default state. Defaults to `'Copy as Markdown'`. */
  copyMarkdownLabel?: string;
  /** Tooltip and accessible label for the copy-as-markdown button after a successful copy. Defaults to `'Copied!'`. */
  copiedMarkdownLabel?: string;
  /** Tooltip and accessible label for the copy-JSON button in its default state. Defaults to `'Copy as JSON'`. */
  copyJsonLabel?: string;
  /** Tooltip and accessible label for the copy-JSON button after a successful copy. Defaults to `'Copied!'`. */
  copiedJsonLabel?: string;
  /** Message shown inside the visualizer canvas when the iframe handshake fails. Defaults to `'Failed to load visualizer'`. */
  visualizerErrorLabel?: string;
  /** Message shown when a URL-sourced iframe is blocked by the page's CSP or X-Frame-Options. Defaults to `'This page cannot be displayed in preview'`. */
  htmlFrameBlockedLabel?: string;
  /** Label for the "Open in new tab" fallback link shown alongside `htmlFrameBlockedLabel`. Defaults to `'Open in new tab'`. */
  htmlOpenInNewTabLabel?: string;
  /** Tooltip and `aria-label` for the toggle button when the rendered view is active (clicking switches to source). Defaults to `'View source'`. */
  htmlViewSourceLabel?: string;
  /** Tooltip and `aria-label` for the toggle button when the source view is active (clicking switches back to rendered). Defaults to `'View rendered'`. */
  htmlViewRenderedLabel?: string;
}

/** Props for the AttachmentCanvas component. */
export interface AttachmentCanvasProps {
  /** Controls visibility of the side panel. */
  isOpen: boolean;
  /** When `true`, renders a loading spinner instead of content and hides action buttons. Defaults to `false`. */
  isLoading?: boolean;
  /** Called when the user activates the built-in close button. */
  onClose: () => void;
  /** The attachment content to render inside the canvas. */
  content: AttachmentCanvasContent;
  /** File name displayed as the panel title. */
  fileName?: string;
  /** User-visible strings. */
  labels: AttachmentCanvasLabels;
  /** Called when the user activates the download button. When omitted the download button is hidden. Hidden automatically when content type is `Unsupported`. */
  onDownload?: () => void;
  /** Called when the user activates the copy-text button. When omitted the button is hidden. Only relevant when content type is `PlainText`. */
  onCopyText?: () => void;
  /** Called when the user activates the copy-as-markdown button. When omitted the button is hidden. Only relevant when content type is `Markdown`. */
  onCopyMarkdown?: () => void;
  /** Called when the user activates the copy-JSON button. When omitted the button is hidden. Only relevant when content type is `Json`. */
  onCopyJson?: () => void;
  /** Whether the viewport is in mobile breakpoint — disables drag-to-resize. */
  isMobile?: boolean;
  /** Initial panel width in pixels (when resizable). Defaults to `min(maxWidth, 2/3 of viewport width)`. */
  defaultWidth?: number;
  /** Minimum panel width in pixels (when resizable). Defaults to `320`. */
  minWidth?: number;
  /** Maximum panel width in pixels (when resizable). Defaults to `1500`. */
  maxWidth?: number;
  /** Called with the new width in pixels after the user finishes a resize drag. */
  onResizeStop?: (width: number) => void;
  /** Style overrides for the content body and the underlying SidebarPanel chrome. */
  styles?: AttachmentCanvasStyles;
  /** Syntax highlight color theme forwarded to MarkdownRenderer code blocks. */
  codeBlockTheme?: CodeBlockTheme;
  /**
   * Fetches a PDF file by URL and returns its bytes as a `Blob`. Used when
   * content type is `Pdf` to load the file before rendering. Defaults to a
   * plain `fetch` if not provided.
   */
  loadPdf?: (url: string) => Promise<Blob>;
}
