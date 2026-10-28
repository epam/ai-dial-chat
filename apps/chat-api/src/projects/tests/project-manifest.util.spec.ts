import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import {
  buildProjectManifest,
  PROJECT_CONTEXT_FOLDER,
  PROJECT_MANIFEST_FILE,
} from '../utils/project-manifest.util';

const splitManifest = (
  manifest: string,
): { frontmatter: unknown; body: string } => {
  const match = /^---\n([\s\S]*?)---\n\n([\s\S]*)$/.exec(manifest);
  if (!match) throw new Error('Manifest has no frontmatter fence');
  return { frontmatter: parseYaml(match[1]), body: match[2] };
};

describe('buildProjectManifest', () => {
  it('names the manifest PROJECT.md and the context folder context', () => {
    expect(PROJECT_MANIFEST_FILE).toBe('PROJECT.md');
    expect(PROJECT_CONTEXT_FOLDER).toBe('context');
  });

  it('round-trips a description with YAML-significant characters', () => {
    const description =
      'Line 1\nkey: "value" # not a comment\n---\n- not a list';
    const { frontmatter } = splitManifest(
      buildProjectManifest({
        name: 'Q4: launch',
        description,
        instructions: '',
      }),
    );

    expect(frontmatter).toEqual({ name: 'Q4: launch', description });
  });

  it('keeps the instructions byte for byte as the body', () => {
    const instructions =
      '## Approach\n\n---\n\n  indented `code`\n```yaml\nname: x\n```\n\n';
    const { body } = splitManifest(
      buildProjectManifest({ name: 'p', description: 'd', instructions }),
    );

    expect(body).toBe(instructions);
  });

  it('writes an empty description and an empty body for a name-only project', () => {
    const manifest = buildProjectManifest({
      name: 'Handbook',
      description: '',
      instructions: '',
    });
    const { frontmatter, body } = splitManifest(manifest);

    expect(frontmatter).toEqual({ name: 'Handbook', description: '' });
    expect(body).toBe('');
  });

  it('keeps a long description on one logical value without folding', () => {
    const description = 'word '.repeat(200).trim();
    const { frontmatter } = splitManifest(
      buildProjectManifest({ name: 'p', description, instructions: '' }),
    );

    expect(frontmatter).toEqual({ name: 'p', description });
  });
});
