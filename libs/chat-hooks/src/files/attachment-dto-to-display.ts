import type {
  Annotation,
  AttachmentDisplayResolvers,
  DisplayAttachment,
  MessageAttachment,
} from '@epam/ai-dial-chat-shared';
import {
  AttachmentType,
  messageAttachmentToDisplayAttachment,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';

/**
 * Maps a message attachment payload to the display-only attachment model used by UI components.
 */
export const attachmentDtoToDisplayAttachment = (
  dto: MessageAttachment,
  resolvers: AttachmentDisplayResolvers,
): DisplayAttachment => messageAttachmentToDisplayAttachment(dto, resolvers);

/** Maps an annotation's source attachment to the display-only attachment model. */
export const annotationToDisplayAttachment = (
  annotation: Annotation,
): DisplayAttachment | null => {
  const att = annotation.body?.source?.attachment;
  if (att == null) return null;
  return {
    id: att.url,
    name: att.url.split('/').pop() ?? att.url,
    contentType: att.type,
    type: att.type.startsWith('image/')
      ? AttachmentType.Image
      : AttachmentType.File,
    status: RequestStatus.Idle,
    url: att.url,
  };
};

/** Maps Chat API attachment DTOs to display-only attachment models. */
export const attachmentDtosToDisplayAttachments = (
  dtos: MessageAttachment[] | undefined,
  resolvers: AttachmentDisplayResolvers,
): DisplayAttachment[] =>
  dtos?.map((dto) => attachmentDtoToDisplayAttachment(dto, resolvers)) ?? [];
