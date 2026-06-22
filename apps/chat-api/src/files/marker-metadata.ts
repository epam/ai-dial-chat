import { MARKER_NAME } from './files.constants';

const stripTrailingSlash = (path: string): string =>
  path.endsWith('/') ? path.slice(0, -1) : path;

const toRelativeDialPath = (bucket: string, url: string): string => {
  const resourcePrefix = `files/${bucket}/`;
  return url.startsWith(resourcePrefix)
    ? url.slice(resourcePrefix.length)
    : url;
};

/** True only when DIAL returned metadata for this exact marker object. */
export const markerMetadataMatches = (
  data: unknown,
  bucket: string,
  markerPath: string,
): boolean => {
  if (data == null || typeof data !== 'object') return false;

  const fileData = data as { name?: string; url?: string };
  if (fileData.name !== MARKER_NAME || fileData.url == null) return false;

  const relativeUrl = toRelativeDialPath(bucket, fileData.url);
  return stripTrailingSlash(relativeUrl) === stripTrailingSlash(markerPath);
};
