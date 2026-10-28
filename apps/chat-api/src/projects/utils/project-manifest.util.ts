import { stringify as stringifyYaml } from 'yaml';

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
}

/**
 * Builds `PROJECT.md`: a `---`-fenced YAML frontmatter with `name` and
 * `description`, a blank line, then the instructions verbatim as the
 * markdown body. The frontmatter goes through `yaml`'s serializer, never
 * string concatenation, so a description cannot inject keys or close the
 * fence early.
 */
export const buildProjectManifest = ({
  name,
  description,
  instructions,
}: ProjectManifestInput): string => {
  const frontmatter = stringifyYaml({ name, description }, { lineWidth: 0 });
  return `---\n${frontmatter}---\n\n${instructions}`;
};
