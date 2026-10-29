import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import {
  buildProjectManifest,
  parseProjectManifest,
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

describe('parseProjectManifest', () => {
  it('round-trips the description and instructions buildProjectManifest wrote', () => {
    const description = 'a: b\n---\n# not a comment';
    const instructions = '## Steps\n\n---\n1. Go\n';

    expect(
      parseProjectManifest(
        buildProjectManifest({ name: 'Q4', description, instructions }),
      ),
    ).toEqual({ description, instructions, isMalformed: false });
  });

  it('reads an empty description and empty instructions for a name-only manifest', () => {
    expect(
      parseProjectManifest(
        buildProjectManifest({ name: 'p', description: '', instructions: '' }),
      ),
    ).toEqual({ description: '', instructions: '', isMalformed: false });
  });

  it('keeps the whole text as instructions when there is no frontmatter', () => {
    const text = '# Written by another client\nNo fence here.';

    expect(parseProjectManifest(text)).toEqual({
      description: '',
      instructions: text,
      isMalformed: true,
    });
  });

  it('keeps the whole text as instructions when the frontmatter is invalid YAML', () => {
    const text = '---\ndescription: [unclosed\n---\n\nBody';

    expect(parseProjectManifest(text)).toEqual({
      description: '',
      instructions: text,
      isMalformed: true,
    });
  });

  it('treats a non-object frontmatter as malformed', () => {
    const text = '---\n- a\n- b\n---\n\nBody';

    expect(parseProjectManifest(text).isMalformed).toBe(true);
    expect(parseProjectManifest(text).instructions).toBe(text);
  });

  it('ignores a non-string description', () => {
    expect(
      parseProjectManifest('---\ndescription: 42\n---\n\nBody').description,
    ).toBe('');
  });

  it('accepts CRLF line endings', () => {
    expect(
      parseProjectManifest('---\r\ndescription: d\r\n---\r\n\r\nBody'),
    ).toEqual({ description: 'd', instructions: 'Body', isMalformed: false });
  });

  it('returns frontmatter keys other than name and description as extras', () => {
    expect(
      parseProjectManifest(
        '---\nname: q4\ndescription: d\nowner: research\ntags:\n  - a\n---\n\nBody',
      ),
    ).toEqual({
      description: 'd',
      instructions: 'Body',
      isMalformed: false,
      extraFrontmatter: { owner: 'research', tags: ['a'] },
    });
  });
});

describe('buildProjectManifest with extra frontmatter', () => {
  it('re-emits extra keys after name and description', () => {
    expect(
      buildProjectManifest({
        name: 'q4',
        description: 'd',
        instructions: 'Body',
        extraFrontmatter: { owner: 'research' },
      }),
    ).toBe('---\nname: q4\ndescription: d\nowner: research\n---\n\nBody');
  });

  it('never lets an extra key override name or description', () => {
    const { frontmatter } = splitManifest(
      buildProjectManifest({
        name: 'q4',
        description: 'd',
        instructions: '',
        extraFrontmatter: { name: 'other', description: 'other' },
      }),
    );

    expect(frontmatter).toEqual({ name: 'q4', description: 'd' });
  });

  it('round-trips a stored manifest without losing unknown keys', () => {
    const stored =
      '---\nname: q4\ndescription: old\nowner: research\n---\n\nSteps';
    const parsed = parseProjectManifest(stored);

    expect(
      buildProjectManifest({
        name: 'q4',
        description: 'new',
        instructions: parsed.instructions,
        extraFrontmatter: parsed.extraFrontmatter,
      }),
    ).toBe('---\nname: q4\ndescription: new\nowner: research\n---\n\nSteps');
  });
});
