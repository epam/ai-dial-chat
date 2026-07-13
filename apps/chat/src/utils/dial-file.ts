import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { safeDecodeURI } from './string-utils';

export const isDialFileId = (url: string): boolean => url.startsWith('files/');

/**
 * Converts a DIAL file ID or full resource path to the relative bucket path
 * expected by the files download API.
 */
export const resolveRelativeDialFilePath = (
  pathOrFileId: string,
  bucket: string,
): string => {
  const resourcePrefix = `files/${bucket}/`;
  if (pathOrFileId.startsWith(resourcePrefix)) {
    return safeDecodeURI(pathOrFileId.slice(resourcePrefix.length));
  }

  if (isDialFileId(pathOrFileId)) {
    const withoutPrefix = pathOrFileId.slice('files/'.length);
    const slashIdx = withoutPrefix.indexOf('/');
    if (slashIdx >= 0) {
      const pathBucket = withoutPrefix.slice(0, slashIdx);
      const rawPath = withoutPrefix.slice(slashIdx + 1);
      if (pathBucket === bucket) {
        return safeDecodeURI(rawPath);
      }
    }
  }

  return pathOrFileId;
};

/**
 * Extracts the bucket and decoded relative path from a DIAL file ID
 * (`files/{bucket}/{path}`). Returns `undefined` if the input does not start
 * with `files/` or has no path segment after the bucket.
 */
export const resolveDialFileBucketAndPath = (
  fileId: string,
): { bucket: string; path: string } | undefined => {
  if (!isDialFileId(fileId)) return undefined;
  const withoutPrefix = fileId.slice('files/'.length);
  const slashIdx = withoutPrefix.indexOf('/');
  if (slashIdx < 0) return undefined;
  const bucket = withoutPrefix.slice(0, slashIdx);
  const rawPath = withoutPrefix.slice(slashIdx + 1);
  let path: string;
  try {
    path = decodeURIComponent(rawPath);
  } catch {
    path = rawPath;
  }
  return { bucket, path };
};

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

/**
 * Returns the best downloadable DIAL-file URL from an attachment's `url` or
 * `referenceUrl`, or `undefined` when neither is a valid DIAL `files/` path.
 */
export const resolveDialUrl = (
  attachment: DisplayAttachment,
): string | undefined => {
  if (attachment.url != null && isDialFileId(attachment.url)) {
    return resolveDialFileDownloadUrl(attachment.url);
  }
  if (
    attachment.referenceUrl != null &&
    isDialFileId(attachment.referenceUrl)
  ) {
    return resolveDialFileDownloadUrl(attachment.referenceUrl);
  }
  return undefined;
};
