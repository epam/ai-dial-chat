import {
  buildCssVars,
  DEFAULT_MARKDOWN_CLASS_NAMES,
  MarkdownRenderer,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { SidebarOrientation, SidebarPanel } from '@epam/ai-dial-sidebar';
import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconDownload,
  IconLock,
  IconMarkdown,
} from '@tabler/icons-react';
import { type FC, memo, useCallback, useMemo, useRef, useState } from 'react';
import { defaultStyles, JsonView } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import type { AttachmentCanvasProps } from '../../models/attachment-canvas';
import {
  AttachmentContentType,
  AttachmentErrorType,
} from '../../types/attachment-canvas';
import { isDownloadable } from '../../utils/download';
import { PdfContent } from '../PdfContent/PdfContent';
import styles from './AttachmentCanvas.module.scss';

const COPY_RESET_MS = 2000;

const AttachmentCanvasBase: FC<AttachmentCanvasProps> = ({
  isOpen,
  onClose,
  content,
  fileName,
  ariaLabel,
  closeLabel = 'Close',
  onDownload,
  onCopyText,
  onCopyMarkdown,
  onCopyJson,
  downloadLabel = 'Download',
  copyTextLabel = 'Copy text',
  copiedTextLabel = 'Copied!',
  copyMarkdownLabel = 'Copy as Markdown',
  copiedMarkdownLabel = 'Copied!',
  copyJsonLabel = 'Copy as JSON',
  copiedJsonLabel = 'Copied!',
  unsupportedLabel = 'Preview is not supported for this file',
  loadErrorLabel = 'Failed to load file',
  forbiddenErrorLabel = "You don't have permission to access this file",
  isMobile = false,
  defaultWidth,
  minWidth = 320,
  maxWidth = 1500,
  onResizeStop,
  styles: stylesProp,
  className,
  codeBlockTheme,
  loadPdf,
}) => {
  const [isCopiedText, setIsCopiedText] = useState(false);
  const [isCopiedMarkdown, setIsCopiedMarkdown] = useState(false);
  const [isCopiedJson, setIsCopiedJson] = useState(false);
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
  const {
    colors,
    typography,
    bodyClassName,
    cssVars: extraCssVars,
    panelStyles,
  } = stylesProp ?? {};

  const cssVars = useMemo(
    () => ({
      ...buildCssVars({
        '--ac-text': colors?.text,
      }),
      ...extraCssVars,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stylesProp],
  );

  const showCopyText =
    onCopyText != null && content.type === AttachmentContentType.PlainText;
  const showCopyMarkdown =
    onCopyMarkdown != null && content.type === AttachmentContentType.Markdown;
  const showCopyJson =
    onCopyJson != null && content.type === AttachmentContentType.Json;
  const showDownload = onDownload != null && isDownloadable(content);

  const bodyContainerClassName = useMemo(() => {
    switch (content.type) {
      case AttachmentContentType.Image:
      case AttachmentContentType.Unsupported:
      case AttachmentContentType.Error:
        return 'h-full overflow-auto p-4 flex items-center justify-center';
      case AttachmentContentType.Json:
        return 'h-full overflow-auto';
      case AttachmentContentType.Pdf:
        return 'h-full overflow-hidden';
      default:
        return 'h-full overflow-auto p-4';
    }
  }, [content.type]);

  const renderedContent = useMemo(() => {
    switch (content.type) {
      case AttachmentContentType.PlainText:
        return (
          <pre
            className={mergeClasses(
              'whitespace-pre-wrap break-words',
              styles.body,
              typography?.fontClassName,
            )}
          >
            {content.text}
          </pre>
        );
      case AttachmentContentType.Image:
        return (
          <img
            src={content.url}
            alt={fileName ?? ''}
            className="max-h-full max-w-full object-contain"
          />
        );
      case AttachmentContentType.Markdown:
        return (
          <MarkdownRenderer
            content={content.text}
            isStreaming={false}
            codeBlockTheme={codeBlockTheme}
            classNames={DEFAULT_MARKDOWN_CLASS_NAMES}
          />
        );
      case AttachmentContentType.Json:
        return (
          <div dir="ltr" className="h-full overflow-auto">
            <div
              className={mergeClasses(
                'm-3 overflow-auto rounded-md border',
                styles.jsonWrapper,
              )}
            >
              <JsonView
                data={content.value as object}
                style={{
                  container: mergeClasses(
                    'whitespace-pre-wrap break-words p-2',
                    styles.jsonContainer,
                  ),
                  basicChildStyle: defaultStyles.basicChildStyle,
                  childFieldsContainer: 'm-0 ps-3',
                  label: mergeClasses('me-1 font-semibold', styles.jsonLabel),
                  clickableLabel: mergeClasses(
                    'me-1 cursor-pointer font-semibold hover:underline',
                    styles.jsonClickableLabel,
                  ),
                  nullValue: mergeClasses('italic', styles.jsonNullValue),
                  undefinedValue: mergeClasses('italic', styles.jsonNullValue),
                  stringValue: styles.jsonStringValue,
                  booleanValue: styles.jsonBooleanValue,
                  numberValue: styles.jsonNumberValue,
                  otherValue: mergeClasses('italic', styles.jsonNullValue),
                  punctuation: mergeClasses('me-1', styles.jsonPunctuation),
                  collapseIcon: mergeClasses(
                    'me-1 cursor-pointer select-none transition-colors',
                    styles.jsonCollapseIcon,
                  ),
                  expandIcon: mergeClasses(
                    'me-1 cursor-pointer select-none transition-colors',
                    styles.jsonExpandIcon,
                  ),
                  collapsedContent: mergeClasses(
                    'me-1 cursor-pointer rounded px-1',
                    styles.jsonCollapsedContent,
                  ),
                }}
              />
            </div>
          </div>
        );
      case AttachmentContentType.Pdf:
        return (
          <PdfContent
            key={content.url}
            fileName={fileName}
            url={content.url}
            highlights={content.highlights ?? []}
            selectedHighlightId={content.selectedHighlightId}
            loadPdf={loadPdf}
          />
        );
      case AttachmentContentType.Unsupported:
        return (
          <p className={mergeClasses('text-center', styles.statusLabel)}>
            {unsupportedLabel}
          </p>
        );
      case AttachmentContentType.Error: {
        const isForbidden = content.errorType === AttachmentErrorType.Forbidden;
        return (
          <div className="flex flex-col items-center gap-2">
            {isForbidden ? (
              <IconLock size={60} stroke={1.5} className={styles.errorIcon} />
            ) : (
              <IconAlertTriangle
                size={60}
                stroke={1.5}
                className={styles.errorIcon}
              />
            )}
            <p className={mergeClasses('text-center', styles.statusLabel)}>
              {isForbidden ? forbiddenErrorLabel : loadErrorLabel}
            </p>
          </div>
        );
      }
    }
  }, [
    content,
    typography?.fontClassName,
    fileName,
    codeBlockTheme,
    unsupportedLabel,
    loadErrorLabel,
    forbiddenErrorLabel,
    loadPdf,
  ]);

  return (
    <SidebarPanel
      isOpen={isOpen}
      orientation={SidebarOrientation.Right}
      title={fileName}
      ariaLabel={ariaLabel}
      closeLabel={closeLabel}
      onClose={onClose}
      resizable={!isMobile}
      defaultWidth={defaultWidth}
      minWidth={minWidth}
      maxWidth={maxWidth}
      onResizeStop={onResizeStop}
      className={mergeClasses(isOpen ? 'mobile:w-full' : 'w-0', className)}
      styles={panelStyles}
      rightActions={
        showCopyText || showCopyMarkdown || showCopyJson || showDownload ? (
          <>
            {showCopyText && (
              <DialGhostIconButton
                icon={
                  isCopiedText ? (
                    <IconCheck size={DIAL_ICON_SIZE.LG} stroke={1.5} />
                  ) : (
                    <IconCopy size={DIAL_ICON_SIZE.LG} stroke={1.5} />
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
              <DialGhostIconButton
                icon={
                  isCopiedMarkdown ? (
                    <IconCheck size={DIAL_ICON_SIZE.LG} stroke={1.5} />
                  ) : (
                    <IconMarkdown size={DIAL_ICON_SIZE.LG} stroke={1.5} />
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
              <DialGhostIconButton
                icon={
                  isCopiedJson ? (
                    <IconCheck size={DIAL_ICON_SIZE.LG} stroke={1.5} />
                  ) : (
                    <IconCopy size={DIAL_ICON_SIZE.LG} stroke={1.5} />
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
              <DialGhostIconButton
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
      <div
        style={
          content.type === AttachmentContentType.PlainText ? cssVars : undefined
        }
        className={mergeClasses(bodyContainerClassName, bodyClassName)}
      >
        {renderedContent}
      </div>
    </SidebarPanel>
  );
};

export const AttachmentCanvas = memo(AttachmentCanvasBase);
