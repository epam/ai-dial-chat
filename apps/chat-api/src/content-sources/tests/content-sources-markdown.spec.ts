import { describe, expect, it } from 'vitest';
import {
  documentTitle,
  extractFirstH1,
  fileNameTitle,
} from '../content-sources-markdown';

describe('extractFirstH1', () => {
  it.each([
    ['# Title\n\nbody', 'Title'],
    ['intro\n\n# Later\n', 'Later'],
    ['# Closed ##\n', 'Closed'],
    ['Setext\n======\n', 'Setext'],
    ['---\ntitle: x\n---\n# After front matter', 'After front matter'],
    [String.fromCharCode(0xfeff) + '# Bom', 'Bom'],
    ['# CRLF\r\nbody', 'CRLF'],
  ])('finds the H1 in %j', (markdown, expected) => {
    expect(extractFirstH1(markdown)).toBe(expected);
  });

  it('ignores headings inside code fences and deeper levels', () => {
    expect(extractFirstH1('```\n# not a title\n```\n## Two\n# Real')).toBe(
      'Real',
    );
    expect(extractFirstH1('~~~\n# no\n~~~\n')).toBeUndefined();
    expect(extractFirstH1('## Only two\n')).toBeUndefined();
  });

  it('is undefined for an empty document', () => {
    expect(extractFirstH1('')).toBeUndefined();
  });
});

describe('titles', () => {
  it('falls back to the file name without extension', () => {
    expect(fileNameTitle('docs/releases/1.2.0.md')).toBe('1.2.0');
    expect(documentTitle('no heading', 'docs/guide.md')).toBe('guide');
    expect(documentTitle('# H', 'docs/guide.md')).toBe('H');
  });
});
