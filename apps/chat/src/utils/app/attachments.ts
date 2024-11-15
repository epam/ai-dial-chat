import { isAbsoluteUrl } from '@/src/utils/app/file';

import { Attachment } from '@epam/ai-dial-shared';

export const getMappedAttachmentUrl = (url: string | undefined) => {
  if (!url) {
    return undefined;
  }
  return isAbsoluteUrl(url) ? url : `api/${url}`;
};

export const getMappedAttachment = (attachment: Attachment): Attachment => {
  return {
    ...attachment,
    url: getMappedAttachmentUrl(attachment.url),
    reference_url: getMappedAttachmentUrl(attachment.url),
  };
};
