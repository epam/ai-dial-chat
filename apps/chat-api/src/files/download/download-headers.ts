const IMAGE_CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
};

const GENERIC_CONTENT_TYPES = new Set([
  'application/octet-stream',
  'binary/octet-stream',
]);

const mimeOf = (contentType: string | undefined): string =>
  (contentType ?? '').split(';')[0].trim().toLowerCase();

/** Image Content-Type inferred from the file extension, or `undefined` when unknown. */
const imageContentTypeFromPath = (path: string): string | undefined => {
  const clean = path.split(/[?#]/)[0];
  const dotIdx = clean.lastIndexOf('.');
  if (dotIdx === -1) return undefined;
  return IMAGE_CONTENT_TYPE_BY_EXT[clean.slice(dotIdx + 1).toLowerCase()];
};

/**
 * Adjusts download headers so image files can render in `<img src>`.
 * Core often sends `Content-Disposition: attachment` and
 * `Content-Type: application/octet-stream`; with Helmet's `nosniff` that
 * combination is not a valid image response.
 */
export const headersForEmbeddedImage = (
  headers: Record<string, string>,
  path: string,
): Record<string, string> => {
  const inferredType = imageContentTypeFromPath(path);
  const currentMime = mimeOf(headers['content-type']);
  const isImage =
    inferredType != null || currentMime.startsWith('image/');
  if (!isImage) return headers;

  const next = { ...headers };
  if (inferredType != null && GENERIC_CONTENT_TYPES.has(currentMime)) {
    next['content-type'] = inferredType;
  }
  const disposition = next['content-disposition'];
  if (disposition) {
    next['content-disposition'] = disposition.replace(/^attachment/i, 'inline');
  } else {
    const filename = path.split('/').pop() ?? 'image';
    next['content-disposition'] = `inline; filename="${filename}"`;
  }
  return next;
};
