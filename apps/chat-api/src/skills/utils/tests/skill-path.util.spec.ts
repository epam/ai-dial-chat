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

  it.each([
    [
      'returns null for a non-skills-prefixed url',
      { url: 'applications/my-bucket/app' },
    ],
    ['returns null when the bucket is missing', { url: 'skills/' }],
    ['returns null when the path is missing', { url: 'skills/my-bucket/' }],
    [
      'returns null when the bucket segment is empty',
      { url: 'skills//docs-helper' },
    ],
    ['returns null for an empty string', { url: '' }],
  ])('%s', (_name, { url }) => {
    expect(parseSkillResourceUrl(url)).toBeNull();
  });
});

describe('isValidSkillRelativePath', () => {
  it.each([
    ['accepts a simple valid relative path', { path: 'SKILL.md' }],
    ['accepts a nested valid relative path', { path: 'scripts/helper.py' }],
    [
      'accepts a .dial_folder marker path so Core-exported archives re-import',
      { path: 'docs/.dial_folder' },
    ],
    [
      'allows files as a non-first path segment',
      { path: 'assets/files/readme.md' },
    ],
  ])('%s', (_name, { path }) => {
    expect(isValidSkillRelativePath(path)).toBe(true);
  });

  it.each([
    ['rejects an empty path', { path: '' }],
    ['rejects an absolute path', { path: '/etc/passwd' }],
    ['rejects a path with an empty segment', { path: 'a//b' }],
    ['rejects a path with a . segment', { path: 'a/./b' }],
    ['rejects a path with a .. segment', { path: '../../etc/passwd' }],
    ['rejects a Windows drive letter path', { path: 'C:/windows/system32' }],
    ['rejects a path containing a backslash', { path: 'a\\b' }],
    ['rejects a path containing a NUL byte', { path: 'a\x00b' }],
    ['rejects a path containing other control characters', { path: 'a\x1fb' }],
    ['rejects the reserved .dial-resource segment', { path: '.dial-resource' }],
    [
      'rejects the reserved .dial-folder segment nested in a path',
      { path: 'sub/.dial-folder' },
    ],
    ['rejects files as the first path segment', { path: 'files/x' }],
    ['rejects v as the first path segment', { path: 'v/x' }],
  ])('%s', (_name, { path }) => {
    expect(isValidSkillRelativePath(path)).toBe(false);
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
