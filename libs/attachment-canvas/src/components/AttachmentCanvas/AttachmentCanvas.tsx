import {
  buildCssVars,
  DEFAULT_MARKDOWN_CLASS_NAMES,
  MarkdownRenderer,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { SidebarOrientation, SidebarPanel } from '@epam/ai-dial-sidebar';
import {
  DIAL_ICON_SIZE,
  DialSpinner,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import {
  IconAlertTriangle,
  IconCheck,
  IconCode,
  IconCopy,
  IconDownload,
  IconEye,
  IconLock,
  IconMarkdown,
} from '@tabler/icons-react';
import {
  type CSSProperties,
  type FC,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { defaultStyles, JsonView } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import type { AttachmentCanvasProps } from '../../models/attachment-canvas';
import {
  AttachmentContentType,
  AttachmentErrorType,
} from '../../types/attachment-canvas';
import { isDownloadable } from '../../utils/download';
import { CodeContent } from '../CodeContent/CodeContent';
import { HtmlContent } from '../HtmlContent/HtmlContent';
import { PdfContent } from '../PdfContent/PdfContent';
import { VisualizerCanvasRenderer } from '../VisualizerCanvasRenderer/VisualizerCanvasRenderer';
import styles from './AttachmentCanvas.module.scss';

const COPY_RESET_MS = 2000;

interface ImageContentProps {
  url: string;
  fileName?: string;
  loadErrorLabel: string;
}

/* Renders an image with inline error handling so the canvas avoids a fetch. */
const ImageContent: FC<ImageContentProps> = ({
  url,
  fileName,
  loadErrorLabel,
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [url]);

  if (hasError) {
    return (
      <div className="flex flex-col items-center gap-2">
        <IconAlertTriangle
          size={60}
          stroke={1.5}
          className={styles.errorIcon}
        />
        <p className={mergeClasses('text-center', styles.statusLabel)}>
          {loadErrorLabel}
        </p>
      </div>
    );
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <img
      src={url}
      alt={fileName ?? ''}
      className="max-h-full max-w-full object-contain"
      onError={() => setHasError(true)}
    />
  );
};

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

  const {
    colors,
    typography,
    bodyClassName,
    className,
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

  /*
   * The individual typography fields collapse into one inline style. A
   * `fontClassName` suppresses them entirely, as documented on
   * `AttachmentCanvasTypography`.
   */
  const typographyStyle = useMemo<CSSProperties | undefined>(() => {
    if (typography?.fontClassName != null) {
      return undefined;
    }
    const { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing } =
      typography ?? {};
    const style: CSSProperties = {
      ...(fontFamily != null && { fontFamily }),
      ...(fontSize != null && { fontSize }),
      ...(fontWeight != null && { fontWeight }),
      ...(lineHeight != null && { lineHeight }),
      ...(letterSpacing != null && { letterSpacing }),
    };
    return Object.keys(style).length > 0 ? style : undefined;
  }, [typography]);

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

  const bodyContainerClassName = useMemo(() => {
    switch (content.type) {
      case AttachmentContentType.Image:
      case AttachmentContentType.Audio:
      case AttachmentContentType.Unsupported:
      case AttachmentContentType.Error:
        return 'h-full overflow-auto p-4 flex items-center justify-center';
      case AttachmentContentType.Json:
        return 'h-full overflow-auto';
      case AttachmentContentType.Pdf:
      case AttachmentContentType.Visualizer:
      case AttachmentContentType.Code:
      case AttachmentContentType.Html:
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
            style={typographyStyle}
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
          <ImageContent
            url={content.url}
            fileName={fileName}
            loadErrorLabel={loadErrorLabel}
          />
        );
      case AttachmentContentType.Audio:
        return (
          <audio
            controls
            src={content.url}
            aria-label={fileName ?? 'Audio attachment'}
            className="w-full max-w-sm"
            preload="metadata"
          >
            {content.mimeType && (
              <source src={content.url} type={content.mimeType} />
            )}
          </audio>
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
      case AttachmentContentType.Code:
        return (
          <CodeContent content={content} codeBlockTheme={codeBlockTheme} />
        );
      case AttachmentContentType.Html:
        return (
          <HtmlContent
            content={content}
            labels={{
              htmlFrameBlockedLabel,
              htmlOpenInNewTabLabel,
            }}
            isSourceView={isHtmlSourceView}
            title={fileName}
            codeBlockTheme={codeBlockTheme}
          />
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
      case AttachmentContentType.Visualizer:
        return (
          <VisualizerCanvasRenderer
            content={content}
            errorLabel={visualizerErrorLabel}
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
    typographyStyle,
    fileName,
    codeBlockTheme,
    unsupportedLabel,
    loadErrorLabel,
    forbiddenErrorLabel,
    visualizerErrorLabel,
    htmlFrameBlockedLabel,
    htmlOpenInNewTabLabel,
    isHtmlSourceView,
    loadPdf,
  ]);

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
      <div
        style={
          !isLoading &&
          (content.type === AttachmentContentType.PlainText ||
            content.type === AttachmentContentType.Code)
            ? cssVars
            : undefined
        }
        className={mergeClasses(
          isLoading
            ? 'flex h-full items-center justify-center'
            : bodyContainerClassName,
          bodyClassName,
        )}
      >
        {isLoading ? <DialSpinner /> : renderedContent}
      </div>
    </SidebarPanel>
  );
};

/** Sidebar canvas panel for previewing attachment content (text, image, audio, PDF, markdown, JSON). */
export const AttachmentCanvas = memo(AttachmentCanvasBase);
