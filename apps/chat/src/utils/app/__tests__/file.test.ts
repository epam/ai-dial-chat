import { formatFileSize, isAbsoluteUrl } from '../file';

describe('File utility methods', () => {
  it.each([
    ['http://test.com'],
    ['https://test.com'],
    ['ftp://test.com'],
    ['file://test.com'],
    ['data:some_data'],
    ['//abc/cde'],
  ])('isAbsoluteUrl (%s, %s, %s, %s) returns true', (url) => {
    expect(isAbsoluteUrl(url)).toBe(true);
  });

  it.each([['/test/test1'], ['abc'], ['abc/cde'], ['1/2/3']])(
    'isAbsoluteUrl (%s, %s, %s, %s) returns false',
    (url) => {
      expect(isAbsoluteUrl(url)).toBe(false);
    },
  );

  describe('formatFileSize', () => {
    it('formats bytes to KB correctly when size < 1 MB', () => {
      // 100 KB = 100 * 1024 bytes
      expect(formatFileSize(100 * 1024)).toBe('100 KB');
      // 1 byte -> 1 KB (ceil)
      expect(formatFileSize(1)).toBe('1 KB');
      // 1024 bytes -> 1 KB
      expect(formatFileSize(1024)).toBe('1 KB');
      // 1025 bytes -> 2 KB
      expect(formatFileSize(1025)).toBe('2 KB');
      // 1048575 / 1024 = 1023.999 -> 1024 KB
      expect(formatFileSize(1024 * 1024 - 1)).toBe('1024 KB');
    });

    it('formats bytes to MB correctly when size >= 1 MB', () => {
      // 1 MB
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      // 1.5 MB -> 2 MB (ceil)
      expect(formatFileSize(1.5 * 1024 * 1024)).toBe('2 MB');
      // 100 MB
      expect(formatFileSize(100 * 1024 * 1024)).toBe('100 MB');
    });
  });
});
