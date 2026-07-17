import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC } from 'react';
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
      )}
    >
      {attachments.map((attachment) => (
        <div key={attachment.id} role="listitem">
          <AttachmentCard
            attachment={attachment}
            onRemove={onRemove}
            onRetry={onRetry}
            onExpand={onExpand}
            labels={{ removeLabel, retryLabel, clickLabel }}
            onClick={
              onAttachmentClick
                ? () => onAttachmentClick(attachment)
                : undefined
            }
          />
        </div>
      ))}
    </div>
  );
};
