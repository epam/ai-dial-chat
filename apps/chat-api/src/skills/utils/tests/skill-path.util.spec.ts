import { describe, expect, it } from 'vitest';
import {
  isValidSkillRelativePath,
  parseSkillResourceUrl,
  resolveSkillEntryPath,
} from '../skill-path.util';

describe('parseSkillResourceUrl', () => {
  it('parses a well-formed skills/{bucket}/{path} url', () => {
    expect(
      parseSkillResourceUrl('skills/my-bucket/team-a/docs-helper'),
    ).toEqual({ bucket: 'my-bucket', path: 'team-a/docs-helper' });
  });

  it('parses a url with a single-segment path', () => {
    expect(parseSkillResourceUrl('skills/my-bucket/docs-helper')).toEqual({
      bucket: 'my-bucket',
      path: 'docs-helper',
    });
  });

  it('returns null for a non-skills-prefixed url', () => {
    expect(parseSkillResourceUrl('applications/my-bucket/app')).toBeNull();
  });

  it('returns null when the bucket is missing', () => {
    expect(parseSkillResourceUrl('skills/')).toBeNull();
  });

  it('returns null when the path is missing', () => {
    expect(parseSkillResourceUrl('skills/my-bucket/')).toBeNull();
  });

  it('returns null when the bucket segment is empty', () => {
    expect(parseSkillResourceUrl('skills//docs-helper')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseSkillResourceUrl('')).toBeNull();
  });
});

describe('isValidSkillRelativePath', () => {
  it('accepts a simple valid relative path', () => {
    expect(isValidSkillRelativePath('SKILL.md')).toBe(true);
  });

  it('accepts a nested valid relative path', () => {
    expect(isValidSkillRelativePath('scripts/helper.py')).toBe(true);
  });

  it('rejects an empty path', () => {
    expect(isValidSkillRelativePath('')).toBe(false);
  });

  it('rejects an absolute path', () => {
    expect(isValidSkillRelativePath('/etc/passwd')).toBe(false);
  });

  it('rejects a path with an empty segment', () => {
    expect(isValidSkillRelativePath('a//b')).toBe(false);
  });

  it('rejects a path with a . segment', () => {
    expect(isValidSkillRelativePath('a/./b')).toBe(false);
  });

  it('rejects a path with a .. segment', () => {
    expect(isValidSkillRelativePath('../../etc/passwd')).toBe(false);
  });

  it('rejects a Windows drive letter path', () => {
    expect(isValidSkillRelativePath('C:/windows/system32')).toBe(false);
  });

  it('rejects a path containing a backslash', () => {
    expect(isValidSkillRelativePath('a\\b')).toBe(false);
  });

  it('rejects a path containing a NUL byte', () => {
    expect(isValidSkillRelativePath('a\x00b')).toBe(false);
  });

  it('rejects a path containing other control characters', () => {
    expect(isValidSkillRelativePath('a\x1fb')).toBe(false);
  });

  it('rejects the reserved .dial-resource segment', () => {
    expect(isValidSkillRelativePath('.dial-resource')).toBe(false);
  });

  it('rejects the reserved .dial-folder segment nested in a path', () => {
    expect(isValidSkillRelativePath('sub/.dial-folder')).toBe(false);
  });

  it('rejects files as the first path segment', () => {
    expect(isValidSkillRelativePath('files/x')).toBe(false);
  });

  it('rejects v as the first path segment', () => {
    expect(isValidSkillRelativePath('v/x')).toBe(false);
  });

  it('allows files as a non-first path segment', () => {
    expect(isValidSkillRelativePath('assets/files/readme.md')).toBe(true);
  });
});

describe('resolveSkillEntryPath', () => {
  it('flags a trailing-slash entry as a directory', () => {
    expect(resolveSkillEntryPath('assets/')).toEqual({
      isDirectory: true,
      safeRelativePath: null,
    });
  });

  it('returns the safe relative path for a valid file entry', () => {
    expect(resolveSkillEntryPath('SKILL.md')).toEqual({
      isDirectory: false,
      safeRelativePath: 'SKILL.md',
    });
  });

  it('returns a null safe path for a path-traversal entry', () => {
    expect(resolveSkillEntryPath('../../etc/passwd')).toEqual({
      isDirectory: false,
      safeRelativePath: null,
    });
  });

  it('returns a null safe path for a reserved-marker entry', () => {
    expect(resolveSkillEntryPath('.dial-resource')).toEqual({
      isDirectory: false,
      safeRelativePath: null,
    });
  });
});
