/** Which skill namespace a catalog skill item came from. */
export enum SkillSource {
  /** A skill in the caller's own bucket. */
  Personal = 'personal',
  /** An organisation-wide skill; read-only for every user. */
  Public = 'public',
}

/** DIAL Core bucket holding organisation-wide skills. */
export const PUBLIC_SKILL_BUCKET = 'public';

/** Prefix of every skill resource URL. */
const SKILL_RESOURCE_PREFIX = 'skills/';

/** Manifest file every skill carries at its root. */
export const SKILL_MANIFEST_FILE = 'SKILL.md';

/**
 * Largest manifest the details panel will decode. A `SKILL.md` past this is
 * treated as unreadable rather than rendered.
 */
export const SKILL_MANIFEST_MAX_BYTES = 256 * 1024;

/** Items requested per skill-listing page. */
export const SKILL_LISTING_PAGE_SIZE = 1000;

/**
 * Upper bound on `nextToken` follow-ups per listing, so a pathological bucket
 * cannot spin the client forever.
 */
export const SKILL_LISTING_MAX_PAGES = 10;

/** Structured fields lifted from a skill manifest's frontmatter. */
export interface SkillAboutDetails {
  whenToUse?: string;
  allowedTools?: string[];
  bundledResources?: string[];
  skillPrompt?: string;
}

/** A skill's parsed manifest details. */
export interface SkillEntityDetails {
  about?: SkillAboutDetails;
}

/** A `SKILL.md` split into its frontmatter fields and its prose body. */
export interface SkillManifest {
  /** `name` frontmatter field, when present and a string. */
  name?: string;
  /** `description` frontmatter field, when present and a string. */
  description?: string;
  /** Recognised `about.*` frontmatter fields. Absent when none resolved. */
  about?: SkillAboutDetails;
  /** Everything after the frontmatter fence, or the whole file when there is none. */
  body: string;
}

/** A skill resource URL split into the bucket and the path within it. */
export interface ParsedSkillResourceUrl {
  /** DIAL Core bucket name. */
  bucket: string;
  /** Path to the skill within that bucket. */
  path: string;
}

/**
 * Splits a `skills/{bucket}/{path}` resource URL into its parts, mirroring the
 * backend's parser. Returns `null` for a different prefix, an empty bucket, or
 * an empty path, so callers can treat "not a skill URL" as one case.
 */
export const parseSkillResourceUrl = (
  url: string,
): ParsedSkillResourceUrl | null => {
  if (!url.startsWith(SKILL_RESOURCE_PREFIX)) return null;
  const rest = url.slice(SKILL_RESOURCE_PREFIX.length);
  const slashIndex = rest.indexOf('/');
  if (slashIndex <= 0) return null;
  const bucket = rest.slice(0, slashIndex);
  const path = rest.slice(slashIndex + 1);
  if (bucket === '' || path === '') return null;
  return { bucket, path };
};
