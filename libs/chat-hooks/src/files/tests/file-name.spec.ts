import { describe, expect, it } from 'vitest';
import {
  sanitizeFileName,
  splitFileNameExtension,
  trimFileNameToByteLimit,
} from '../file-name';

describe('splitFileNameExtension', () => {
  it.each([
    [
      'splits a name with an extension',
      { name: 'report.pdf', expected: { base: 'report', extension: '.pdf' } },
    ],
    [
      'treats only the last dot as the extension separator',
      {
        name: 'archive.tar.gz',
        expected: { base: 'archive.tar', extension: '.gz' },
      },
    ],
    [
      'returns an empty extension for a name with no dot',
      { name: 'README', expected: { base: 'README', extension: '' } },
    ],
    [
      'treats a leading dot as part of the base name, not an extension',
      { name: '.gitignore', expected: { base: '.gitignore', extension: '' } },
    ],
  ])('%s', (_name, { name, expected }) => {
    expect(splitFileNameExtension(name)).toEqual(expected);
  });
});

describe('sanitizeFileName', () => {
  it.each([
    [
      'replaces forbidden chars and preserves extension',
      { name: 'my:report;2026.pdf', expected: 'my_report_2026.pdf' },
    ],
    [
      'preserves extension unchanged',
      { name: 'data:export.csv', expected: 'data_export.csv' },
    ],
    [
      'trims trailing dot from base name',
      { name: 'archive..tar', expected: 'archive.tar' },
    ],
    [
      'handles file with no extension',
      { name: 'README:', expected: 'README_' },
    ],
    [
      'leaves clean names unchanged',
      { name: 'report_2026-Q1.pdf', expected: 'report_2026-Q1.pdf' },
    ],
    [
      'replaces colon in base name',
      { name: 'my:notes.txt', expected: 'my_notes.txt' },
    ],
    [
      'replaces multiple forbidden chars in file with no extension',
      { name: 'file:name', expected: 'file_name' },
    ],
    [
      'treats dotfiles as no-extension (does not strip the leading dot)',
      { name: '.gitignore', expected: '.gitignore' },
    ],
  ])('%s', (_name, { name, expected }) => {
    expect(sanitizeFileName(name)).toBe(expected);
  });
});

describe('trimFileNameToByteLimit', () => {
  it('returns the name unchanged when it fits within the limit', () => {
    expect(trimFileNameToByteLimit('report.pdf', 255)).toBe('report.pdf');
  });

  it('trims ASCII name at character boundary', () => {
    const name = 'a'.repeat(260) + '.pdf';
    const result = trimFileNameToByteLimit(name, 255);
    expect(new TextEncoder().encode(result).length).toBeLessThanOrEqual(255);
    expect(result.endsWith('.pdf')).toBe(true);
  });

  it('preserves extension when trimming CJK characters (3 bytes each)', () => {
    const cjkName = '文'.repeat(100) + '.pdf';
    const result = trimFileNameToByteLimit(cjkName, 255);
    const byteLen = new TextEncoder().encode(result).length;
    expect(byteLen).toBeLessThanOrEqual(255);
    expect(result.endsWith('.pdf')).toBe(true);
  });

  it('preserves extension when trimming emoji (4 bytes each)', () => {
    const emojiName = '😀'.repeat(70) + '.txt';
    const result = trimFileNameToByteLimit(emojiName, 255);
    const byteLen = new TextEncoder().encode(result).length;
    expect(byteLen).toBeLessThanOrEqual(255);
    expect(result.endsWith('.txt')).toBe(true);
  });

  it('does not cut in the middle of a multi-byte sequence', () => {
    const name = '日'.repeat(85) + 'x.pdf';
    const result = trimFileNameToByteLimit(name, 255);
    expect(() => decodeURIComponent(encodeURIComponent(result))).not.toThrow();
  });

  it('trims without extension when name has no dot', () => {
    const name = 'x'.repeat(300);
    const result = trimFileNameToByteLimit(name, 255);
    expect(new TextEncoder().encode(result).length).toBeLessThanOrEqual(255);
  });
});
