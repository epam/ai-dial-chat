import type {
  CustomVisualizer,
  DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import {
  EXTENSION_RESOLVERS,
  MIME_TYPE_RESOLVERS,
} from '../constants/open-routing';
import { AttachmentContentType } from '../types/attachment-canvas';
import { OpenResolverName } from '../types/open-resolver';
import { getOoxmlFileType } from './content';
import { findVisualizerForMime } from './visualizer';

/** Returns `Pdf` when the attachment routes to the PDF resolver, otherwise `undefined`, following the same MIME-then-extension precedence as `useOpenAttachmentCanvas`. */
export const getLoadingContentType = (
  attachment: DisplayAttachment,
  customVisualizers: CustomVisualizer[],
): AttachmentContentType | undefined => {
  const contentType = attachment.contentType.toLowerCase();
  if (findVisualizerForMime(contentType, customVisualizers) != null) {
    return undefined;
  }
  if (getOoxmlFileType('', contentType) != null) return undefined;

  const mimeTypeResolver = MIME_TYPE_RESOLVERS[contentType];
  if (mimeTypeResolver != null) {
    return mimeTypeResolver === OpenResolverName.Pdf
      ? AttachmentContentType.Pdf
      : undefined;
  }

  const fileName = attachment.name ?? '';
  if (getOoxmlFileType(fileName) != null) return undefined;
  const dotIdx = fileName.lastIndexOf('.');
  const ext = dotIdx !== -1 ? fileName.slice(dotIdx + 1).toLowerCase() : '';
  return EXTENSION_RESOLVERS[ext] === OpenResolverName.Pdf
    ? AttachmentContentType.Pdf
    : undefined;
};
