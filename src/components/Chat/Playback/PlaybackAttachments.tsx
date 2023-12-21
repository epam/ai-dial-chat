import { IconFile, IconX } from '@tabler/icons-react';
import { PlaybackAttachment } from './playback.types';

interface PlaybackAttachmentProps {
  attachmentTitle: string;
}

export interface PlaybackAttachmentsProps {
  attachments: PlaybackAttachment[];
}

export function PlaybackAttachment({
  attachmentTitle,
}: PlaybackAttachmentProps){
  return (
    <div className="flex gap-3 rounded border border-gray-400 bg-gray-300 p-3 dark:border-gray-600 dark:bg-gray-900">
      <IconFile className="shrink-0 text-gray-500" size={18} />

      <div className="flex grow justify-between gap-3 overflow-hidden">
        <div className="flex grow flex-col overflow-hidden">
          <span className="block max-w-full truncate">{attachmentTitle}</span>
        </div>
      </div>

      <IconX className="shrink-0 text-gray-500 hover:text-blue-500" size={18} />
    </div>
  );
}

export function PlaybackAttachments({ attachments }: PlaybackAttachmentsProps){
  return (
    <div className="relative rounded">
    <div className="flex max-h-[100px] flex-col gap-1 overflow-auto pt-3 md:grid md:grid-cols-3">
      {attachments.map(({ index, title }) => (
        <PlaybackAttachment key={index} attachmentTitle={title} />
      ))}
    </div>
    </div>
  );
}
