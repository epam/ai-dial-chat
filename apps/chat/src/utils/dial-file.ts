import {
  isDialFileId,
  resolveDialFileBucketAndPath,
} from '@epam/ai-dial-chat-hooks';
import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';

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
 * Converts a DIAL file ID (`files/{bucket}/{path}`) to the BFF metadata URL.
 * Returns `undefined` if the input does not start with `files/` or has no path segment.
 * The path segment is decoded with `decodeURIComponent` before being set as the query parameter.
 */
export const resolveDialFileMetadataUrl = (
  fileId: string,
): string | undefined => {
  const resolved = resolveDialFileBucketAndPath(fileId);
  if (!resolved) return undefined;
  const params = new URLSearchParams(resolved);
  return `/api/v1/files/metadata?${params.toString()}`;
};

/** Strips a trailing `#...` fragment (e.g. a PDF `#page=N` anchor) from a DIAL file id. */
const stripFragment = (fileId: string): string => fileId.split('#')[0];

/**
 * Rewrites a markdown `href`/`src` when it is a DIAL file id
 * (`files/{bucket}/{path}`); otherwise returns the URL unchanged. A trailing
 * `#page=N`-style anchor is stripped before resolving, the same as
 * {@link resolveDialUrl} does, so it is not percent-encoded into the `path`
 * query parameter (which would 404 the download).
 */
export const resolveMarkdownUrl = (url: string): string =>
  resolveDialFileDownloadUrl(stripFragment(url)) ?? url;

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

/**
 * Returns an absolute downloadable URL for an attachment, or `undefined` when
 * it has none. Used for URLs handed to a cross-origin iframe: everything else
 * in the app fetches same-origin, where {@link resolveDialUrl}'s
 * host-relative path is correct, but a relative path posted into an iframe
 * would resolve against that iframe's own origin instead.
 */
export const resolveAbsoluteDialUrl = (
  attachment: DisplayAttachment,
): string | undefined => {
  const url = resolveDialUrl(attachment);
  if (url != null) {
    return new URL(url, window.location.origin).toString();
  }
  /* A non-DIAL `url` is already an absolute external URL — DIAL Core sends
   * those verbatim — so it needs no resolution, only validation. */
  if (attachment.url != null && isExternalHttpUrl(attachment.url)) {
    return attachment.url;
  }
  return undefined;
};

/** Returns whether `url` parses as an absolute `http(s)` URL. */
const isExternalHttpUrl = (url: string): boolean => {
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};
