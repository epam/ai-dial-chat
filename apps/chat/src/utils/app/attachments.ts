import { Attachment } from '@/src/types/chat';

export const isAbsoluteUrl = (url: string): boolean => {
  const urlLower = url.toLowerCase();
  return [
    'data:',
    '//',
    'http://',
    'https://',
    'file://',
    'ftp://',
    'mailto:',
    'telnet://',
  ].some((prefix) => urlLower.startsWith(prefix));
};

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
