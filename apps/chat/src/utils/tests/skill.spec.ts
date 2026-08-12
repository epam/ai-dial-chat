import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  SKILL_MANIFEST_FILE,
  buildSkillArchive,
  buildSkillManifest,
  isValidSkillRelativePath,
  normalizeSkillName,
} from '../skill';

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

const readBlobAsBytes = (blob: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

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

describe('buildSkillArchive', () => {
  it('contains exactly the manifest and supporting files, with SKILL.md at the root', async () => {
    const manifest = '---\nname: x\ndescription: y\n---\n\nz';
    const blob = buildSkillArchive(manifest, [
      { path: 'agents/analyzer.md', data: encode('analyzer') },
      { path: 'assets/logo.png', data: encode('logo') },
    ]);

    const bytes = await readBlobAsBytes(blob);
    const unzipped = unzipSync(bytes);

    expect(Object.keys(unzipped).sort()).toEqual(
      ['SKILL.md', 'agents/analyzer.md', 'assets/logo.png'].sort(),
    );
    expect(strFromU8(unzipped[SKILL_MANIFEST_FILE])).toBe(manifest);
    expect(strFromU8(unzipped['agents/analyzer.md'])).toBe('analyzer');
  });
});
