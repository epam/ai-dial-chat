import {
  copyToClipboard,
  type CodeBlockTheme,
} from '@epam/ai-dial-chat-shared';
import { memo, useCallback, type FC } from 'react';
import { useAttachmentCanvas } from '../../context/AttachmentCanvasContext';
import type {
  AttachmentCanvasLabels,
  CodeCanvasContent,
  JsonCanvasContent,
  MarkdownCanvasContent,
  PlainTextCanvasContent,
} from '../../models/attachment-canvas';
import { AttachmentContentType } from '../../types/attachment-canvas';
import { downloadAttachmentContent } from '../../utils/download';
import { AttachmentCanvas } from '../AttachmentCanvas/AttachmentCanvas';

/** Props for the AttachmentCanvasContainer component. */
export interface AttachmentCanvasContainerProps {
  /** User-visible strings. All fields have English defaults. */
  labels?: AttachmentCanvasLabels;
  /** Whether the viewport is in mobile breakpoint — disables drag-to-resize. Defaults to `false`. */
  isMobile?: boolean;
  /** Initial panel width in pixels. When omitted, SidebarPanel uses its own default. */
  defaultWidth?: number;
  /** Maximum panel width in pixels. Constrains drag-to-resize so the chat area is never fully hidden. */
  maxWidth?: number;
  /** Syntax highlight color theme forwarded to MarkdownRenderer code blocks. */
  codeBlockTheme?: CodeBlockTheme;
}

/** Context-connected container that renders `AttachmentCanvas` with download support. */
export const AttachmentCanvasContainer: FC<AttachmentCanvasContainerProps> =
  memo(
    ({ labels, isMobile = false, defaultWidth, maxWidth, codeBlockTheme }) => {
      const {
        ariaLabel = 'Attachment preview',
        closeLabel = 'Close',
        downloadLabel = 'Download',
        unsupportedLabel = 'Preview is not supported for this file',
        loadErrorLabel = 'Failed to load file',
        forbiddenErrorLabel = "You don't have permission to access this file",
        copyTextLabel,
        copiedTextLabel,
        copyMarkdownLabel,
        copiedMarkdownLabel,
        copyJsonLabel,
        copiedJsonLabel,
        htmlFrameBlockedLabel,
        htmlOpenInNewTabLabel,
        htmlViewSourceLabel,
        htmlViewRenderedLabel,
        pdfThumbnailsLabel,
        pdfShowThumbnailsLabel,
        pdfHideThumbnailsLabel,
        pdfPageNumberLabel,
      } = labels ?? {};

      const { isOpen, isLoading, content, fileName, closeCanvas } =
        useAttachmentCanvas();

      const handleDownload = useCallback(() => {
        downloadAttachmentContent(content, fileName);
      }, [content, fileName]);

      const handleCopyText = useCallback(() => {
        if (content.type === AttachmentContentType.PlainText) {
          void copyToClipboard((content as PlainTextCanvasContent).text);
        } else if (content.type === AttachmentContentType.Code) {
          void copyToClipboard((content as CodeCanvasContent).text);
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
          isLoading={isLoading}
          onClose={closeCanvas}
          content={content}
          fileName={fileName}
          labels={{
            ariaLabel,
            closeLabel,
            downloadLabel,
            copyTextLabel,
            copiedTextLabel,
            copyMarkdownLabel,
            copiedMarkdownLabel,
            copyJsonLabel,
            copiedJsonLabel,
            unsupportedLabel,
            loadErrorLabel,
            forbiddenErrorLabel,
            htmlFrameBlockedLabel,
            htmlOpenInNewTabLabel,
            htmlViewSourceLabel,
            htmlViewRenderedLabel,
            pdfThumbnailsLabel,
            pdfShowThumbnailsLabel,
            pdfHideThumbnailsLabel,
            pdfPageNumberLabel,
          }}
          onDownload={handleDownload}
          onCopyText={
            content.type === AttachmentContentType.PlainText ||
            content.type === AttachmentContentType.Code
              ? handleCopyText
              : undefined
          }
          onCopyMarkdown={
            content.type === AttachmentContentType.Markdown
              ? handleCopyMarkdown
              : undefined
          }
          onCopyJson={
            content.type === AttachmentContentType.Json
              ? handleCopyJson
              : undefined
          }
          isMobile={isMobile}
          defaultWidth={defaultWidth}
          maxWidth={maxWidth}
          codeBlockTheme={codeBlockTheme}
        />
      );
    },
  );
