import {
  ENTITY_DESCRIPTION_MAX_LENGTH,
  ENTITY_INSTRUCTIONS_MAX_LENGTH,
  ENTITY_NAME_MAX_LENGTH,
  HIDDEN_FILE,
  exceedsMaxLength,
} from '@epam/ai-dial-chat-shared';
import {
  SkillFileNodeKind,
  type SkillFileTreeNode,
} from '@epam/ai-dial-skill-editor';
import { unzipSync } from 'fflate';
import { parse, stringify } from 'yaml';
import type { SkillFileContent } from './skill-file-preview';

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

/**
 * Zero-byte object written at `<folder>/.dial_folder` so an otherwise empty
 * skill folder survives a save — DIAL Core storage has no directory objects,
 * so a folder only exists as a file's path prefix.
 */
export const SKILL_FOLDER_MARKER = HIDDEN_FILE;

const SKILL_FOLDER_MARKER_SUFFIX = `/${SKILL_FOLDER_MARKER}`;

/** Whether a skill-relative path is a folder marker (`<folder>/.dial_folder`, never a root-level `.dial_folder`). */
export const isSkillFolderMarkerPath = (path: string): boolean =>
  path.endsWith(SKILL_FOLDER_MARKER_SUFFIX) &&
  path.length > SKILL_FOLDER_MARKER_SUFFIX.length;

/** Returns the folder path a marker path stands for (`docs/.dial_folder` → `docs`). */
export const skillFolderMarkerParent = (markerPath: string): string =>
  markerPath.slice(0, -SKILL_FOLDER_MARKER_SUFFIX.length);

const RESERVED_ENTRY_NAMES = new Set([
  '.dial-resource',
  '.dial-folder',
  SKILL_FOLDER_MARKER,
]);
const RESERVED_FIRST_SEGMENTS = new Set(['files', 'v']);
const WINDOWS_DRIVE_PATTERN = /^[a-zA-Z]:/;
// eslint-disable-next-line no-control-regex -- intentional: rejects NUL/control characters in a skill path
const CONTROL_CHAR_PATTERN = /[\x00-\x1f]/;

/**
 * Client-side mirror of the backend's `isValidSkillRelativePath`
 * (`apps/chat-api/src/skills/utils/skill-path.util.ts`), used only for
 * immediate inline feedback — the server remains authoritative and may still
 * reject a path this function accepts. It additionally reserves the
 * `.dial_folder` marker name so a user can never upload or name a folder
 * after it; the save payload's generated markers never pass through here
 * (the server accepts them only as a zero-byte final segment).
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
export const normalizeSkillName = (input: string): string => {
  const hyphenated = input.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  /*
   * Each run of invalid characters above collapses to a single hyphen, so at
   * most one hyphen can sit at either end — trimming one character per side is
   * enough. A `/^-+|-+$/` regex would be equivalent but quadratic: repetition
   * anchored at `$` with an unanchored start makes the engine retry from every
   * offset (CodeQL js/polynomial-redos).
   */
  return hyphenated.replace(/^-/, '').replace(/-$/, '');
};

/** Skill editor text fields with a length limit. */
export type SkillTextField = 'name' | 'description' | 'instructions';

/** Length limit of each skill editor text field. */
export const SKILL_TEXT_FIELD_MAX_LENGTHS: Record<SkillTextField, number> = {
  name: ENTITY_NAME_MAX_LENGTH,
  description: ENTITY_DESCRIPTION_MAX_LENGTH,
  instructions: ENTITY_INSTRUCTIONS_MAX_LENGTH,
};

/** Returns the limit each over-long skill field exceeds, keyed by field; fields within their limit are omitted. */
export const getSkillFieldLengthViolations = (
  values: Record<SkillTextField, string>,
): Partial<Record<SkillTextField, number>> => {
  const violations: Partial<Record<SkillTextField, number>> = {};
  for (const field of Object.keys(
    SKILL_TEXT_FIELD_MAX_LENGTHS,
  ) as SkillTextField[]) {
    const maxLength = SKILL_TEXT_FIELD_MAX_LENGTHS[field];
    if (exceedsMaxLength(values[field].trim(), maxLength)) {
      violations[field] = maxLength;
    }
  }
  return violations;
};

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

/** A line consisting solely of `---`, opening or closing a frontmatter block. */
const FENCE_LINE_PATTERN = /^---[ \t]*$/;

/**
 * Answers one question: would appending this text after the fence that
 * `buildSkillManifest` writes produce a *second* frontmatter block?
 *
 * That happens when the text's first non-blank line is a bare `---` and some
 * later line is a bare `---` too — the exact shape of a `SKILL.md` pasted
 * wholesale into the editor's Instructions field.
 *
 * Detection is deliberately structural rather than YAML-based: a pasted block
 * whose fenced content fails to parse corrupts the stored manifest
 * identically (and renders as a setext `h2` in the Catalog's Details tab just
 * the same), so requiring parseable YAML here would let the worst cases
 * through. Keeping `parseYaml` out also makes this cheap enough to run on
 * every keystroke.
 *
 * A single unclosed fence returns `false`: with no closing fence there is no
 * second block, matching `FRONTMATTER_PATTERN`'s own requirement. A `---`
 * appearing later in the body (a horizontal rule, a setext underline) is
 * likewise not a frontmatter block.
 */
export const startsWithFrontmatterBlock = (text: string): boolean => {
  /*
   * A BOM survives a paste from a Windows-authored file, and CRLF would leave
   * every line with a trailing `\r` that no fence pattern matches.
   */
  const lines = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .split('\n');

  const openingIndex = lines.findIndex((line) => line.trim() !== '');
  if (openingIndex === -1 || !FENCE_LINE_PATTERN.test(lines[openingIndex])) {
    return false;
  }

  return lines.some(
    (line, index) => index > openingIndex && FENCE_LINE_PATTERN.test(line),
  );
};

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
  /** Every non-manifest, non-marker entry, keyed by relative path. */
  files: Map<string, Uint8Array>;
  /** Folder paths restored from `<folder>/.dial_folder` marker entries. */
  folders: string[];
}

/**
 * Unpacks a whole-skill ZIP (as downloaded from `GET /api/v1/skills/download`
 * — DIAL Core's whole-resource `GET` is the one place this contract still
 * uses a ZIP, per `openspec/changes/archive/2026-10-05-persist-skill-empty-folders/design.md`) into its manifest text, every other entry's
 * bytes, and the folders its empty-folder markers stand for. Throws if the
 * archive has no root `SKILL.md` entry.
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
  const folders: string[] = [];
  for (const [path, content] of Object.entries(entries)) {
    if (path === SKILL_MANIFEST_FILE || path.endsWith('/')) continue;
    if (isSkillFolderMarkerPath(path)) {
      folders.push(skillFolderMarkerParent(path));
      continue;
    }
    // A root-level marker stands for no folder, and the server would refuse to save it back.
    if (path === SKILL_FOLDER_MARKER) continue;
    files.set(path, content);
  }

  return {
    manifestText: new TextDecoder().decode(manifestBytes),
    files,
    folders,
  };
};

/** Returns a skill relative path's final segment (its display name in the file tree). */
export const nameFromPath = (path: string): string => {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash === -1 ? path : path.slice(lastSlash + 1);
};

/** Wraps raw bytes in a `Blob`, copying them so the source buffer can be reused. */
export const skillFileBytesToBlob = (bytes: Uint8Array): Blob =>
  new Blob([new Uint8Array(bytes)]);

/**
 * Builds `SKILL.md`'s content for a create or edit submission: reassigns
 * onto the loaded/imported frontmatter when one exists (so unrecognized
 * fields survive), otherwise builds a fresh manifest from just `name`/
 * `description`/`instructions`.
 */
export const buildSkillManifestForSubmit = (
  frontmatter: Record<string, unknown>,
  name: string,
  description: string,
  instructions: string,
): string =>
  Object.keys(frontmatter).length > 0
    ? buildSkillManifestFromFrontmatter(
        frontmatter,
        name,
        description,
        instructions,
      )
    : buildSkillManifest({ name, description, instructions });

/** The ordered supporting-file paths and `Blob` payload `createSkill`/`updateSkill` expect. */
export interface SkillFilesPayload {
  /** Relative paths, positionally paired with `files`. */
  filePaths: string[];
  /** File contents, positionally paired with `filePaths`. */
  files: Blob[];
}

/**
 * Builds the ordered supporting-file paths and `Blob` payload
 * `createSkill`/`updateSkill` expect from the editor's file tree and
 * in-memory content map. Every folder node with no descendant node gets a
 * zero-byte `<folder>/.dial_folder` marker after the real files, so the
 * empty folder survives the whole-skill write; a folder with content needs
 * none, and a marker it had before is dropped by that same write.
 */
export const buildSkillFilesPayload = (
  files: SkillFileTreeNode[],
  filesContent: Map<string, SkillFileContent>,
): SkillFilesPayload => {
  const fileNodes = files.filter(
    (node) => node.kind === SkillFileNodeKind.File,
  );
  const markerPaths = files
    .filter(
      (folder) =>
        folder.kind === SkillFileNodeKind.Folder &&
        !files.some((node) => node.path.startsWith(`${folder.path}/`)),
    )
    .map((folder) => `${folder.path}${SKILL_FOLDER_MARKER_SUFFIX}`);
  return {
    filePaths: [...fileNodes.map((node) => node.path), ...markerPaths],
    files: [
      ...fileNodes.map((node) =>
        skillFileBytesToBlob(
          filesContent.get(node.path)?.bytes ?? new Uint8Array(0),
        ),
      ),
      ...markerPaths.map(() => new Blob([])),
    ],
  };
};
