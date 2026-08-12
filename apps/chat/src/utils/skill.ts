import { strToU8, zipSync } from 'fflate';
import { stringify } from 'yaml';

/** Root manifest filename required at the top of every skill archive (mirrors `SKILL_MANIFEST_FILE` in `apps/chat-api/src/skills/utils/skill-path.util.ts`). */
export const SKILL_MANIFEST_FILE = 'SKILL.md';

const RESERVED_ENTRY_NAMES = new Set(['.dial-resource', '.dial-folder']);
const RESERVED_FIRST_SEGMENTS = new Set(['files', 'v']);
const WINDOWS_DRIVE_PATTERN = /^[a-zA-Z]:/;
// eslint-disable-next-line no-control-regex -- intentional: rejects NUL/control characters in a skill path
const CONTROL_CHAR_PATTERN = /[\x00-\x1f]/;

/**
 * Client-side mirror of the backend's `isValidSkillRelativePath`
 * (`apps/chat-api/src/skills/utils/skill-path.util.ts`), used only for
 * immediate inline feedback — the server remains authoritative and may still
 * reject a path this function accepts.
 */
export const isValidSkillRelativePath = (relativePath: string): boolean => {
  if (relativePath === '' || relativePath.startsWith('/')) return false;
  if (WINDOWS_DRIVE_PATTERN.test(relativePath)) return false;
  if (relativePath.includes('\\')) return false;
  if (CONTROL_CHAR_PATTERN.test(relativePath)) return false;

  const segments = relativePath.split('/');
  if (
    segments.some(
      (segment) => segment === '' || segment === '.' || segment === '..',
    )
  ) {
    return false;
  }
  if (segments.some((segment) => RESERVED_ENTRY_NAMES.has(segment))) {
    return false;
  }
  if (RESERVED_FIRST_SEGMENTS.has(segments[0])) {
    return false;
  }

  return true;
};

/**
 * Normalizes a user-entered skill name to the DIAL naming convention
 * (lowercase letters, digits, and hyphens; no spaces): lowercases the input,
 * replaces every run of whitespace/invalid characters with a single hyphen,
 * and trims leading/trailing hyphens.
 */
export const normalizeSkillName = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Skill fields serialized into the `SKILL.md` manifest. */
export interface SkillManifestValues {
  /** Normalized skill name. */
  name: string;
  /** Short description of what the skill does. */
  description: string;
  /** The skill's instructions body (Markdown). */
  instructions: string;
}

/**
 * Builds `SKILL.md`'s content: a YAML frontmatter block (`name`/`description`,
 * serialized with the `yaml` package so special characters are always
 * correctly escaped) followed by the raw instructions body.
 */
export const buildSkillManifest = ({
  name,
  description,
  instructions,
}: SkillManifestValues): string => {
  const frontmatter = stringify({ name, description }).trimEnd();
  return `---\n${frontmatter}\n---\n\n${instructions}`;
};

/*
 * fflate identifies file entries with instanceof against its own Uint8Array
 * constructor, so normalize bytes from other realms before calling zipSync.
 */
const FflateUint8Array = strToU8('', true).constructor as Uint8ArrayConstructor;

const toZipUint8Array = (data: Uint8Array): Uint8Array =>
  data instanceof FflateUint8Array ? data : new FflateUint8Array(data);

/** A supporting file already fetched into memory, ready to be written into the skill archive. */
export interface SkillArchiveFileEntry {
  /** Relative path under which the file is stored, validated by `isValidSkillRelativePath`. */
  path: string;
  /** File content. */
  data: Uint8Array;
}

/**
 * Builds the whole-skill ZIP archive: the manifest at the root `SKILL.md`
 * entry, plus every supporting file at its given relative path.
 */
export const buildSkillArchive = (
  manifest: string,
  files: SkillArchiveFileEntry[],
): Blob => {
  const entries: Record<string, Uint8Array> = {
    [SKILL_MANIFEST_FILE]: toZipUint8Array(strToU8(manifest)),
  };
  for (const file of files) {
    entries[file.path] = toZipUint8Array(file.data);
  }

  const zipped = zipSync(entries);
  return new Blob([new Uint8Array(zipped)], { type: 'application/zip' });
};
