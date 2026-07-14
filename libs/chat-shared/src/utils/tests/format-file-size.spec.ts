import { describe, expect, it } from 'vitest';
import { formatFileSize } from '../format-file-size';

describe('formatFileSize', () => {
  it('formats bytes under 1 KB as bytes', () => {
    expect(formatFileSize(512)).toBe('512 B');
  });

  it('formats kilobytes, rounding to 1 decimal only when not a whole number', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1024 * 840)).toBe('840 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1024 * 1024 * 2.4)).toBe('2.4 MB');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(1024 * 1024 * 1024 * 1.2)).toBe('1.2 GB');
  });

  it('formats zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });
});
