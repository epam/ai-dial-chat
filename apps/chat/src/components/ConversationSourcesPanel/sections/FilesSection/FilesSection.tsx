import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { AttachmentCard } from '@epam/ai-dial-conversation-input';
import { memo, type FC } from 'react';

interface Props {
  attachments: DisplayAttachment[];
  title: string;
  emptyMessage: string;
}

const FilesSection: FC<Props> = ({ attachments, title, emptyMessage }) => (
  <section className="mb-6">
    <h2 className="dial-body-semi-text mb-3">{title}</h2>
    {attachments.length === 0 ? (
      <p className="dial-small-text text-secondary">{emptyMessage}</p>
    ) : (
      <div role="list" className="grid grid-cols-3 gap-3">
        {attachments.map((att) => (
          <div key={att.id} role="listitem">
            <AttachmentCard attachment={att} className="w-full" />
          </div>
        ))}
      </div>
    )}
  </section>
);

export default memo(FilesSection);
