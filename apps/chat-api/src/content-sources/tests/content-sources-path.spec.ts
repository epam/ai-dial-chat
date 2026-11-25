import { describe, expect, it } from 'vitest';
import {
  compileIncludeGlob,
  ContentSourcePathError,
  isWithinRoot,
  normalizeContentPath,
  relativeToRoot,
} from '../content-sources-path';

describe('normalizeContentPath', () => {
  it.each([
    ['a/b.md', 'a/b.md'],
    ['./a/b.md', 'a/b.md'],
    ['a/./b.md', 'a/b.md'],
    ['a//b.md', 'a/b.md'],
    ['a/x/../b.md', 'a/b.md'],
    ['100%.md', '100%.md'],
    ['a%20b.md', 'a%20b.md'],
    ['a b/é.md', 'a b/é.md'],
    ['a/dir/', 'a/dir'],
  ])('normalizes %p to %p', (input, expected) => {
    expect(normalizeContentPath(input)).toBe(expected);
  });

  it('gives equivalent spellings one cache key', () => {
    expect(normalizeContentPath('a/./b.md')).toBe(
      normalizeContentPath('a/b.md'),
    );
  });

  it.each([
    '',
    '/etc/passwd',
    'a\\b.md',
    'a\u0000b.md',
    '../x.md',
    'a/../../x.md',
    '..',
    '.',
    'a/..',
  ])('rejects %p', (input) => {
    expect(() => normalizeContentPath(input)).toThrow(ContentSourcePathError);
  });
});

describe('isWithinRoot / relativeToRoot', () => {
  it('matches the root itself and descendants only', () => {
    expect(isWithinRoot('docs/a.md', 'docs')).toBe(true);
    expect(isWithinRoot('docs', 'docs')).toBe(true);
    expect(isWithinRoot('docs-extra/a.md', 'docs')).toBe(false);
    expect(isWithinRoot('other/a.md', 'docs')).toBe(false);
    expect(isWithinRoot('anything/a.md', '')).toBe(true);
  });

  it('computes root-relative paths', () => {
    expect(relativeToRoot('docs/a/b.md', 'docs')).toBe('a/b.md');
    expect(relativeToRoot('a/b.md', '')).toBe('a/b.md');
  });
});

describe('compileIncludeGlob', () => {
  it('matches **/*.md at any depth including the root', () => {
    const re = compileIncludeGlob('**/*.md');
    expect(re.test('a.md')).toBe(true);
    expect(re.test('x/y/a.md')).toBe(true);
    expect(re.test('a.txt')).toBe(false);
    expect(re.test('a.mdx')).toBe(false);
  });

  it('keeps * within a segment and escapes regex characters', () => {
    const re = compileIncludeGlob('notes/*.md');
    expect(re.test('notes/a.md')).toBe(true);
    expect(re.test('notes/x/a.md')).toBe(false);
    expect(compileIncludeGlob('a+b.md').test('a+b.md')).toBe(true);
    expect(compileIncludeGlob('a.md').test('aXmd')).toBe(false);
  });

  it('supports ? and {a,b}', () => {
    expect(compileIncludeGlob('v?.md').test('v1.md')).toBe(true);
    expect(compileIncludeGlob('*.{md,mdx}').test('a.mdx')).toBe(true);
    expect(compileIncludeGlob('*.{md,mdx}').test('a.txt')).toBe(false);
  });
});
