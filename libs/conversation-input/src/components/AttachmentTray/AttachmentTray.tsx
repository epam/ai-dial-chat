import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC } from 'react';
import type { AttachmentTrayProps } from '../../models/AttachmentTray';
import { AttachmentCard } from '../AttachmentCard/AttachmentCard';

export const AttachmentTray: FC<AttachmentTrayProps> = ({
  attachments,
  onRemove,
  onRetry,
  onExpand,
  ariaLabel = 'Attached files',
  removeLabel,
  retryLabel,
  className,
}) => {
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
            removeLabel={removeLabel}
            retryLabel={retryLabel}
          />
        </div>
      ))}
    </div>
  );
};
