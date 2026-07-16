import { encodeDialResourcePath } from '../common/utils/encode-dial-path';

/** Builds the `files/{bucket}/{path}` DIAL resource URL from a relative path. */
export const buildDialFileUrl = (bucket: string, path: string): string =>
  `files/${bucket}/${path}`;

/** Same as {@link buildDialFileUrl}, but percent-encodes the path first. */
export const buildDialFileResourceUrl = (
  bucket: string,
  path: string,
): string => buildDialFileUrl(bucket, encodeDialResourcePath(path));

/** Strips the `files/{bucket}/` prefix from a full DIAL resource path, if present. */
export const toRelativePath = (path: string, bucket: string): string => {
  const prefix = `files/${bucket}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
};
