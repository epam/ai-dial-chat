import type {
  DisplayAttachment,
  MessageAttachment,
} from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { resolveCatalogIconUrl } from './icon-path';

/**
 * Maps a message attachment payload to the display-only attachment model used by UI components.
 */
export const attachmentDtoToDisplayAttachment = (
  dto: MessageAttachment,
): DisplayAttachment => {
  const isImage = dto.type?.startsWith('image/') ?? false;
  const id = dto.url ?? dto.data ?? dto.title;
  const previewUrl = dto.url
    ? resolveCatalogIconUrl(dto.url)
    : dto.type && dto.data
      ? `data:${dto.type};base64,${dto.data}`
      : undefined;

  return {
    id,
    name: dto.title,
    contentType: dto.type ?? '',
    type: isImage ? AttachmentType.Image : AttachmentType.File,
    status: RequestStatus.Idle,
    ...(dto.url ? { url: dto.url } : {}),
    ...(isImage && (dto.url || dto.data) && dto.type ? { previewUrl } : {}),
  };
};

/** Maps Chat API attachment DTOs to display-only attachment models. */
export const attachmentDtosToDisplayAttachments = (
  dtos?: MessageAttachment[],
): DisplayAttachment[] => dtos?.map(attachmentDtoToDisplayAttachment) ?? [];
