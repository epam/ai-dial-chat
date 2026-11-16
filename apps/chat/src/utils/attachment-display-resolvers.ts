import type { AttachmentCanvasUrlResolvers } from '@epam/ai-dial-chat-hooks';
import type { AttachmentDisplayResolvers } from '@epam/ai-dial-chat-shared';
import {
  DIAL_HTML_PREVIEW_FRAME_URL,
  resolveAttachmentDownloadUrl,
  resolveDialFileMetadataUrl,
  resolveDialUrl,
} from './dial-file';
import { resolveCatalogIconUrl } from './icon-path';

/**
 * App-owned resolvers wired into the shared mapper: images preview through the
 * catalog icon endpoint, audio plays back through the DIAL file or project
 * file download URL.
 */
export const attachmentDisplayResolvers: AttachmentDisplayResolvers = {
  resolvePreviewUrl: (dto) => resolveCatalogIconUrl(dto.url),
  resolvePlayUrl: (dto) => dto.url && resolveAttachmentDownloadUrl(dto.url),
};

/** App-owned DIAL-file URL resolution injected into the shared attachment-canvas content resolvers. */
export const attachmentCanvasUrlResolvers: AttachmentCanvasUrlResolvers = {
  resolveDialFileDownloadUrl: resolveAttachmentDownloadUrl,
  resolveDialUrl,
  resolveDialFileMetadataUrl,
  htmlSrcdocHostUrl: DIAL_HTML_PREVIEW_FRAME_URL,
};
