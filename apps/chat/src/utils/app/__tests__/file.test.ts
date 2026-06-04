import { describe, expect, it } from 'vitest';

import { getUtf8BytesLength } from '@/src/utils/app/common';

import { DEFAULT_RESOURCE_MAX_SEGMENT_BYTES } from '@/src/constants/default-ui-settings';
import { TEMP_FILE_NAME_IN_FILE_MANAGER } from '@/src/constants/file';

import {
  formatFileSize,
  getNestedEmptyFolderIdsForChosenParent,
  isAbsoluteUrl,
  isPathUnderPrefix,
  prepareFileName,
  withoutFileManagerPlaceholderByName,
} from '../file';

describe('File utility methods', () => {
  describe('isPathUnderPrefix', () => {
    it('returns true for exact match ignoring trailing slashes', () => {
      expect(isPathUnderPrefix('files/bucket/a', 'files/bucket/a')).toBe(true);
      expect(isPathUnderPrefix('files/bucket/a/', 'files/bucket/a')).toBe(true);
      expect(isPathUnderPrefix('files/bucket/a', 'files/bucket/a/')).toBe(true);
    });

    it('returns true only for strict path descendants', () => {
      expect(
        isPathUnderPrefix(
          'files/bucket/parent/zip/nested/file.txt',
          'files/bucket/parent/zip',
        ),
      ).toBe(true);
      expect(
        isPathUnderPrefix(
          'files/bucket/parent/zip/nested',
          'files/bucket/parent/zip',
        ),
      ).toBe(true);
    });

    it('does not match sibling path segments (foo vs foobar)', () => {
      expect(
        isPathUnderPrefix(
          'files/bucket/parent/foobar',
          'files/bucket/parent/foo',
        ),
      ).toBe(false);
    });

    it('returns false for empty path or prefix', () => {
      expect(isPathUnderPrefix('', 'files/a')).toBe(false);
      expect(isPathUnderPrefix('files/a', '')).toBe(false);
    });
  });

  describe('withoutFileManagerPlaceholderByName', () => {
    it('removes placeholder by exact name', () => {
      const items = [
        { id: '1', name: 'real' },
        { id: '2', name: TEMP_FILE_NAME_IN_FILE_MANAGER },
        { id: '3', name: '.other' },
      ];
      expect(withoutFileManagerPlaceholderByName(items)).toEqual([
        { id: '1', name: 'real' },
        { id: '3', name: '.other' },
      ]);
    });

    it('removes application-like rows when last path segment is .dial_folder or variant', () => {
      const marker = `${TEMP_FILE_NAME_IN_FILE_MANAGER}__`;
      const items = [
        {
          id: 'applications/public/111/real-app',
          name: 'applications/public/111/real-app',
        },
        {
          id: `applications/public/111/${marker}`,
          name: `applications/public/111/${marker}`,
        },
      ];
      expect(withoutFileManagerPlaceholderByName(items)).toEqual([items[0]]);
    });

    it('removes toolset-like rows when id ends with .dial_folder variant', () => {
      const marker = `${TEMP_FILE_NAME_IN_FILE_MANAGER}__`;
      const items = [
        { id: 'toolsets/public/123/my-tool', name: 'My tool' },
        { id: `toolsets/public/123/${marker}`, name: 'ignored' },
      ];
      expect(withoutFileManagerPlaceholderByName(items)).toEqual([items[0]]);
    });

    it('removes row when only id tail is a placeholder', () => {
      const marker = `${TEMP_FILE_NAME_IN_FILE_MANAGER}__`;
      expect(
        withoutFileManagerPlaceholderByName([
          { id: `toolsets/public/99/${marker}`, name: 'Visible name' },
        ]),
      ).toEqual([]);
    });
  });

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

  describe('prepareFileName', () => {
    it('preserves extension while sanitizing invalid symbols in file name', () => {
      expect(prepareFileName('  ab,c.txt  ')).toBe('ab_c.txt');
    });

    it('truncates the stem before the extension to fit the configured segment bytes', () => {
      const result = prepareFileName(
        'test.test.testtest.testtest.testtesttesttesttesttesttesttest.testtest.testtest.testtest.testtest.testtest.testtest.testtest.testtest.testtest.testtest.testtest.testtesttesttest.json',
      );

      expect(getUtf8BytesLength(result)).toBeLessThanOrEqual(
        DEFAULT_RESOURCE_MAX_SEGMENT_BYTES,
      );
      expect(result.endsWith('.json')).toBe(true);
    });

    it('trims trailing dots from the full file name result', () => {
      expect(prepareFileName('report....')).toBe('report');
    });

    it('keeps file names without extension after sanitization', () => {
      expect(prepareFileName('  bad,name  ')).toBe('bad_name');
    });

    it('keeps file names with dot after sanitization', () => {
      expect(prepareFileName('test..json')).toBe('test..json');
    });
  });

  describe('getNestedEmptyFolderIdsForChosenParent', () => {
    it('maps matching empty folder ids to trailing-slash markers under parent', () => {
      expect(
        getNestedEmptyFolderIdsForChosenParent(
          ['bucket/files/f1', 'bucket/files/f1/sub'],
          'bucket/files/f1',
        ),
      ).toEqual(['bucket/files/f1/', 'bucket/files/f1/sub/']);
    });

    it('returns empty array when no empty folder is under parent', () => {
      expect(
        getNestedEmptyFolderIdsForChosenParent(
          ['bucket/files/other'],
          'bucket/files/f1',
        ),
      ).toEqual([]);
    });

    it('includes descendants when parent matches path prefix', () => {
      expect(
        getNestedEmptyFolderIdsForChosenParent(
          ['root/a', 'root/a/nested'],
          'root',
        ),
      ).toEqual(['root/a/', 'root/a/nested/']);
    });

    it('does not match folders whose names share a prefix but are distinct', () => {
      expect(
        getNestedEmptyFolderIdsForChosenParent(
          ['bucket/files/folder01', 'bucket/files/folder0101'],
          'bucket/files/folder01',
        ),
      ).toEqual(['bucket/files/folder01/']);
    });
  });
});
