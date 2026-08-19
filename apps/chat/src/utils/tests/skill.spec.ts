import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  buildSkillManifest,
  buildSkillManifestFromFrontmatter,
  isValidSkillRelativePath,
  normalizeSkillName,
  parseSkillManifest,
  unpackSkillArchive,
} from '../skill';

describe('normalizeSkillName', () => {
  it('lowercases and hyphenates a name with spaces and mixed case', () => {
    expect(normalizeSkillName('Good Morning Breakfast')).toBe(
      'good-morning-breakfast',
    );
  });

  it('collapses repeated separators into a single hyphen', () => {
    expect(normalizeSkillName('weird -- name__here')).toBe('weird-name-here');
  });

  it('trims leading and trailing hyphens', () => {
    expect(normalizeSkillName('  --My Skill--  ')).toBe('my-skill');
  });
});

describe('isValidSkillRelativePath', () => {
  it('accepts a simple nested path', () => {
    expect(isValidSkillRelativePath('agents/analyzer.md')).toBe(true);
  });

  it('rejects an absolute path', () => {
    expect(isValidSkillRelativePath('/etc/passwd')).toBe(false);
  });

  it('rejects a path traversal segment', () => {
    expect(isValidSkillRelativePath('../secrets.md')).toBe(false);
  });

  it('rejects a reserved entry name anywhere in the path', () => {
    expect(isValidSkillRelativePath('a/.dial-resource/b')).toBe(false);
  });

  it('rejects a reserved first segment', () => {
    expect(isValidSkillRelativePath('files/notes.md')).toBe(false);
    expect(isValidSkillRelativePath('v/notes.md')).toBe(false);
  });

  it('rejects a control character', () => {
    expect(isValidSkillRelativePath('notes\x00.md')).toBe(false);
  });

  it('rejects a Windows drive letter or backslash', () => {
    expect(isValidSkillRelativePath('C:/notes.md')).toBe(false);
    expect(isValidSkillRelativePath('notes\\file.md')).toBe(false);
  });
});

describe('buildSkillManifest', () => {
  it('produces frontmatter that round-trips through a YAML parser', () => {
    const manifest = buildSkillManifest({
      name: 'good-morning-breakfast',
      description: 'Says "good morning": uses a colon, quotes, and a\nnewline.',
      instructions: '# Instructions\n\nDo the thing.',
    });

    const [, frontmatterBlock] = manifest.split('---\n');
    const parsed = parse(frontmatterBlock);

    expect(parsed.name).toBe('good-morning-breakfast');
    expect(parsed.description).toBe(
      'Says "good morning": uses a colon, quotes, and a\nnewline.',
    );
    expect(manifest).toContain('# Instructions\n\nDo the thing.');
  });
});

describe('parseSkillManifest', () => {
  it('recovers name/description/instructions from a buildSkillManifest output', () => {
    const manifest = buildSkillManifest({
      name: 'good-morning-breakfast',
      description: 'Says good morning',
      instructions: '# Instructions\n\nDo the thing.',
    });

    const { frontmatter, instructions } = parseSkillManifest(manifest);

    expect(frontmatter.name).toBe('good-morning-breakfast');
    expect(frontmatter.description).toBe('Says good morning');
    expect(instructions).toBe('# Instructions\n\nDo the thing.');
  });

  it('preserves an extra field the app never writes', () => {
    const manifest =
      '---\nname: x\ndescription: y\nversion: "1.2.0"\n---\n\nbody';

    const { frontmatter } = parseSkillManifest(manifest);

    expect(frontmatter.version).toBe('1.2.0');
  });

  it('parses a manifest with CRLF line endings', () => {
    const manifest = '---\r\nname: x\r\ndescription: y\r\n---\r\n\r\nbody text';

    const { frontmatter, instructions } = parseSkillManifest(manifest);

    expect(frontmatter.name).toBe('x');
    expect(instructions).toBe('body text');
  });

  it('throws when there is no frontmatter block', () => {
    expect(() => parseSkillManifest('no frontmatter here')).toThrow();
  });
});

describe('buildSkillManifestFromFrontmatter', () => {
  it('reassigns only name/description, preserving other fields', () => {
    const base = { name: 'old-name', description: 'old', version: '2.0.0' };

    const manifest = buildSkillManifestFromFrontmatter(
      base,
      'new-name',
      'new description',
      'instructions body',
    );
    const { frontmatter, instructions } = parseSkillManifest(manifest);

    expect(frontmatter.name).toBe('new-name');
    expect(frontmatter.description).toBe('new description');
    expect(frontmatter.version).toBe('2.0.0');
    expect(instructions).toBe('instructions body');
  });

  it('does not mutate the original frontmatter object', () => {
    const base = { name: 'old-name', description: 'old' };

    buildSkillManifestFromFrontmatter(base, 'new-name', 'new', 'body');

    expect(base.name).toBe('old-name');
  });
});

describe('unpackSkillArchive', () => {
  it('separates the manifest from every other entry', () => {
    const manifest = '---\nname: x\ndescription: y\n---\n\nbody';
    const zipped = zipSync({
      'SKILL.md': strToU8(manifest),
      'agents/analyzer.md': strToU8('analyzer'),
    });

    const { manifestText, files } = unpackSkillArchive(new Uint8Array(zipped));

    expect(manifestText).toBe(manifest);
    expect(files.size).toBe(1);
    expect(new TextDecoder().decode(files.get('agents/analyzer.md'))).toBe(
      'analyzer',
    );
  });

  it('ignores directory-only entries', () => {
    const manifest = '---\nname: x\ndescription: y\n---\n\nbody';
    const zipped = zipSync({
      'SKILL.md': strToU8(manifest),
      'agents/': new Uint8Array(0),
      'agents/analyzer.md': strToU8('analyzer'),
    });

    const { files } = unpackSkillArchive(new Uint8Array(zipped));

    expect([...files.keys()]).toEqual(['agents/analyzer.md']);
  });

  it('throws when there is no root SKILL.md entry', () => {
    const zipped = zipSync({ 'notes.md': strToU8('notes') });

    expect(() => unpackSkillArchive(new Uint8Array(zipped))).toThrow();
  });

  it('round-trips a create-mode-built manifest', () => {
    const manifest = buildSkillManifest({
      name: 'x',
      description: 'y',
      instructions: 'z',
    });
    const zipped = zipSync({ 'SKILL.md': strToU8(manifest) });

    const { manifestText } = unpackSkillArchive(new Uint8Array(zipped));

    expect(manifestText).toBe(manifest);
  });
});
