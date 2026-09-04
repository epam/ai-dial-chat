import {
  buildCssVars,
  DEFAULT_MARKDOWN_CLASS_NAMES,
  MarkdownRenderer,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { DIAL_KIT_ICON_STROKE, Spinner } from '@epam/ai-dial-ui-kit';
import { IconAlertTriangle, IconLock } from '@tabler/icons-react';
import {
  type FC,
  lazy,
  memo,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { defaultStyles, JsonView } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import type { AttachmentCanvasBodyProps } from '../../models/attachment-canvas';
import {
  AttachmentContentType,
  AttachmentErrorType,
} from '../../types/attachment-canvas';
import { CodeContent } from '../CodeContent/CodeContent';
import { HtmlContent } from '../HtmlContent/HtmlContent';
import { McpAppCanvasRenderer } from '../McpAppCanvasRenderer/McpAppCanvasRenderer';
import { OoxmlContent } from '../OoxmlContent/OoxmlContent';
import { VisualizerCanvasRenderer } from '../VisualizerCanvasRenderer/VisualizerCanvasRenderer';
import styles from './AttachmentCanvasBody.module.scss';

/*
 * `PdfContent` pulls in `@epam/ai-dial-react-pdf-highlighter` ->
 * `@epam/pdf-highlighter-kit` -> `pdfjs-dist`, a multi-hundred-KB dependency
 * chain. Loading it through a dynamic import keeps that chain out of the
 * initial bundle — it's only fetched the first time an attachment actually
 * resolves to the PDF content type.
 */
const PdfContent = lazy(async () => {
  const module = await import('../PdfContent/PdfContent');
  return { default: module.PdfContent };
});

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
          stroke={DIAL_KIT_ICON_STROKE}
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

/* Content types whose renderers read the `--ac-*` custom properties, so the
 * body root has to carry them. `buildCssVars` drops unset fields, so adding a
 * type here is safe; the remaining types still leave their `*Colors` fields
 * inert (see the JSON and status/error vars). */
const THEMED_CONTENT_TYPES = new Set<AttachmentContentType>([
  AttachmentContentType.PlainText,
  AttachmentContentType.Code,
  AttachmentContentType.Ooxml,
]);

const AttachmentCanvasBodyBase: FC<AttachmentCanvasBodyProps> = ({
  content,
  isLoading = false,
  fileName,
  isHtmlSourceView = false,
  labels: {
    unsupportedLabel = 'Preview is not supported for this file',
    loadErrorLabel = 'Failed to load file',
    forbiddenErrorLabel = "You don't have permission to access this file",
    visualizerErrorLabel,
    htmlFrameBlockedLabel = 'This page cannot be displayed in preview',
    htmlOpenInNewTabLabel = 'Open in new tab',
    pdfThumbnailsLabel,
    pdfShowThumbnailsLabel,
    pdfHideThumbnailsLabel,
    pdfPageNumberLabel,
  } = {},
  styles: stylesProp,
  codeBlockTheme,
  loadPdf,
  hidePdfToolbar = false,
  configurePdfWorker,
}) => {
  const {
    colors,
    typography,
    bodyClassName,
    cssVars: extraCssVars,
  } = stylesProp ?? {};

  /* A `fontClassName` replaces the individual typography fields, so their vars
   * are skipped entirely when one is supplied. */
  const hasFontClassName = typography?.fontClassName != null;

  const cssVars = useMemo(
    () => ({
      ...buildCssVars({
        '--ac-text': colors?.text,
        '--ac-status-text': colors?.statusText,
        '--ac-error-icon': colors?.errorIcon,
        '--ac-open-in-new-tab-text': colors?.openInNewTabText,
        '--ac-json-border': colors?.jsonBorder,
        '--ac-json-bg': colors?.jsonBackground,
        '--ac-json-label': colors?.jsonLabel,
        '--ac-json-clickable-label': colors?.jsonClickableLabel,
        '--ac-json-punctuation': colors?.jsonPunctuation,
        '--ac-json-string': colors?.jsonString,
        '--ac-json-number': colors?.jsonNumber,
        '--ac-json-boolean': colors?.jsonBoolean,
        '--ac-json-null': colors?.jsonNull,
        '--ac-json-toggle-icon': colors?.jsonToggleIcon,
        '--ac-json-toggle-icon-hover': colors?.jsonToggleIconHover,
        '--ac-ooxml-bg': colors?.ooxmlBackground,
        '--ac-json-collapsed-text': colors?.jsonCollapsedText,
        '--ac-json-collapsed-bg': colors?.jsonCollapsedBackground,
        '--ac-font-family': hasFontClassName
          ? undefined
          : typography?.fontFamily,
        '--ac-font-size': hasFontClassName ? undefined : typography?.fontSize,
        '--ac-font-weight': hasFontClassName
          ? undefined
          : typography?.fontWeight,
        '--ac-line-height': hasFontClassName
          ? undefined
          : typography?.lineHeight,
        '--ac-letter-spacing': hasFontClassName
          ? undefined
          : typography?.letterSpacing,
      }),
      ...extraCssVars,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stylesProp],
  );

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
      case AttachmentContentType.Ooxml:
      case AttachmentContentType.Visualizer:
      case AttachmentContentType.McpApp:
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
                    typography?.jsonClassName ?? 'dial-code-text',
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
          <Suspense fallback={<Spinner />}>
            <PdfContent
              key={content.url}
              fileName={fileName}
              url={content.url}
              highlights={content.highlights ?? []}
              selectedHighlightId={content.selectedHighlightId}
              loadPdf={loadPdf}
              hideHeader={hidePdfToolbar}
              configurePdfWorker={configurePdfWorker}
              labels={{
                thumbnailsLabel: pdfThumbnailsLabel,
                showThumbnailsLabel: pdfShowThumbnailsLabel,
                hideThumbnailsLabel: pdfHideThumbnailsLabel,
                pageNumberLabel: pdfPageNumberLabel,
              }}
            />
          </Suspense>
        );
      case AttachmentContentType.Ooxml:
        return (
          <OoxmlContent
            content={content}
            fileName={fileName}
            loadErrorLabel={loadErrorLabel}
          />
        );
      case AttachmentContentType.Visualizer:
        return (
          <VisualizerCanvasRenderer
            content={content}
            errorLabel={visualizerErrorLabel}
          />
        );
      case AttachmentContentType.McpApp:
        return <McpAppCanvasRenderer content={content} />;
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
              <IconLock
                size={60}
                stroke={DIAL_KIT_ICON_STROKE}
                className={styles.errorIcon}
              />
            ) : (
              <IconAlertTriangle
                size={60}
                stroke={DIAL_KIT_ICON_STROKE}
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
    typography?.jsonClassName,
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
    hidePdfToolbar,
    configurePdfWorker,
    pdfThumbnailsLabel,
    pdfShowThumbnailsLabel,
    pdfHideThumbnailsLabel,
    pdfPageNumberLabel,
  ]);

  return (
    <div
      style={
        !isLoading && THEMED_CONTENT_TYPES.has(content.type)
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
      {isLoading ? <Spinner /> : renderedContent}
    </div>
  );
};

/** Content-only renderer for attachment previews (text, image, audio, PDF, markdown, JSON, code, HTML, visualizer). Shared by the sidebar `AttachmentCanvas` and any host that mounts the preview inline elsewhere. */
export const AttachmentCanvasBody = memo(AttachmentCanvasBodyBase);
