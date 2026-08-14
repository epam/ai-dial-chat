import {
  RequestStatus,
  type DisplayAttachment,
  type MessageAttachment,
} from '../models/chat';
import { AttachmentType } from '../types/attachment';
import { getAttachmentTypeFromMime, inferMimeTypeFromPath } from './mime-type';

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

const getInlineDataUrl = (
  mimeType: string | undefined,
  data: string | undefined,
  allowedPrefix: 'image/' | 'audio/',
): string | undefined => {
  if (!mimeType?.startsWith(allowedPrefix) || !data) return undefined;

  return `data:${mimeType};base64,${data}`;
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
  const type = getAttachmentTypeFromMime(dto.type);
  const isImage = type === AttachmentType.Image;
  const isAudio = type === AttachmentType.Audio;
  const isLink = dto.url && dto.reference_url && !dto.reference_type;
  const id = dto.url ?? dto.data ?? dto.title;

  const contentType =
    (dto.url == null && dto.reference_url != null
      ? (dto.reference_type ?? inferMimeTypeFromPath(dto.reference_url))
      : undefined) ??
    dto.type ??
    '';

  let previewUrl: string | undefined;
  if (isImage) {
    if (dto.url) {
      previewUrl = resolvers.resolvePreviewUrl?.(dto) ?? dto.url;
    } else if (dto.data) {
      previewUrl = getInlineDataUrl(dto.type, dto.data, 'image/');
    }
  }

  let playUrl: string | undefined;
  if (isAudio) {
    if (dto.url) {
      playUrl = resolvers.resolvePlayUrl?.(dto) ?? dto.url;
    } else if (dto.data) {
      playUrl = getInlineDataUrl(dto.type, dto.data, 'audio/');
    }
  }

  return {
    id,
    name: dto.title,
    contentType,
    type: isLink ? AttachmentType.Link : type,
    status: RequestStatus.Idle,
    ...(dto.url ? { url: dto.url } : {}),
    ...(dto.reference_url ? { referenceUrl: dto.reference_url } : {}),
    ...(isImage && previewUrl ? { previewUrl } : {}),
    ...(isAudio && playUrl ? { playUrl } : {}),
    ...(!isImage && !isAudio && dto.data ? { data: dto.data } : {}),
  };
};

/** Maps a list of {@link MessageAttachment} DTOs to display-only attachment models. Entries with duplicate `id` values are deduplicated — first occurrence wins. */
export const messageAttachmentsToDisplayAttachments = (
  dtos: MessageAttachment[] | undefined,
  resolvers: AttachmentDisplayResolvers = {},
): DisplayAttachment[] => {
  const seen = new Set<string | undefined>();
  return (
    dtos?.reduce<DisplayAttachment[]>((acc, dto) => {
      const att = messageAttachmentToDisplayAttachment(dto, resolvers);
      if (!seen.has(att.id)) {
        seen.add(att.id);
        acc.push(att);
      }
      return acc;
    }, []) ?? []
  );
};
