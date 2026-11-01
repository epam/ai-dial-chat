import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { LiveRegion, LiveRegionElement } from '@epam/ai-dial-ui-kit';
import { IconFileDescription, IconFileX } from '@tabler/icons-react';
import type { DragEvent, FC } from 'react';
import type { FileDndOverlayProps } from '../../models/file-dnd-overlay';
import styles from './FileDndOverlay.module.scss';

/** Full-screen drag-and-drop overlay shown while files are dragged over the app, allowed or denied. */
export const FileDndOverlay: FC<FileDndOverlayProps> = ({
  isVisible,
  isAttachmentsAllowed = true,
  labels,
  styles: overlayStyles,
}) => {
  const { title, subtitle } = labels ?? {};
  const { colors, typography } = overlayStyles ?? {};

  const resolvedTitle =
    title ?? (isAttachmentsAllowed ? 'Attach files' : 'No attachments allowed');
  const resolvedSubtitle =
    subtitle ??
    (isAttachmentsAllowed
      ? 'Drop files here to attach them to message'
      : "Attachments can't be added to message");

  /* The status region stays mounted while the overlay is hidden, so its text
     change is announced reliably when a drag starts. */
  const statusRegion = (
    <LiveRegion visuallyHidden as={LiveRegionElement.Span}>
      {isVisible ? `${resolvedTitle}. ${resolvedSubtitle}` : ''}
    </LiveRegion>
  );

  if (!isVisible) return statusRegion;

  const cssVars = buildCssVars({
    '--ai-fd-bg': colors?.background,
    '--ai-fd-icon': colors?.icon,
    '--ai-fd-denied-icon': colors?.deniedIcon,
  });

  const resolvedIconClassName = isAttachmentsAllowed
    ? styles.icon
    : styles.deniedIcon;

  const suppressDrop = (e: DragEvent) => {
    e.preventDefault();
  };

  const Icon = isAttachmentsAllowed ? IconFileDescription : IconFileX;

  return (
    <>
      {statusRegion}
      <div
        className={mergeClasses(
          'fixed inset-0 z-9999 flex items-center justify-center backdrop-blur-sm',
          styles.overlay,
          isAttachmentsAllowed
            ? 'pointer-events-none'
            : 'pointer-events-auto cursor-not-allowed',
        )}
        onDragOver={isAttachmentsAllowed ? undefined : suppressDrop}
        onDrop={isAttachmentsAllowed ? undefined : suppressDrop}
        style={cssVars}
      >
        {/* The status region above already speaks this text. */}
        <div aria-hidden className="flex flex-col items-center text-center">
          {/* A 100px illustration, so it takes the empty-state stroke of 1. */}
          <Icon
            size={100}
            stroke={1}
            className={resolvedIconClassName}
            aria-hidden
          />
          <span
            className={mergeClasses(
              'mt-5',
              typography?.titleClassName ?? 'dial-h3-text',
            )}
          >
            {resolvedTitle}
          </span>
          <span
            className={mergeClasses(
              'mt-4',
              typography?.subtitleClassName ?? 'dial-small-text',
            )}
          >
            {resolvedSubtitle}
          </span>
        </div>
      </div>
    </>
  );
};
