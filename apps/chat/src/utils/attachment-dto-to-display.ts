import type {
  Annotation,
  DisplayAttachment,
  MessageAttachment,
} from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { resolveDialFileDownloadUrl } from './dial-file';
import { resolveCatalogIconUrl } from './icon-path';

const getAttachmentType = (mimeType: string | undefined): AttachmentType => {
  if (mimeType?.startsWith('image/')) return AttachmentType.Image;
  if (mimeType?.startsWith('audio/')) return AttachmentType.Audio;
  return AttachmentType.File;
};

/**
 * Maps a message attachment payload to the display-only attachment model used by UI components.
 */
export const attachmentDtoToDisplayAttachment = (
  dto: MessageAttachment,
): DisplayAttachment => {
  const type = getAttachmentType(dto.type);
  const isImage = type === AttachmentType.Image;
  const isAudio = type === AttachmentType.Audio;
  const id = dto.url ?? dto.data ?? dto.title;
  const previewUrl = dto.url
    ? resolveCatalogIconUrl(dto.url)
    : dto.type && dto.data
      ? `data:${dto.type};base64,${dto.data}`
      : undefined;
  let playUrl: string | undefined;
  if (isAudio) {
    if (dto.url) {
      playUrl = resolveDialFileDownloadUrl(dto.url) ?? dto.url;
    } else if (dto.data) {
      playUrl = `data:${dto.type ?? 'audio/mpeg'};base64,${dto.data}`;
    }
  }

  return {
    id,
    name: dto.title,
    contentType: dto.type ?? '',
    type,
    status: RequestStatus.Idle,
    ...(dto.url ? { url: dto.url } : {}),
    ...(dto.reference_url ? { referenceUrl: dto.reference_url } : {}),
    ...(isImage && (dto.url || dto.data) && dto.type ? { previewUrl } : {}),
    ...(isAudio && playUrl ? { playUrl } : {}),
    ...(!isImage && !isAudio && dto.data ? { data: dto.data } : {}),
  };
};

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
