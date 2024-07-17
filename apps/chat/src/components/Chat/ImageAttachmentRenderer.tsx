import { IconDownload } from '@tabler/icons-react';
import { useMemo } from 'react';

import { getMappedAttachmentUrl } from '@/src/utils/app/attachments';

import { Attachment } from '@/src/types/chat';

import { stopBubbling } from '@/src/constants/chat';

interface Props {
  attachment: Attachment;
}

export const ImageAttachmentRenderer = ({ attachment }: Props) => {
  const mappedAttachmentUrl = useMemo(
    () => getMappedAttachmentUrl(attachment?.url),
    [attachment.url],
  );

  return (
    <div className="relative h-[300px] w-[300px] overflow-hidden rounded-secondary shadow-primary">
      <img
        src={mappedAttachmentUrl}
        className="m-0 aspect-auto size-full"
        alt="Attachment image"
      />
      <a
        download={attachment?.title}
        href={mappedAttachmentUrl}
        onClick={stopBubbling}
        className="text-pr-grey-white hover:text-pr-tertiary-500 absolute right-3 top-3"
      >
        <IconDownload size={20} />
      </a>
    </div>
  );
};
