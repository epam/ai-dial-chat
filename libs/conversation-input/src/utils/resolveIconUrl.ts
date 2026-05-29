/**
 * Returns `url` when it is safe to use as an `<img src>` (absolute URL or
 * root-relative path).  Returns `undefined` for any other value so callers
 * can fall back to a default icon.
 */
export const resolveIconUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  const lower = url.toLowerCase();
  if (
    lower.startsWith('/') ||
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('//') ||
    lower.startsWith('data:')
  ) {
    return url;
  }
  if (lower.startsWith('files/')) {
    return dialFileIdToDownloadUrl(url);
  }
  return undefined;
};

//TO-DO: need to move from conversation-input
/**
 * Converts a DIAL file ID (`files/{bucket}/{path}`) to the BFF download URL.
 * The path segment may be percent-encoded; it is decoded before being passed
 * as a query parameter so the server receives the plain filename.
 */
const dialFileIdToDownloadUrl = (fileId: string): string | undefined => {
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
  const params = new URLSearchParams({ bucket, path });
  return `/api/v1/files/download?${params.toString()}`;
};
