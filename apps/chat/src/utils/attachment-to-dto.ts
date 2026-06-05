import type { Attachment } from '@epam/ai-dial-chat-shared';
import type { AttachmentDto } from '@epam/chat-api-client';

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

export const attachmentsToDtos = (
  attachments: Attachment[],
): AttachmentDto[] | undefined => {
  if (!attachments.length) return undefined;
  return attachments.map(attachmentToDto);
};
