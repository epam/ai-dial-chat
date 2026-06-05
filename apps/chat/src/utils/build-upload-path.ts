import type { Attachment } from '@epam/ai-dial-chat-shared';

const getSafeFileName = (fileName: string): string => {
  const name = fileName.split(/[\\/]/).filter(Boolean).pop() ?? 'file';
  return name.replace(/\.\.+/g, '.').replace(/^\.+/, '') || 'file';
};

export const buildUploadPath = (attachment: Attachment): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const encodedFileName = encodeURIComponent(getSafeFileName(attachment.name));
  return `uploads/${year}-${month}/${encodedFileName}`;
};
