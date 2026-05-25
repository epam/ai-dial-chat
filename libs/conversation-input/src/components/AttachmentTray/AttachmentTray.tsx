import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC } from 'react';
import type { AttachmentTrayProps } from '../../models/AttachmentTray.js';
import { AttachmentCard } from '../AttachmentCard/AttachmentCard.js';

export const AttachmentTray: FC<AttachmentTrayProps> = ({
  attachments,
  onRemove,
  onRetry,
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
      className={mergeClasses('flex w-full gap-2 overflow-x-auto', className)}
    >
      {attachments.map((attachment) => (
        <div key={attachment.id} role="listitem">
          <AttachmentCard
            attachment={attachment}
            onRemove={onRemove}
            onRetry={onRetry}
            removeLabel={removeLabel}
            retryLabel={retryLabel}
          />
        </div>
      ))}
    </div>
  );
};
