/** Builds the `files/{bucket}/{path}` DIAL resource URL from a relative path. */
export const buildDialFileUrl = (bucket: string, path: string): string =>
  `files/${bucket}/${path}`;

/**
 * Percent-encodes a bucket-relative files path, segment by segment.
 *
 * Unlike the shared `encodeDialResourcePath`, it does not decode first. Paths
 * in the files domain are already plain — DIAL Core returns `name`/`parentPath`
 * decoded and only `url` percent-encoded — so a pre-decode would silently
 * rewrite a name that legitimately contains a percent escape (`a%20b.pdf`
 * would reach DIAL Core as `a b.pdf`, a resource that does not exist).
 */
export const encodeDialFilePath = (path: string): string =>
  path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

/** Same as {@link buildDialFileUrl}, but percent-encodes the path first. */
export const buildDialFileResourceUrl = (
  bucket: string,
  path: string,
): string => buildDialFileUrl(bucket, encodeDialFilePath(path));

/** Strips the `files/{bucket}/` prefix from a full DIAL resource path, if present. */
export const toRelativePath = (path: string, bucket: string): string => {
  const prefix = `files/${bucket}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
};
