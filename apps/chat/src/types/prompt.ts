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
 * Qualifies a bucket-relative prompt path into a `prompts/{bucket}/{path}`
 * resource URL. A path alone is ambiguous once prompts from more than one
 * bucket share a list: the prompts endpoints resolve a bare path against the
 * caller's own bucket, so a prompt shared out of someone else's bucket needs
 * the bucket carried alongside it.
 */
export const buildPromptResourceUrl = ({
  bucket,
  path,
}: ParsedPromptResourceUrl): string =>
  `${PROMPT_RESOURCE_PREFIX}${bucket}/${path}`;

/**
 * Splits a `prompts/{bucket}/{path}` resource URL into its parts, mirroring the
 * backend's parser. Returns `null` for a different prefix, an empty bucket, or
 * an empty path, so callers can treat "a bare bucket-relative path" as one case.
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

/** Why a prompt-editor field failed client-side validation. */
export enum PromptFieldError {
  /** The field is required and was left empty. */
  Required = 'required',
  /** The value exceeds the backend's length limit for the field. */
  TooLong = 'tooLong',
  /** The name contains characters the backend's allowlist rejects. */
  InvalidName = 'invalidName',
  /** The backend reported an existing prompt or folder at the target path. */
  Conflict = 'conflict',
}
