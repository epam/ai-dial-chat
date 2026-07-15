import { describe, expect, it } from 'vitest';
import { getNameWithoutExtension } from '../attachment';

describe('getNameWithoutExtension', () => {
  it('removes extension from a file name', () => {
    expect(getNameWithoutExtension('report.pdf')).toBe('report');
  });

  it('keeps hidden files unchanged', () => {
    expect(getNameWithoutExtension('.env')).toBe('.env');
  });

  it('keeps names without extension unchanged', () => {
    expect(getNameWithoutExtension('README')).toBe('README');
  });

  it('uses the last dot for names with multiple dots', () => {
    expect(getNameWithoutExtension('archive.tar.gz')).toBe('archive.tar');
  });

  it('removes trailing dot', () => {
    expect(getNameWithoutExtension('name.')).toBe('name');
  });
});
