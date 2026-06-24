import {
  buildCssVars,
  MarkdownRenderer,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { SidebarOrientation, SidebarPanel } from '@epam/ai-dial-sidebar';
import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconCheck, IconDownload, IconMarkdown } from '@tabler/icons-react';
import { type FC, memo, useCallback, useMemo, useRef, useState } from 'react';
import { defaultStyles, JsonView } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import type { AttachmentCanvasProps } from '../../models/attachment-canvas';
import { AttachmentContentType } from '../../types/attachment-canvas';
import { isDownloadable } from '../../utils/download';
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
  onCopyMarkdown,
  downloadLabel = 'Download',
  copyMarkdownLabel = 'Copy as Markdown',
  copiedMarkdownLabel = 'Copied!',
  unsupportedLabel = 'Preview is not supported for this file',
  isMobile = false,
  defaultWidth = 560,
  minWidth = 320,
  maxWidth = 960,
  onResizeStop,
  styles: stylesProp,
  className,
  codeBlockTheme,
}) => {
  const [isCopiedMarkdown, setIsCopiedMarkdown] = useState(false);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const {
    colors,
    typography,
    bodyClassName,
    cssVars: extraCssVars,
    panelStyles,
  } = stylesProp ?? {};

  const noCustomClass = !typography?.fontClassName;
  const cssVars = useMemo(
    () => ({
      ...buildCssVars({
        '--ac-text': colors?.text,
        '--ac-font-size': noCustomClass ? typography?.fontSize : undefined,
        '--ac-font-weight': noCustomClass
          ? typography?.fontWeight?.toString()
          : undefined,
        '--ac-line-height': noCustomClass
          ? typography?.lineHeight?.toString()
          : undefined,
        '--ac-letter-spacing': noCustomClass
          ? typography?.letterSpacing
          : undefined,
        '--ac-font-family': noCustomClass ? typography?.fontFamily : undefined,
      }),
      ...extraCssVars,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stylesProp],
  );

  const showCopyMarkdown =
    onCopyMarkdown != null && content.type === AttachmentContentType.Markdown;
  const showDownload =
    onDownload != null &&
    isDownloadable(content.type) &&
    content.type !== AttachmentContentType.Unsupported;

  const bodyContainerClassName = useMemo(() => {
    switch (content.type) {
      case AttachmentContentType.Image:
      case AttachmentContentType.Unsupported:
        return 'h-full overflow-auto p-4 flex items-center justify-center';
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
          />
        );
      case AttachmentContentType.Json:
        return (
          <div dir="ltr" className="h-full overflow-auto p-4">
            <JsonView
              data={content.value as object}
              style={{
                container: styles.jsonContainer,
                basicChildStyle: defaultStyles.basicChildStyle,
                childFieldsContainer: defaultStyles.childFieldsContainer,
                label: styles.jsonLabel,
                clickableLabel: styles.jsonClickableLabel,
                nullValue: styles.jsonNullValue,
                undefinedValue: styles.jsonNullValue,
                stringValue: styles.jsonStringValue,
                booleanValue: styles.jsonBooleanValue,
                numberValue: styles.jsonNumberValue,
                otherValue: styles.jsonNullValue,
                punctuation: styles.jsonPunctuation,
                collapseIcon: styles.jsonCollapseIcon,
                expandIcon: styles.jsonExpandIcon,
                collapsedContent: styles.jsonCollapsedContent,
              }}
            />
          </div>
        );
      case AttachmentContentType.Unsupported:
        return <p className="text-center text-secondary">{unsupportedLabel}</p>;
    }
  }, [
    content,
    typography?.fontClassName,
    fileName,
    codeBlockTheme,
    unsupportedLabel,
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
        showCopyMarkdown || showDownload ? (
          <>
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
                onClick={handleCopyMarkdown}
              />
            )}
            {showDownload && (
              <DialGhostIconButton
                icon={<IconDownload size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
                aria-label={downloadLabel}
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
