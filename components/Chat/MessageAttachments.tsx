import { Attachment } from '@/types/chat';

import { MessageAttachment } from './MessageAttachment';

interface Props {
  attachments: Attachment[];
}

export const MessageAttachments = ({ attachments }: Props) => {
  return (
    <div className="grid max-w-full grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3">
      {attachments?.map((attachment) => (
        <MessageAttachment key={attachment.index} attachment={attachment} />
      ))}
    </div>
  );
};
