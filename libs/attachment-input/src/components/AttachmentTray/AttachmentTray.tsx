import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC } from 'react';
import { ATTACHMENT_INPUT_CLASS } from '../../constants/public-class-names';
import type { AttachmentTrayProps } from '../../models/attachment-tray';
import { AttachmentCard } from '../AttachmentCard/AttachmentCard';

/** Horizontal scrollable row of attachment cards for the message composer, with remove/retry/expand actions. */
export const AttachmentTray: FC<AttachmentTrayProps> = ({
  attachments,
  onRemove,
  onRetry,
  onExpand,
  onAttachmentClick,
  labels,
  styles,
}) => {
  const {
    ariaLabel = 'Attached files',
    removeLabel,
    retryLabel,
    clickLabel,
    uploadingLabel,
  } = labels ?? {};
  const { className } = styles ?? {};

  if (attachments.length === 0) return null;

  return (
    <div
      role="list"
      aria-label={ariaLabel}
      className={mergeClasses(
        'flex w-full min-w-0 gap-2 overflow-x-auto',
        className,
        ATTACHMENT_INPUT_CLASS.tray,
      )}
    >
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          role="listitem"
          className={ATTACHMENT_INPUT_CLASS.trayItem}
        >
          <AttachmentCard
            attachment={attachment}
            onRemove={onRemove}
            onRetry={onRetry}
            onExpand={onExpand}
            labels={{ removeLabel, retryLabel, clickLabel, uploadingLabel }}
            onClick={onAttachmentClick}
          />
        </div>
      ))}
    </div>
  );
};
