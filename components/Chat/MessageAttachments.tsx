import { Attachment } from '@/types/chat';

import { MessageAttachment } from './MessageAttachment';

interface Props {
  attachments: Attachment[];
}

export const MessageAttachments = ({ attachments }: Props) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 max-w-full gap-1">
      {attachments?.map((attachment) => (
        <MessageAttachment key={attachment.index} attachment={attachment} />
      ))}
    </div>
  );
};
