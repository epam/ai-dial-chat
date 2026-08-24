import type { AttachmentDto } from '@epam/ai-dial-chat-api-client';
import type { Attachment } from '@epam/ai-dial-chat-shared';

/** Maps an already-uploaded attachment to its DTO shape. Throws if the attachment has no `url` yet. */
export const attachmentToDto = (attachment: Attachment): AttachmentDto => {
  if (!attachment.url) {
    throw new Error(`Attachment "${attachment.name}" has not been uploaded`);
  }

  return {
    type: attachment.contentType,
    title: attachment.name,
    url: attachment.url,
  } as AttachmentDto;
};

/** Maps a list of already-uploaded attachments to DTOs, or `undefined` when the list is empty. */
export const attachmentsToDtos = (
  attachments: Attachment[],
): AttachmentDto[] | undefined => {
  if (!attachments.length) return undefined;
  return attachments.map(attachmentToDto);
};
