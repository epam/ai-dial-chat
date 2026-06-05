import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import type { AttachmentDto } from '@epam/chat-api-client';
import { resolveCatalogIconUrl } from './icon-path';

/**
 * Maps a Chat API attachment DTO to the display-only attachment model used by UI components.
 */
export const attachmentDtoToDisplayAttachment = (
  dto: AttachmentDto,
): DisplayAttachment => {
  const isImage = dto.type.startsWith('image/');
  const id = dto.url ?? dto.data ?? dto.title;
  const previewUrl = dto.url
    ? resolveCatalogIconUrl(dto.url)
    : `data:${dto.type};base64,${dto.data}`;

  return {
    id,
    name: dto.title,
    contentType: dto.type,
    type: isImage ? AttachmentType.Image : AttachmentType.File,
    status: RequestStatus.Idle,
    ...(dto.url ? { url: dto.url } : {}),
    ...(isImage && (dto.url || dto.data) ? { previewUrl } : {}),
  };
};

/** Maps Chat API attachment DTOs to display-only attachment models. */
export const attachmentDtosToDisplayAttachments = (
  dtos?: AttachmentDto[],
): DisplayAttachment[] => dtos?.map(attachmentDtoToDisplayAttachment) ?? [];
