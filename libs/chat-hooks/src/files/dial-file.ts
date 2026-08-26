import { safeDecodeURI } from '../shared/string-utils';

/** True when `url` looks like a DIAL Core file id (`files/{bucket}/{path}`). */
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
