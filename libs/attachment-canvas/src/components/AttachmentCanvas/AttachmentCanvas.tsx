import {
  buildCssVars,
  MarkdownRenderer,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { SidebarOrientation, SidebarPanel } from '@epam/ai-dial-sidebar';
import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconCheck, IconDownload, IconMarkdown } from '@tabler/icons-react';
import { type FC, useCallback, useRef, useState } from 'react';
import { JsonView, defaultStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import type { AttachmentCanvasProps } from '../../models/attachment-canvas';
import { AttachmentContentType } from '../../types/attachment-canvas';
import styles from './AttachmentCanvas.module.scss';

const COPY_RESET_MS = 2000;

export const AttachmentCanvas: FC<AttachmentCanvasProps> = ({
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
  const cssVars = {
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
  };

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
        (onDownload != null &&
          content.type !== AttachmentContentType.Unsupported) ||
        (onCopyMarkdown != null &&
          content.type === AttachmentContentType.Markdown) ? (
          <>
            {onCopyMarkdown != null &&
              content.type === AttachmentContentType.Markdown && (
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
            {onDownload != null && (
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
        className={mergeClasses(
          'h-full overflow-auto p-4',
          content.type === AttachmentContentType.Image &&
            'flex items-center justify-center',
          content.type === AttachmentContentType.Unsupported &&
            'flex items-center justify-center',
          bodyClassName,
        )}
      >
        {content.type === AttachmentContentType.PlainText && (
          <pre
            className={mergeClasses(
              'whitespace-pre-wrap break-words',
              styles.body,
              typography?.fontClassName,
            )}
          >
            {content.text}
          </pre>
        )}
        {content.type === AttachmentContentType.Image && (
          <img
            src={content.url}
            alt={fileName ?? ''}
            className="max-h-full max-w-full object-contain"
          />
        )}
        {content.type === AttachmentContentType.Markdown && (
          <MarkdownRenderer
            content={content.text}
            isStreaming={false}
            codeBlockTheme={codeBlockTheme}
          />
        )}
        {content.type === AttachmentContentType.Json && (
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
        )}
        {content.type === AttachmentContentType.Unsupported && (
          <p className="text-center text-secondary">{unsupportedLabel}</p>
        )}
      </div>
    </SidebarPanel>
  );
};
