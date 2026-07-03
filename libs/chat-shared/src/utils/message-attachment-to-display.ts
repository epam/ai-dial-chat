import {
  RequestStatus,
  type DisplayAttachment,
  type MessageAttachment,
} from '../models/chat';
import { AttachmentType } from '../types/attachment';

/**
 * Optional app-owned callbacks used to resolve display URLs for an attachment.
 * When omitted, the mapper falls back to the attachment's own `url` (or a
 * synthesized `data:` URL when only inline base64 `data` is present).
 */
export interface AttachmentDisplayResolvers {
  /** Resolves the image preview URL for an attachment that has a remote `url`. */
  resolvePreviewUrl?(dto: MessageAttachment): string | undefined;
  /** Resolves the audio playback URL for an attachment that has a remote `url`. */
  resolvePlayUrl?(dto: MessageAttachment): string | undefined;
}

const getAttachmentType = (mimeType: string | undefined): AttachmentType => {
  if (mimeType?.startsWith('image/')) return AttachmentType.Image;
  if (mimeType?.startsWith('audio/')) return AttachmentType.Audio;
  return AttachmentType.File;
};

/**
 * Maps a {@link MessageAttachment} DTO to the display-only {@link DisplayAttachment}
 * model used by UI components. This is a pure function: any app/host-specific URL
 * resolution (catalog icon URLs, DIAL file download URLs, etc.) is injected through
 * the optional `resolvers` argument rather than performed here.
 */
export const messageAttachmentToDisplayAttachment = (
  dto: MessageAttachment,
  resolvers: AttachmentDisplayResolvers = {},
): DisplayAttachment => {
  const type = getAttachmentType(dto.type);
  const isImage = type === AttachmentType.Image;
  const isAudio = type === AttachmentType.Audio;
  const id = dto.url ?? dto.data ?? dto.title;

  let previewUrl: string | undefined;
  if (isImage) {
    if (dto.url) {
      previewUrl = resolvers.resolvePreviewUrl?.(dto) ?? dto.url;
    } else if (dto.data) {
      previewUrl = `data:${dto.type};base64,${dto.data}`;
    }
  }

  let playUrl: string | undefined;
  if (isAudio) {
    if (dto.url) {
      playUrl = resolvers.resolvePlayUrl?.(dto) ?? dto.url;
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
    ...(isImage && previewUrl ? { previewUrl } : {}),
    ...(isAudio && playUrl ? { playUrl } : {}),
    ...(!isImage && !isAudio && dto.data ? { data: dto.data } : {}),
  };
};

/** Maps a list of {@link MessageAttachment} DTOs to display-only attachment models. */
export const messageAttachmentsToDisplayAttachments = (
  dtos: MessageAttachment[] | undefined,
  resolvers: AttachmentDisplayResolvers = {},
): DisplayAttachment[] =>
  dtos?.map((dto) => messageAttachmentToDisplayAttachment(dto, resolvers)) ??
  [];
