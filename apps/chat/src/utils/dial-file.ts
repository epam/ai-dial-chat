import {
  isDialFileId,
  resolveDialFileBucketAndPath,
} from '@epam/ai-dial-chat-hooks';
import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';

export {
  isDialFileId,
  resolveRelativeDialFilePath,
  resolveDialFileBucketAndPath,
} from '@epam/ai-dial-chat-hooks';

/**
 * Converts a DIAL file ID (`files/{bucket}/{path}`) to the BFF download URL.
 * Returns `undefined` if the input does not start with `files/` or has no path segment.
 * The path segment is decoded with `decodeURIComponent` before being set as the query parameter.
 */
export const resolveDialFileDownloadUrl = (
  fileId: string,
): string | undefined => {
  const resolved = resolveDialFileBucketAndPath(fileId);
  if (!resolved) return undefined;
  const params = new URLSearchParams(resolved);
  return `/api/v1/files/download?${params.toString()}`;
};

/** Strips a trailing `#...` fragment (e.g. a PDF `#page=N` anchor) from a DIAL file id. */
const stripFragment = (fileId: string): string => fileId.split('#')[0];

/**
 * Returns the best downloadable DIAL-file URL from an attachment's `url` or
 * `referenceUrl`, or `undefined` when neither is a valid DIAL `files/` path.
 */
export const resolveDialUrl = (
  attachment: DisplayAttachment,
): string | undefined => {
  if (attachment.url != null && isDialFileId(attachment.url)) {
    return resolveDialFileDownloadUrl(stripFragment(attachment.url));
  }
  if (
    attachment.referenceUrl != null &&
    isDialFileId(attachment.referenceUrl)
  ) {
    return resolveDialFileDownloadUrl(stripFragment(attachment.referenceUrl));
  }
  return undefined;
};
