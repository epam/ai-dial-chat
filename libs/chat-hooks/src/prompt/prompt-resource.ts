/** Which prompt namespace a catalog prompt item came from. */
export enum PromptSource {
  /** The caller's own prompt, editable and deletable by them. */
  Personal = 'personal',
  /** Shared with the caller by another user; permissions determine editability. */
  SharedWithMe = 'sharedWithMe',
  /** Organisation-wide prompt; read-only for every user. */
  Public = 'public',
}

/** Prefix of every prompt resource URL. */
const PROMPT_RESOURCE_PREFIX = 'prompts/';

/** A prompt resource URL split into the bucket and the path within it. */
export interface ParsedPromptResourceUrl {
  /** DIAL Core bucket name. */
  bucket: string;
  /** Path to the prompt within that bucket. */
  path: string;
}

/**
 * Splits a `prompts/{bucket}/{path}` resource URL into its parts, mirroring the
 * backend's parser. Returns `null` for a different prefix, an empty bucket, or
 * an empty path, so callers can treat "not a prompt resource id" as one case.
 *
 * `CatalogItem.id` for a prompt is always this full resource path — the read,
 * update, delete, and move endpoints all take it unmodified. The one caller
 * that still needs the bucket-relative sub-path on its own is the
 * organisation (public) prompt read, whose endpoint kept its bucket-relative
 * `path` argument because it only ever operates on the fixed `public`
 * namespace.
 */
export const parsePromptResourceUrl = (
  url: string,
): ParsedPromptResourceUrl | null => {
  if (!url.startsWith(PROMPT_RESOURCE_PREFIX)) return null;
  const rest = url.slice(PROMPT_RESOURCE_PREFIX.length);
  const slashIndex = rest.indexOf('/');
  if (slashIndex <= 0) return null;
  const bucket = rest.slice(0, slashIndex);
  const path = rest.slice(slashIndex + 1);
  if (bucket === '' || path === '') return null;
  return { bucket, path };
};
