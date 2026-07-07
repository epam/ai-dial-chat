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
import { resolveDialFileDownloadUrl } from './dial-file';
import { resolveCatalogIconUrl } from './icon-path';

/**
 * App-owned resolvers wired into the shared mapper: images preview through the
 * catalog icon endpoint, audio plays back through the DIAL file download URL.
 */
const attachmentDisplayResolvers: AttachmentDisplayResolvers = {
  resolvePreviewUrl: (dto) => resolveCatalogIconUrl(dto.url),
  resolvePlayUrl: (dto) => dto.url && resolveDialFileDownloadUrl(dto.url),
};

/**
 * Maps a message attachment payload to the display-only attachment model used by UI components.
 */
export const attachmentDtoToDisplayAttachment = (
  dto: MessageAttachment,
): DisplayAttachment =>
  messageAttachmentToDisplayAttachment(dto, attachmentDisplayResolvers);

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
  dtos?: MessageAttachment[],
): DisplayAttachment[] => dtos?.map(attachmentDtoToDisplayAttachment) ?? [];
