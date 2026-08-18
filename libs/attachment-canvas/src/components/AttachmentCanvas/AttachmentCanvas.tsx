import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { SidebarOrientation, SidebarPanel } from '@epam/ai-dial-sidebar';
import { DIAL_ICON_SIZE, GhostIconButton } from '@epam/ai-dial-ui-kit';
import {
  IconCheck,
  IconCode,
  IconCopy,
  IconDownload,
  IconEye,
  IconMarkdown,
} from '@tabler/icons-react';
import { type FC, memo, useCallback, useEffect, useRef, useState } from 'react';
import type { AttachmentCanvasProps } from '../../models/attachment-canvas';
import { AttachmentContentType } from '../../types/attachment-canvas';
import { isDownloadable } from '../../utils/download';
import { AttachmentCanvasBody } from '../AttachmentCanvasBody/AttachmentCanvasBody';

const COPY_RESET_MS = 2000;

const AttachmentCanvasBase: FC<AttachmentCanvasProps> = ({
  isOpen,
  isLoading = false,
  onClose,
  content,
  fileName,
  labels: {
    ariaLabel,
    closeLabel = 'Close',
    downloadLabel = 'Download',
    copyTextLabel = 'Copy text',
    copiedTextLabel = 'Copied!',
    copyMarkdownLabel = 'Copy as Markdown',
    copiedMarkdownLabel = 'Copied!',
    copyJsonLabel = 'Copy as JSON',
    copiedJsonLabel = 'Copied!',
    visualizerErrorLabel,
    unsupportedLabel = 'Preview is not supported for this file',
    loadErrorLabel = 'Failed to load file',
    forbiddenErrorLabel = "You don't have permission to access this file",
    htmlFrameBlockedLabel = 'This page cannot be displayed in preview',
    htmlOpenInNewTabLabel = 'Open in new tab',
    htmlViewSourceLabel = 'View source',
    htmlViewRenderedLabel = 'View rendered',
  },
  onDownload,
  onCopyText,
  onCopyMarkdown,
  onCopyJson,
  isMobile = false,
  defaultWidth,
  minWidth = 600,
  maxWidth = 1500,
  onResizeStop,
  styles: stylesProp,
  codeBlockTheme,
  loadPdf,
}) => {
  const [isCopiedText, setIsCopiedText] = useState(false);
  const [isCopiedMarkdown, setIsCopiedMarkdown] = useState(false);
  const [isCopiedJson, setIsCopiedJson] = useState(false);
  const [isHtmlSourceView, setIsHtmlSourceView] = useState(false);
  const copyTextResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyJsonResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopyText = useCallback(() => {
    onCopyText?.();
    if (copyTextResetRef.current != null) {
      clearTimeout(copyTextResetRef.current);
    }
    setIsCopiedText(true);
    copyTextResetRef.current = setTimeout(
      () => setIsCopiedText(false),
      COPY_RESET_MS,
    );
  }, [onCopyText]);

  const handleCopyMarkdown = useCallback(() => {
    onCopyMarkdown?.();
    if (copyResetRef.current != null) {
      clearTimeout(copyResetRef.current);
    }
    setIsCopiedMarkdown(true);
    copyResetRef.current = setTimeout(
      () => setIsCopiedMarkdown(false),
      COPY_RESET_MS,
    );
  }, [onCopyMarkdown]);

  const handleCopyJson = useCallback(() => {
    onCopyJson?.();
    if (copyJsonResetRef.current != null) {
      clearTimeout(copyJsonResetRef.current);
    }
    setIsCopiedJson(true);
    copyJsonResetRef.current = setTimeout(
      () => setIsCopiedJson(false),
      COPY_RESET_MS,
    );
  }, [onCopyJson]);

  useEffect(() => {
    return () => {
      if (copyTextResetRef.current != null)
        clearTimeout(copyTextResetRef.current);
      if (copyResetRef.current != null) clearTimeout(copyResetRef.current);
      if (copyJsonResetRef.current != null)
        clearTimeout(copyJsonResetRef.current);
    };
  }, []);

  const handleToggleHtmlView = useCallback(() => {
    setIsHtmlSourceView((prev) => !prev);
  }, []);

  useEffect(() => {
    setIsHtmlSourceView(false);
  }, [content]);

  const { className, panelStyles, ...bodyStylesProp } = stylesProp ?? {};

  const showHtmlToggle =
    !isLoading &&
    content.type === AttachmentContentType.Html &&
    content.srcdoc != null;

  const showCopyText =
    !isLoading &&
    onCopyText != null &&
    (content.type === AttachmentContentType.PlainText ||
      content.type === AttachmentContentType.Code);
  const showCopyMarkdown =
    !isLoading &&
    onCopyMarkdown != null &&
    content.type === AttachmentContentType.Markdown;
  const showCopyJson =
    !isLoading &&
    onCopyJson != null &&
    content.type === AttachmentContentType.Json;
  const showDownload =
    !isLoading && onDownload != null && isDownloadable(content);

  return (
    <SidebarPanel
      isOpen={isOpen}
      orientation={SidebarOrientation.Right}
      title={fileName}
      labels={{ ariaLabel, closeLabel }}
      onClose={onClose}
      resizable={!isMobile}
      defaultWidth={defaultWidth}
      minWidth={minWidth}
      maxWidth={maxWidth}
      onResizeStop={onResizeStop}
      styles={{
        ...panelStyles,
        titleClassName: panelStyles?.titleClassName ?? 'dial-h3-text',
        headerClassName: mergeClasses(
          'border-b border-tertiary',
          panelStyles?.headerClassName,
        ),
        className: mergeClasses(
          isOpen ? 'mobile:w-full mobile:max-w-full' : 'w-0',
          className,
          panelStyles?.className,
        ),
      }}
      rightActions={
        showHtmlToggle ||
        showCopyText ||
        showCopyMarkdown ||
        showCopyJson ||
        showDownload ? (
          <>
            {showHtmlToggle && (
              <GhostIconButton
                icon={
                  isHtmlSourceView ? (
                    <IconEye
                      size={DIAL_ICON_SIZE.LG}
                      stroke={1.5}
                      aria-hidden
                    />
                  ) : (
                    <IconCode
                      size={DIAL_ICON_SIZE.LG}
                      stroke={1.5}
                      aria-hidden
                    />
                  )
                }
                aria-label={
                  isHtmlSourceView ? htmlViewRenderedLabel : htmlViewSourceLabel
                }
                aria-pressed={isHtmlSourceView}
                tooltipProps={{
                  tooltip: isHtmlSourceView
                    ? htmlViewRenderedLabel
                    : htmlViewSourceLabel,
                }}
                onClick={handleToggleHtmlView}
              />
            )}
            {showCopyText && (
              <GhostIconButton
                icon={
                  isCopiedText ? (
                    <IconCheck
                      size={DIAL_ICON_SIZE.LG}
                      stroke={1.5}
                      aria-hidden
                    />
                  ) : (
                    <IconCopy
                      size={DIAL_ICON_SIZE.LG}
                      stroke={1.5}
                      aria-hidden
                    />
                  )
                }
                aria-label={isCopiedText ? copiedTextLabel : copyTextLabel}
                tooltipProps={{
                  tooltip: isCopiedText ? copiedTextLabel : copyTextLabel,
                }}
                onClick={handleCopyText}
              />
            )}
            {showCopyMarkdown && (
              <GhostIconButton
                icon={
                  isCopiedMarkdown ? (
                    <IconCheck
                      size={DIAL_ICON_SIZE.LG}
                      stroke={1.5}
                      aria-hidden
                    />
                  ) : (
                    <IconMarkdown
                      size={DIAL_ICON_SIZE.LG}
                      stroke={1.5}
                      aria-hidden
                    />
                  )
                }
                aria-label={
                  isCopiedMarkdown ? copiedMarkdownLabel : copyMarkdownLabel
                }
                tooltipProps={{
                  tooltip: isCopiedMarkdown
                    ? copiedMarkdownLabel
                    : copyMarkdownLabel,
                }}
                onClick={handleCopyMarkdown}
              />
            )}
            {showCopyJson && (
              <GhostIconButton
                icon={
                  isCopiedJson ? (
                    <IconCheck
                      size={DIAL_ICON_SIZE.LG}
                      stroke={1.5}
                      aria-hidden
                    />
                  ) : (
                    <IconCopy
                      size={DIAL_ICON_SIZE.LG}
                      stroke={1.5}
                      aria-hidden
                    />
                  )
                }
                aria-label={isCopiedJson ? copiedJsonLabel : copyJsonLabel}
                tooltipProps={{
                  tooltip: isCopiedJson ? copiedJsonLabel : copyJsonLabel,
                }}
                onClick={handleCopyJson}
              />
            )}
            {showDownload && (
              <GhostIconButton
                icon={<IconDownload size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
                aria-label={downloadLabel}
                tooltipProps={{ tooltip: downloadLabel }}
                onClick={onDownload}
              />
            )}
          </>
        ) : null
      }
    >
      <AttachmentCanvasBody
        content={content}
        isLoading={isLoading}
        fileName={fileName}
        isHtmlSourceView={isHtmlSourceView}
        labels={{
          unsupportedLabel,
          loadErrorLabel,
          forbiddenErrorLabel,
          visualizerErrorLabel,
          htmlFrameBlockedLabel,
          htmlOpenInNewTabLabel,
        }}
        styles={bodyStylesProp}
        codeBlockTheme={codeBlockTheme}
        loadPdf={loadPdf}
      />
    </SidebarPanel>
  );
};

/** Sidebar canvas panel for previewing attachment content (text, image, audio, PDF, markdown, JSON). */
export const AttachmentCanvas = memo(AttachmentCanvasBase);
