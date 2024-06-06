import { Attachment } from '@/src/types/chat';

export const getMappedAttachmentUrl = (url: string | undefined) => {
  if (!url) {
    return undefined;
  }
  return url.startsWith('data:') ||
    url.startsWith('//') ||
    url.startsWith('http')
    ? url
    : `api/${url}`;
};

export const getMappedAttachment = (attachment: Attachment): Attachment => {
  return {
    ...attachment,
    url: getMappedAttachmentUrl(attachment.url),
    reference_url: getMappedAttachmentUrl(attachment.url),
  };
};
