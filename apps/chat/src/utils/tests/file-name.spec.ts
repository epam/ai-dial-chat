import { describe, expect, it } from 'vitest';
import { sanitizeFileName } from '../file-name';

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
