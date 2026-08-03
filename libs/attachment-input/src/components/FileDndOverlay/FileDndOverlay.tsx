import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
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

  if (!isVisible) return null;

  const cssVars = buildCssVars({
    '--ai-fd-bg': colors?.background,
    '--ai-fd-icon': colors?.icon,
    '--ai-fd-denied-icon': colors?.deniedIcon,
  });

  const resolvedTitle =
    title ?? (isAttachmentsAllowed ? 'Attach files' : 'No attachments allowed');
  const resolvedSubtitle =
    subtitle ??
    (isAttachmentsAllowed
      ? 'Drop files here to attach them to message'
      : "Attachments can't be added to message");
  const resolvedIconClassName = isAttachmentsAllowed
    ? styles.icon
    : styles.deniedIcon;

  const suppressDrop = (e: DragEvent) => {
    e.preventDefault();
  };

  const Icon = isAttachmentsAllowed ? IconFileDescription : IconFileX;

  return (
    <div
      role="status"
      aria-live="polite"
      className={mergeClasses(
        'fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm',
        styles.overlay,
        isAttachmentsAllowed
          ? 'pointer-events-none'
          : 'pointer-events-auto cursor-not-allowed',
      )}
      onDragOver={isAttachmentsAllowed ? undefined : suppressDrop}
      onDrop={isAttachmentsAllowed ? undefined : suppressDrop}
      style={cssVars}
    >
      <div className="flex flex-col items-center text-center">
        <Icon size={100} className={resolvedIconClassName} aria-hidden />
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
  );
};
