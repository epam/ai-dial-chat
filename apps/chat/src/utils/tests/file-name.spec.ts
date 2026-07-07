import { describe, expect, it } from 'vitest';
import { sanitizeFileName, trimFileNameToByteLimit } from '../file-name';

describe('sanitizeFileName', () => {
  it('replaces forbidden chars and preserves extension', () => {
    expect(sanitizeFileName('my:report;2026.pdf')).toBe('my_report_2026.pdf');
  });

  it('preserves extension unchanged', () => {
    expect(sanitizeFileName('data:export.csv')).toBe('data_export.csv');
  });

  it('trims trailing dot from base name', () => {
    expect(sanitizeFileName('archive..tar')).toBe('archive.tar');
  });

  it('handles file with no extension', () => {
    expect(sanitizeFileName('README:')).toBe('README_');
  });

  it('leaves clean names unchanged', () => {
    expect(sanitizeFileName('report_2026-Q1.pdf')).toBe('report_2026-Q1.pdf');
  });

  it('replaces colon in base name', () => {
    expect(sanitizeFileName('my:notes.txt')).toBe('my_notes.txt');
  });

  it('replaces multiple forbidden chars in file with no extension', () => {
    expect(sanitizeFileName('file:name')).toBe('file_name');
  });

  it('treats dotfiles as no-extension (does not strip the leading dot)', () => {
    expect(sanitizeFileName('.gitignore')).toBe('.gitignore');
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
