import { unzipSync } from 'fflate';
import { parse, stringify } from 'yaml';

/** Root manifest filename required at the top of every skill archive (mirrors `SKILL_MANIFEST_FILE` in `apps/chat-api/src/skills/utils/skill-path.util.ts`). */
export const SKILL_MANIFEST_FILE = 'SKILL.md';

/**
 * Client-side mirror of the backend's default `SKILL_FILE_UPLOAD_MAX_BYTES`
 * (`apps/chat-api/src/config/environment.config.ts`), used only for
 * immediate inline feedback when a user picks a file to upload — the server
 * remains authoritative and enforces its own configured limit regardless.
 */
export const SKILL_FILE_UPLOAD_MAX_BYTES = 1_048_576;

/**
 * Client-side mirror of the backend's default `SKILL_UPLOAD_MAX_TOTAL_BYTES`
 * (`apps/chat-api/src/config/environment.config.ts`), used only for
 * immediate inline feedback on the projected total package size — the server
 * remains authoritative and enforces its own configured limit regardless.
 */
export const SKILL_UPLOAD_MAX_TOTAL_BYTES = 16_777_216;

/**
 * Client-side mirror of the backend's default `SKILL_UPLOAD_MAX_FILES`
 * (`apps/chat-api/src/config/environment.config.ts`), used only for
 * immediate inline feedback on the projected total file count (including the
 * root `SKILL.md`) — the server remains authoritative regardless.
 */
export const SKILL_UPLOAD_MAX_FILES = 100;

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

/**
 * Builds `SKILL.md`'s content for an edit save: reassigns only `name`/
 * `description` onto the *loaded* frontmatter object (mutating a shallow
 * copy, never the original) so unrecognized fields (e.g. `version`) survive
 * re-serialization unchanged, then appends the (possibly edited)
 * instructions body.
 */
export const buildSkillManifestFromFrontmatter = (
  baseFrontmatter: Record<string, unknown>,
  name: string,
  description: string,
  instructions: string,
): string => {
  const merged = { ...baseFrontmatter, name, description };
  const frontmatter = stringify(merged).trimEnd();
  return `---\n${frontmatter}\n---\n\n${instructions}`;
};

/** A skill's `SKILL.md` split into its parsed frontmatter object and the raw instructions body. */
export interface ParsedSkillManifest {
  /** The full parsed frontmatter object, including fields this app never renders. */
  frontmatter: Record<string, unknown>;
  /** The instructions body following the closing `---` delimiter. */
  instructions: string;
}

// Matches a leading `---` frontmatter block (LF or CRLF line endings) and
// captures the YAML body plus everything after the closing `---`.
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Parses a `SKILL.md`'s YAML frontmatter and instructions body — the inverse
 * of `buildSkillManifest`/`buildSkillManifestFromFrontmatter`. Throws if the
 * manifest has no `---`-delimited frontmatter block.
 */
export const parseSkillManifest = (
  manifestText: string,
): ParsedSkillManifest => {
  const match = FRONTMATTER_PATTERN.exec(manifestText);
  if (!match) {
    throw new Error('SKILL.md is missing its YAML frontmatter block');
  }
  const [, frontmatterText, rest] = match;
  const frontmatter = (parse(frontmatterText) ?? {}) as Record<string, unknown>;
  const instructions = rest.replace(/^\r?\n/, '');
  return { frontmatter, instructions };
};

/** A skill archive unpacked into its manifest text and a relative-path → bytes map of every other entry. */
export interface UnpackedSkillArchive {
  /** The root `SKILL.md` entry's decoded text content. */
  manifestText: string;
  /** Every non-manifest entry, keyed by relative path. */
  files: Map<string, Uint8Array>;
}

/**
 * Unpacks a whole-skill ZIP (as downloaded from `GET /api/v1/skills/download`
 * — DIAL Core's whole-resource `GET` is the one place this contract still
 * uses a ZIP, per design.md) into its manifest text and every other entry's
 * bytes. Throws if the archive has no root `SKILL.md` entry.
 */
export const unpackSkillArchive = (bytes: Uint8Array): UnpackedSkillArchive => {
  const entries = unzipSync(bytes);
  const manifestBytes = entries[SKILL_MANIFEST_FILE];
  if (manifestBytes == null) {
    throw new Error(
      `Skill archive is missing a root ${SKILL_MANIFEST_FILE} file`,
    );
  }

  const files = new Map<string, Uint8Array>();
  for (const [path, content] of Object.entries(entries)) {
    if (path === SKILL_MANIFEST_FILE || path.endsWith('/')) continue;
    files.set(path, content);
  }

  return {
    manifestText: new TextDecoder().decode(manifestBytes),
    files,
  };
};
