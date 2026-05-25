import type { Attachment } from '@epam/ai-dial-chat-shared';
import type { AttachmentDto } from '@epam/chat-api-client';

/**
 * Converts a base64url-encoded string produced by `FileReader.readAsDataURL`
 * into the plain base64 string that the Chat API attachment DTO expects.
 */
const dataUrlToBase64 = (dataUrl: string): string => {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
};

/**
 * Reads a `File` object and returns its content as a plain base64 string.
 */
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(dataUrlToBase64(reader.result as string));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/**
 * Maps a client-side `Attachment` to the attachment DTO accepted by the
 * Chat API. The file content is base64-encoded and placed in the `data` field.
 */
export const attachmentToDto = async (
  attachment: Attachment,
): Promise<AttachmentDto> => {
  const data = await fileToBase64(attachment.file);
  return {
    type: attachment.contentType,
    title: attachment.name,
    data,
  };
};

/**
 * Maps an array of `Attachment` items to Chat API attachment DTOs in parallel.
 * Returns `undefined` when the input array is empty.
 */
export const attachmentsToDtos = async (
  attachments: Attachment[],
): Promise<AttachmentDto[] | undefined> => {
  if (!attachments.length) return undefined;
  return Promise.all(attachments.map(attachmentToDto));
};
