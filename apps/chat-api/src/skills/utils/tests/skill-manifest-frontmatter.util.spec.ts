import { describe, expect, it } from 'vitest';
import {
  InvalidSkillManifestError,
  parseSkillManifestFrontmatter,
} from '../skill-manifest-frontmatter.util';

const manifest = (name: string, description: string): string =>
  ['---', `name: ${name}`, `description: ${description}`, '---', '# Body'].join(
    '\n',
  );

describe('parseSkillManifestFrontmatter', () => {
  it('accepts a name and description at their limits', () => {
    expect(
      parseSkillManifestFrontmatter(
        manifest('a'.repeat(256), 'b'.repeat(2000)),
      ),
    ).toEqual({ name: 'a'.repeat(256), description: 'b'.repeat(2000) });
  });

  it('rejects a name over 256 characters', () => {
    expect(() =>
      parseSkillManifestFrontmatter(manifest('a'.repeat(257), 'Description')),
    ).toThrow(InvalidSkillManifestError);
  });

  it('rejects a description over 2000 characters', () => {
    expect(() =>
      parseSkillManifestFrontmatter(manifest('name', 'b'.repeat(2001))),
    ).toThrow(InvalidSkillManifestError);
  });
});
