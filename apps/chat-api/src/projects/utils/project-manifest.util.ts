import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

/**
 * The chat-owned manifest at a project's root. DIAL Core imposes no layout
 * on a project (its `ProjectHandler` validates nothing and stores no
 * metadata), so the chat keeps name, description and instructions here,
 * mirroring a skill's `SKILL.md`.
 */
export const PROJECT_MANIFEST_FILE = 'PROJECT.md';

/** Folder, relative to the project root, that holds the context files. */
export const PROJECT_CONTEXT_FOLDER = 'context';

export interface ProjectManifestInput {
  name: string;
  description: string;
  instructions: string;
  /**
   * Frontmatter keys another client wrote, re-emitted after `name` and
   * `description` so an edit does not drop them. A create passes none.
   */
  extraFrontmatter?: Record<string, unknown>;
}

/** Frontmatter keys the chat owns; every other key is carried through. */
const OWN_FRONTMATTER_KEYS = new Set(['name', 'description']);

/**
 * Builds `PROJECT.md`: a `---`-fenced YAML frontmatter with `name` and
 * `description`, a blank line, then the instructions verbatim as the
 * markdown body, with any `extraFrontmatter` keys after the two. The
 * frontmatter goes through `yaml`'s serializer, never string concatenation,
 * so a description cannot inject keys or close the fence early.
 */
export const buildProjectManifest = ({
  name,
  description,
  instructions,
  extraFrontmatter = {},
}: ProjectManifestInput): string => {
  const extras = Object.fromEntries(
    Object.entries(extraFrontmatter).filter(
      ([key]) => !OWN_FRONTMATTER_KEYS.has(key),
    ),
  );
  const frontmatter = stringifyYaml(
    { name, description, ...extras },
    { lineWidth: 0 },
  );
  return `---\n${frontmatter}---\n\n${instructions}`;
};

export interface ParsedProjectManifest {
  description: string;
  instructions: string;
  /** Frontmatter keys other than `name` and `description`; absent when there are none. */
  extraFrontmatter?: Record<string, unknown>;
  /** `true` when the text had no valid frontmatter; the caller logs it. */
  isMalformed: boolean;
}

/* A `---` fence at the very start, the YAML lines, then a `---` line. The
 * YAML group is optional so an empty frontmatter still matches. A `---`
 * inside a value cannot close the fence: `yaml` writes multi-line values as
 * indented block scalars or quoted single lines. */
const FRONTMATTER_RE = /^---\r?\n((?:[\s\S]*?\r?\n)?)---(?:\r?\n|$)/;

/**
 * Inverse of {@link buildProjectManifest}. Reads `description` from the
 * frontmatter (only when it is a string) and returns the body as the
 * instructions, minus the single blank line the builder writes after the
 * fence. Text another client wrote without a parseable frontmatter is kept
 * whole as the instructions, and any other frontmatter key is returned in
 * `extraFrontmatter`, so the next save loses nothing. The frontmatter `name`
 * is ignored: a project's name is its path.
 */
export const parseProjectManifest = (text: string): ParsedProjectManifest => {
  const match = FRONTMATTER_RE.exec(text);
  if (!match) {
    return { description: '', instructions: text, isMalformed: true };
  }

  let frontmatter: unknown;
  try {
    frontmatter = parseYaml(match[1]);
  } catch {
    return { description: '', instructions: text, isMalformed: true };
  }
  if (
    frontmatter != null &&
    (typeof frontmatter !== 'object' || Array.isArray(frontmatter))
  ) {
    return { description: '', instructions: text, isMalformed: true };
  }

  const fields = (frontmatter ?? {}) as Record<string, unknown>;
  const extraEntries = Object.entries(fields).filter(
    ([key]) => !OWN_FRONTMATTER_KEYS.has(key),
  );
  return {
    description:
      typeof fields['description'] === 'string' ? fields['description'] : '',
    instructions: text.slice(match[0].length).replace(/^\r?\n/, ''),
    isMalformed: false,
    ...(extraEntries.length > 0
      ? { extraFrontmatter: Object.fromEntries(extraEntries) }
      : {}),
  };
};
