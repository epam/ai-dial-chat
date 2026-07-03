import {
  AttachmentType,
  RequestStatus,
  type Attachment,
} from '@epam/ai-dial-chat-shared';
import { DialFileNodeType, type DialFile } from '@epam/ai-dial-ui-kit';
import { isDialFileId } from './dial-file';
import { resolveCatalogIconUrl } from './icon-path';
import { safeDecodeURIComponent } from './string-utils';

const getDialFileUrl = (file: DialFile, bucket: string): string | undefined => {
  const source = file.url ?? file.id;
  if (!source) return undefined;
  if (
    isDialFileId(source) ||
    source.startsWith('http://') ||
    source.startsWith('https://')
  ) {
    return source;
  }

  return `files/${bucket}/${source.replace(/^\/+/, '')}`;
};

/**
 * Converts a selected ui-kit file into the generic attachment contract.
 * DIAL storage identifiers are resolved at the app edge so the input library
 * remains unaware of buckets, server routes, and external file systems.
 */
export const dialFileToAttachment = (
  file: DialFile,
  bucket: string,
): Attachment | null => {
  if (file.nodeType !== DialFileNodeType.ITEM) return null;

  const url = getDialFileUrl(file, bucket);
  if (!url) return null;

  const contentType = file.contentType ?? 'application/octet-stream';
  const isImage = contentType.startsWith('image/');

  return {
    id: url,
    name: file.name,
    contentType,
    type: isImage ? AttachmentType.Image : AttachmentType.File,
    status: RequestStatus.Idle,
    url,
    file: new File([], file.name, { type: contentType }),
    ...(isImage ? { previewUrl: resolveCatalogIconUrl(url) } : {}),
  };
};

export const dialFilesToAttachments = (
  files: DialFile[],
  bucket: string,
): Attachment[] =>
  files
    .map((file) => dialFileToAttachment(file, bucket))
    .filter((attachment): attachment is Attachment => attachment != null);

/**
 * Converts a DIAL Core folder path (e.g. `files/{bucket}/{path}/`) into an
 * attachment. DIAL Core resolves folder contents server-side when the path is
 * sent as an attachment URL.
 */
export const dialFolderPathToAttachment = (folderPath: string): Attachment => {
  const rawSegment =
    folderPath.replace(/\/$/, '').split('/').filter(Boolean).pop() ?? '';
  const name = safeDecodeURIComponent(rawSegment);
  return {
    id: folderPath,
    name,
    contentType: 'application/octet-stream',
    type: AttachmentType.File,
    status: RequestStatus.Idle,
    url: folderPath,
    file: new File([], name),
  };
};
