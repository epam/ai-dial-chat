/** Builds an `If-Match` header object from an optional ETag, for spreading into an SDK call's `headers`. Shared by every skills sub-service that forwards a caller-supplied `If-Match`. */
export const buildIfMatchHeaders = (
  ifMatch?: string,
): Record<string, string> => (ifMatch != null ? { 'If-Match': ifMatch } : {});
