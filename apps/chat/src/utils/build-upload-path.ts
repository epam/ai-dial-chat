import type { Attachment } from '@epam/ai-dial-chat-shared';
import { formatDateYMD } from './date';

export const getSafeFileName = (fileName: string): string => {
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

/**
 * Builds the `uploads/<YYYY-MM-DD>/<safe-name>` upload path for an imported
 * archive attachment — a day-level counterpart to `buildUploadPath`'s
 * month-level convention, used only for conversation import. Does not
 * de-duplicate: a name collision is left for the upload call to reject
 * (`create-only` mode), surfaced to the user as an error rather than
 * silently renamed.
 */
export const buildImportUploadPath = (fileName: string, date: Date): string => {
  const dateFolder = formatDateYMD(date);
  const encodedFileName = encodeURIComponent(getSafeFileName(fileName));
  return `uploads/${dateFolder}/${encodedFileName}`;
};
