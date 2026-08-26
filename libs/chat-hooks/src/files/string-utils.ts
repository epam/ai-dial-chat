/*
 * Local copy of `apps/chat/src/utils/string-utils.ts`'s `safeDecodeURI` only.
 * That app file has many unrelated consumers, so its export surface is not
 * widened for this lib — this file is intentionally not re-exported from
 * `libs/chat-hooks/src/index.ts`.
 */

/** Decodes a URI-encoded path segment, returning the original string if decoding fails. */
export const safeDecodeURI = (path: string): string => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};
