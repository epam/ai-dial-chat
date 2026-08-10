// eslint-disable-next-line no-control-regex -- intentional: rejects NUL/control characters in a skill path
const CONTROL_CHAR_PATTERN = /[\x00-\x1f]/;
const RESERVED_ENTRY_NAMES = new Set(['.dial-resource', '.dial-folder']);
const RESERVED_FIRST_SEGMENTS = new Set(['files', 'v']);
const WINDOWS_DRIVE_PATTERN = /^[a-zA-Z]:/;

export const SKILL_RESOURCE_PREFIX = 'skills/';

export interface ParsedSkillResourceUrl {
  bucket: string;
  path: string;
}

/**
 * Parses a full `skills/{bucket}/{path}` DIAL Core resource URL into its
 * `{ bucket, path }` parts, for `SkillsLookupService.resolveSkillItem`.
 * Returns `null` for anything that isn't a well-formed skill resource URL
 * (wrong prefix, missing bucket, or missing path) — callers treat that as
 * "not a skill URL" rather than throwing.
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

/**
 * Reserved-marker/structural-segment validator for a skill-relative file
 * path with no trailing slash (design.md D4). Shared by
 * `SkillsUploadService`'s ZIP-entry validation and standalone `filePath`
 * validation (`uploadSkillFile`/`deleteSkillFile`), on top of whatever
 * `IsValidFilePath` already checks at the DTO layer. Rejects:
 * - absolute paths, Windows drive letters, backslashes
 * - empty, `.`, or `..` segments
 * - NUL/other control characters
 * - the literal segment names `.dial-resource`/`.dial-folder`
 * - `files`/`v` as the first path segment
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

export interface SkillArchiveEntryPathResult {
  isDirectory: boolean;
  safeRelativePath: string | null;
}

/**
 * Zip-slip + reserved-marker defense for a single whole-skill-archive entry
 * (design.md D1/D4), reusing the same directory-entry-skip shape as
 * `apps/chat-api/src/files/upload/files-upload.service.ts`'s
 * `resolveArchiveEntryPath` — directory entries (trailing `/`) are flagged
 * so callers can skip them rather than validate as a file.
 */
export const resolveSkillEntryPath = (
  entryFileName: string,
): SkillArchiveEntryPathResult => {
  if (entryFileName.endsWith('/')) {
    return { isDirectory: true, safeRelativePath: null };
  }

  const isSafe = isValidSkillRelativePath(entryFileName);

  return {
    isDirectory: false,
    safeRelativePath: isSafe ? entryFileName : null,
  };
};
