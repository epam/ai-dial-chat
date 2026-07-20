import {
  RequestStatus,
  type DisplayAttachment,
  type MessageAttachment,
} from '../models/chat';
import { AttachmentType } from '../types/attachment';
import { FileExtension, MIMEType } from '../types/mime-type';

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

const EXTENSION_MIME_TYPES: Partial<Record<FileExtension, MIMEType>> = {
  [FileExtension.PDF]: MIMEType.PDF,
  [FileExtension.Markdown]: MIMEType.Markdown,
  [FileExtension.MarkdownAlt]: MIMEType.Markdown,
  [FileExtension.JSON]: MIMEType.JSON,
};

/**
 * Infers a MIME type from a reference-only attachment's `reference_url` file
 * extension (ignoring any query string or `#` fragment such as a PDF
 * `#page=N` anchor). Returns `undefined` when the extension is unrecognized.
 */
const inferContentTypeFromReferenceUrl = (
  referenceUrl: string,
): MIMEType | undefined => {
  const path = referenceUrl.split(/[?#]/)[0];
  const dotIdx = path.lastIndexOf('.');
  if (dotIdx === -1) return undefined;
  const ext = path.slice(dotIdx + 1).toLowerCase() as FileExtension;
  return EXTENSION_MIME_TYPES[ext];
};

const getAttachmentType = (mimeType: string | undefined): AttachmentType => {
  if (mimeType?.startsWith('image/')) return AttachmentType.Image;
  if (mimeType?.startsWith('audio/')) return AttachmentType.Audio;
  return AttachmentType.File;
};

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
  const type = getAttachmentType(dto.type);
  const isImage = type === AttachmentType.Image;
  const isAudio = type === AttachmentType.Audio;
  const isLink = dto.url && dto.reference_url && !dto.reference_type;
  const id = dto.url ?? dto.data ?? dto.title;

  const contentType =
    (dto.url == null && dto.reference_url != null
      ? (dto.reference_type ??
        inferContentTypeFromReferenceUrl(dto.reference_url))
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

/** Maps a list of {@link MessageAttachment} DTOs to display-only attachment models. */
export const messageAttachmentsToDisplayAttachments = (
  dtos: MessageAttachment[] | undefined,
  resolvers: AttachmentDisplayResolvers = {},
): DisplayAttachment[] =>
  dtos?.map((dto) => messageAttachmentToDisplayAttachment(dto, resolvers)) ??
  [];
