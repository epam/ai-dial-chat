import {
  getDialFilesFromAttachments,
  getDialFoldersFromAttachments,
  getDialLinksFromAttachments,
} from '@/src/utils/app/file';

import { ChatInputAttachments } from '../ChatInput/ChatInputAttachments';

import { Attachment } from '@epam/ai-dial-shared';

interface PlaybackAttachmentsProps {
  attachments: Attachment[];
}

export function PlaybackAttachments({ attachments }: PlaybackAttachmentsProps) {
  const files = getDialFilesFromAttachments(attachments);
  const folders = getDialFoldersFromAttachments(attachments);
  const links = getDialLinksFromAttachments(attachments);

  return (
    <div className="relative rounded" data-qa="attachment-container">
      <div className="flex max-h-[100px] flex-col gap-1 overflow-auto pt-3 md:grid md:grid-cols-3">
        <ChatInputAttachments files={files} folders={folders} links={links} />
      </div>
    </div>
  );
}
