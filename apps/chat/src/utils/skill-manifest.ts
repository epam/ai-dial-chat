import { parse as parseYaml } from 'yaml';
import type { SkillAboutDetails, SkillManifest } from '../types/skill';

/** A line consisting solely of `---`, opening or closing the frontmatter block. */
const FENCE_LINE = /^---[ \t]*$/;

/**
 * Frontmatter keys recognised for each `SkillAboutDetails` field. Matching is
 * exact — manifests are user-authored, and a fuzzy match would promote an
 * unrelated key into the panel as if it were a specification.
 */
const ABOUT_KEY_ALIASES = {
  whenToUse: ['when_to_use', 'when-to-use', 'whenToUse'],
  allowedTools: ['allowed_tools', 'allowed-tools', 'allowedTools'],
  bundledResources: [
    'bundled_resources',
    'bundled-resources',
    'bundledResources',
  ],
  skillPrompt: ['skill_prompt', 'skill-prompt', 'skillPrompt'],
} as const satisfies Record<keyof SkillAboutDetails, readonly string[]>;

type FrontmatterRecord = Record<string, unknown>;

/** Returns the first alias that resolves to a non-empty string, or `undefined`. */
const readString = (
  frontmatter: FrontmatterRecord,
  aliases: readonly string[],
): string | undefined => {
  for (const alias of aliases) {
    const value = frontmatter[alias];
    if (typeof value === 'string' && value !== '') return value;
  }
  return undefined;
};

/**
 * Returns the first alias that resolves to a non-empty string list. An array
 * keeps only its string entries; a bare string is promoted to one entry.
 */
const readStringList = (
  frontmatter: FrontmatterRecord,
  aliases: readonly string[],
): string[] | undefined => {
  for (const alias of aliases) {
    const value = frontmatter[alias];
    if (typeof value === 'string' && value !== '') return [value];
    if (!Array.isArray(value)) continue;

    const entries = value.filter(
      (entry): entry is string => typeof entry === 'string' && entry !== '',
    );
    if (entries.length > 0) return entries;
  }
  return undefined;
};

/** Maps recognised frontmatter keys onto `SkillAboutDetails`, or `undefined` when none resolved. */
const readAbout = (
  frontmatter: FrontmatterRecord,
): SkillAboutDetails | undefined => {
  const about: SkillAboutDetails = {};

  const whenToUse = readString(frontmatter, ABOUT_KEY_ALIASES.whenToUse);
  if (whenToUse != null) about.whenToUse = whenToUse;

  const allowedTools = readStringList(
    frontmatter,
    ABOUT_KEY_ALIASES.allowedTools,
  );
  if (allowedTools != null) about.allowedTools = allowedTools;

  const bundledResources = readStringList(
    frontmatter,
    ABOUT_KEY_ALIASES.bundledResources,
  );
  if (bundledResources != null) about.bundledResources = bundledResources;

  const skillPrompt = readString(frontmatter, ABOUT_KEY_ALIASES.skillPrompt);
  if (skillPrompt != null) about.skillPrompt = skillPrompt;

  return Object.keys(about).length > 0 ? about : undefined;
};

/**
 * Splits a `SKILL.md` into its YAML frontmatter fields and its prose body.
 *
 * Never throws: a file with no opening fence, no closing fence, or frontmatter
 * that fails to parse resolves to the whole input as `body` with no
 * frontmatter fields. Parse failure is strictly weaker than fetch failure —
 * the manifest text is still returned so the Content tab can render it.
 */
export const parseSkillManifest = (raw: string): SkillManifest => {
  /*
   * A BOM survives the fetch, and a Windows-authored manifest arrives with
   * CRLF — left in place, every parsed value would carry a trailing `\r`.
   */
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');

  const openingIndex = lines.findIndex((line) => line.trim() !== '');
  if (openingIndex === -1 || !FENCE_LINE.test(lines[openingIndex].trim())) {
    return { body: raw };
  }

  const closingIndex = lines.findIndex(
    (line, index) => index > openingIndex && FENCE_LINE.test(line.trim()),
  );
  if (closingIndex === -1) {
    return { body: raw };
  }

  let frontmatter: unknown;
  try {
    frontmatter = parseYaml(
      lines.slice(openingIndex + 1, closingIndex).join('\n'),
    );
  } catch {
    return { body: raw };
  }

  const bodyLines = lines.slice(closingIndex + 1);
  /* Drop the single blank line conventionally separating fence from body. */
  if (bodyLines[0] === '') bodyLines.shift();
  const body = bodyLines.join('\n');

  if (frontmatter == null || typeof frontmatter !== 'object') {
    return { body };
  }

  const record = frontmatter as FrontmatterRecord;
  const name = readString(record, ['name']);
  const description = readString(record, ['description']);
  const about = readAbout(record);

  return {
    ...(name != null ? { name } : {}),
    ...(description != null ? { description } : {}),
    ...(about != null ? { about } : {}),
    body,
  };
};
