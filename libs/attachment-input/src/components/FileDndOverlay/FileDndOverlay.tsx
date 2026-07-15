import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { IconFileDescription, IconFileX } from '@tabler/icons-react';
import type { DragEvent, FC } from 'react';
import type { FileDndOverlayProps } from '../../models/file-dnd-overlay';

/** Full-screen drag-and-drop overlay shown while files are dragged over the app, allowed or denied. */
export const FileDndOverlay: FC<FileDndOverlayProps> = ({
  isVisible,
  isAttachmentsAllowed = true,
  title,
  subtitle,
  styles,
}) => {
  const {
    iconClassName = 'text-accent-primary',
    deniedIconClassName = 'text-error',
    titleClassName = 'heading-3 font-semibold',
    subtitleClassName = 'dial-small-text',
  } = styles ?? {};

  if (!isVisible) return null;

  const resolvedTitle =
    title ?? (isAttachmentsAllowed ? 'Attach files' : 'No attachments allowed');
  const resolvedSubtitle =
    subtitle ??
    (isAttachmentsAllowed
      ? 'Drop files here to attach them to message'
      : "Attachments can't be added to message");
  const resolvedIconClassName = isAttachmentsAllowed
    ? iconClassName
    : deniedIconClassName;

  const suppressDrop = (e: DragEvent) => {
    e.preventDefault();
  };

  const Icon = isAttachmentsAllowed ? IconFileDescription : IconFileX;

  return (
    <div
      className={mergeClasses(
        'fixed inset-0 z-[9999] flex items-center justify-center bg-blackout backdrop-blur-sm',
        isAttachmentsAllowed
          ? 'pointer-events-none'
          : 'pointer-events-auto cursor-not-allowed',
      )}
      onDragOver={isAttachmentsAllowed ? undefined : suppressDrop}
      onDrop={isAttachmentsAllowed ? undefined : suppressDrop}
    >
      <div className="flex flex-col items-center text-center">
        <Icon size={100} className={resolvedIconClassName} />
        <span className={mergeClasses('mt-5', titleClassName)}>
          {resolvedTitle}
        </span>
        <span className={mergeClasses('mt-4', subtitleClassName)}>
          {resolvedSubtitle}
        </span>
      </div>
    </div>
  );
};
