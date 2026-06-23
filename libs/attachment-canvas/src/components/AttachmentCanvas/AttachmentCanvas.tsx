import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { SidebarOrientation, SidebarPanel } from '@epam/ai-dial-sidebar';
import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconDownload } from '@tabler/icons-react';
import { type FC } from 'react';
import {
  AttachmentContentType,
  type AttachmentCanvasProps,
} from '../../models/attachment-canvas';
import styles from './AttachmentCanvas.module.scss';

export const AttachmentCanvas: FC<AttachmentCanvasProps> = ({
  isOpen,
  onClose,
  content,
  fileName,
  ariaLabel,
  closeLabel = 'Close',
  onDownload,
  downloadLabel = 'Download',
  unsupportedLabel = 'Preview is not supported for this file',
  isMobile = false,
  defaultWidth = 560,
  minWidth = 320,
  maxWidth = 960,
  onResizeStop,
  styles: stylesProp,
  className,
}) => {
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
        onDownload != null &&
        content.type !== AttachmentContentType.Unsupported ? (
          <DialGhostIconButton
            icon={<IconDownload size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
            aria-label={downloadLabel}
            onClick={onDownload}
          />
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
        {content.type === AttachmentContentType.Unsupported && (
          <p className="text-center text-secondary">{unsupportedLabel}</p>
        )}
      </div>
    </SidebarPanel>
  );
};
