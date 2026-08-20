import { parse as parseYaml } from 'yaml';

/** A line consisting solely of `---`, opening or closing the frontmatter block. */
const FENCE_LINE = /^---[ \t]*$/;

export interface SkillManifestFrontmatter {
  name: string;
  description: string;
}

/**
 * Thrown by `parseSkillManifestFrontmatter` for any structurally invalid
 * manifest. Callers map this to `400 BadRequestException` — unlike the
 * frontend's lenient `apps/chat/src/utils/skill-manifest.ts` (which never
 * throws, since it only renders whatever is there), an archive import must
 * reject a Skill whose manifest cannot be trusted.
 */
export class InvalidSkillManifestError extends Error {}

/**
 * Strict backend counterpart to the frontend's `parseSkillManifest`: requires
 * well-formed YAML frontmatter with non-empty string `name`/`description`
 * (design.md D6, `add-skill-archive-import`). Backend code cannot import the
 * frontend utility (apps may not import from each other), and the frontend
 * version is deliberately lossy for rendering — this one is deliberately
 * strict for validating untrusted archive content before a Skill is created.
 */
export const parseSkillManifestFrontmatter = (
  raw: string,
): SkillManifestFrontmatter => {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');

  const openingIndex = lines.findIndex((line) => line.trim() !== '');
  if (openingIndex === -1 || !FENCE_LINE.test(lines[openingIndex].trim())) {
    throw new InvalidSkillManifestError('SKILL.md is missing YAML frontmatter');
  }

  const closingIndex = lines.findIndex(
    (line, index) => index > openingIndex && FENCE_LINE.test(line.trim()),
  );
  if (closingIndex === -1) {
    throw new InvalidSkillManifestError('SKILL.md frontmatter is not closed');
  }

  let frontmatter: unknown;
  try {
    frontmatter = parseYaml(
      lines.slice(openingIndex + 1, closingIndex).join('\n'),
    );
  } catch {
    throw new InvalidSkillManifestError(
      'SKILL.md frontmatter is not valid YAML',
    );
  }

  if (frontmatter == null || typeof frontmatter !== 'object') {
    throw new InvalidSkillManifestError(
      'SKILL.md frontmatter must be a YAML mapping',
    );
  }

  const record = frontmatter as Record<string, unknown>;
  const { name, description } = record;

  if (typeof name !== 'string' || name.trim() === '') {
    throw new InvalidSkillManifestError(
      'SKILL.md frontmatter must include a non-empty "name"',
    );
  }
  if (typeof description !== 'string' || description.trim() === '') {
    throw new InvalidSkillManifestError(
      'SKILL.md frontmatter must include a non-empty "description"',
    );
  }

  return { name, description };
};
