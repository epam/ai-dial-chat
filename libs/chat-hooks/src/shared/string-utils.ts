/** Case-insensitive substring match. */
export const includesIgnoreCase = (str: string, query: string): boolean =>
  str.toLowerCase().includes(query.toLowerCase());

/** Decodes a URI-encoded path segment, returning the original string if decoding fails. */
export const safeDecodeURI = (path: string): string => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

/** Alias of {@link safeDecodeURI} for call sites decoding a URI component rather than a path. */
export const safeDecodeURIComponent = safeDecodeURI;

/*
 * Trailing slashes are trimmed by index scan rather than a `/\/+$/` regex:
 * repetition anchored at `$` with an unanchored start makes the engine retry
 * from every offset, so a long run of slashes in a path coming off the wire
 * costs quadratic time (CodeQL js/polynomial-redos). The scans below are
 * linear regardless of input.
 */

/** Strips trailing slashes from a path segment. */
export const stripTrailingSlashes = (path: string): string => {
  let end = path.length;
  while (end > 0 && path[end - 1] === '/') end -= 1;
  return path.slice(0, end);
};

/** Strips leading and trailing slashes from a path segment. */
export const stripSurroundingSlashes = (path: string): string => {
  let start = 0;
  let end = path.length;
  while (start < end && path[start] === '/') start += 1;
  while (end > start && path[end - 1] === '/') end -= 1;
  return path.slice(start, end);
};
