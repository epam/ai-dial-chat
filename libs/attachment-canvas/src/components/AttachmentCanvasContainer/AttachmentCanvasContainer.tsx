import {
  copyToClipboard,
  type CodeBlockTheme,
} from '@epam/ai-dial-chat-shared';
import { memo, useCallback, type FC } from 'react';
import { useAttachmentCanvas } from '../../context/AttachmentCanvasContext';
import type {
  JsonCanvasContent,
  MarkdownCanvasContent,
  PlainTextCanvasContent,
} from '../../models/attachment-canvas';
import { AttachmentContentType } from '../../types/attachment-canvas';
import { downloadAttachmentContent } from '../../utils/download';
import { AttachmentCanvas } from '../AttachmentCanvas/AttachmentCanvas';

/** Props for the AttachmentCanvasContainer component. */
export interface AttachmentCanvasContainerProps {
  /** Accessible label for the panel region. Defaults to `'Attachment preview'`. */
  ariaLabel?: string;
  /** Accessible label for the close button. Defaults to `'Close'`. */
  closeLabel?: string;
  /** Accessible label for the download button. Defaults to `'Download'`. */
  downloadLabel?: string;
  /** Message shown when the content type is `Unsupported`. Defaults to `'Preview is not supported for this file'`. */
  unsupportedLabel?: string;
  /** Tooltip and aria-label for the copy-text button in its default state. Defaults to `'Copy text'`. */
  copyTextLabel?: string;
  /** Tooltip and aria-label for the copy-text button after a successful copy. Defaults to `'Copied!'`. */
  copiedTextLabel?: string;
  /** Tooltip and aria-label for the copy-as-markdown button in its default state. Defaults to `'Copy as Markdown'`. */
  copyMarkdownLabel?: string;
  /** Tooltip and aria-label for the copy-as-markdown button after a successful copy. Defaults to `'Copied!'`. */
  copiedMarkdownLabel?: string;
  /** Tooltip and aria-label for the copy-JSON button in its default state. Defaults to `'Copy as JSON'`. */
  copyJsonLabel?: string;
  /** Tooltip and aria-label for the copy-JSON button after a successful copy. Defaults to `'Copied!'`. */
  copiedJsonLabel?: string;
  /** Whether the viewport is in mobile breakpoint — disables drag-to-resize. Defaults to `false`. */
  isMobile?: boolean;
  /** Initial panel width in pixels. When omitted, SidebarPanel uses its own default. */
  defaultWidth?: number;
  /** Syntax highlight color theme forwarded to MarkdownRenderer code blocks. */
  codeBlockTheme?: CodeBlockTheme;
}

/** Context-connected container that renders `AttachmentCanvas` with download support. */
export const AttachmentCanvasContainer: FC<AttachmentCanvasContainerProps> =
  memo(
    ({
      ariaLabel = 'Attachment preview',
      closeLabel = 'Close',
      downloadLabel = 'Download',
      unsupportedLabel = 'Preview is not supported for this file',
      copyTextLabel,
      copiedTextLabel,
      copyMarkdownLabel,
      copiedMarkdownLabel,
      copyJsonLabel,
      copiedJsonLabel,
      isMobile = false,
      defaultWidth,
      codeBlockTheme,
    }) => {
      const { isOpen, content, fileName, closeCanvas } = useAttachmentCanvas();

      const handleDownload = useCallback(() => {
        downloadAttachmentContent(content, fileName);
      }, [content, fileName]);

      const handleCopyText = useCallback(() => {
        if (content.type === AttachmentContentType.PlainText) {
          void copyToClipboard((content as PlainTextCanvasContent).text);
        }
      }, [content]);

      const handleCopyMarkdown = useCallback(() => {
        if (content.type === AttachmentContentType.Markdown) {
          void copyToClipboard((content as MarkdownCanvasContent).text);
        }
      }, [content]);

      const handleCopyJson = useCallback(() => {
        if (content.type === AttachmentContentType.Json) {
          void copyToClipboard(
            JSON.stringify((content as JsonCanvasContent).value, null, 2),
          );
        }
      }, [content]);

      return (
        <AttachmentCanvas
          isOpen={isOpen}
          onClose={closeCanvas}
          content={content}
          fileName={fileName}
          ariaLabel={ariaLabel}
          closeLabel={closeLabel}
          onDownload={handleDownload}
          downloadLabel={downloadLabel}
          onCopyText={
            content.type === AttachmentContentType.PlainText
              ? handleCopyText
              : undefined
          }
          copyTextLabel={copyTextLabel}
          copiedTextLabel={copiedTextLabel}
          onCopyMarkdown={
            content.type === AttachmentContentType.Markdown
              ? handleCopyMarkdown
              : undefined
          }
          copyMarkdownLabel={copyMarkdownLabel}
          copiedMarkdownLabel={copiedMarkdownLabel}
          onCopyJson={
            content.type === AttachmentContentType.Json
              ? handleCopyJson
              : undefined
          }
          copyJsonLabel={copyJsonLabel}
          copiedJsonLabel={copiedJsonLabel}
          unsupportedLabel={unsupportedLabel}
          isMobile={isMobile}
          defaultWidth={defaultWidth}
          codeBlockTheme={codeBlockTheme}
        />
      );
    },
  );
