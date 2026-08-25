/** Whether `url` is a DIAL Core file reference (`files/{bucket}/{path}`). */
const isDialFileId = (url: string): boolean => url.startsWith('files/');

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
