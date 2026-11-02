import { DialFileNodeType } from '@epam/ai-dial-ui-kit';
import { describe, expect, it } from 'vitest';
import {
  FileSelectionKind,
  getFileSelectionKind,
  isDialFileId,
  isDialFolderId,
  resolveDialFileBucketAndPath,
  resolveDialFolderPath,
  resolveRelativeDialFilePath,
} from '../dial-file';

describe('isDialFileId', () => {
  it('recognizes a DIAL file id prefix', () => {
    expect(isDialFileId('files/bucket/report.pdf')).toBe(true);
  });

  it('rejects a non-DIAL URL', () => {
    expect(isDialFileId('https://external.com/file.pdf')).toBe(false);
  });
});

describe('isDialFolderId', () => {
  it('recognizes a DIAL folder id, ignoring a fragment', () => {
    expect(isDialFolderId('files/bucket/New%20folder/')).toBe(true);
    expect(isDialFolderId('files/bucket/New%20folder/#x')).toBe(true);
  });

  it('rejects a DIAL file id and a non-DIAL URL ending with a slash', () => {
    expect(isDialFolderId('files/bucket/report.pdf')).toBe(false);
    expect(isDialFolderId('https://external.com/docs/')).toBe(false);
  });
});

describe('resolveDialFileBucketAndPath', () => {
  it('extracts bucket and decoded path from a valid DIAL file ID', () => {
    expect(
      resolveDialFileBucketAndPath('files/my-bucket/reports/q1.pdf'),
    ).toEqual({ bucket: 'my-bucket', path: 'reports/q1.pdf' });
  });

  it('decodes a percent-encoded path segment', () => {
    expect(
      resolveDialFileBucketAndPath('files/my-bucket/folder%2Fname.pdf'),
    ).toEqual({ bucket: 'my-bucket', path: 'folder/name.pdf' });
  });

  it('returns undefined for a non-DIAL URL', () => {
    expect(
      resolveDialFileBucketAndPath('https://external.com/file.pdf'),
    ).toBeUndefined();
  });

  it('returns undefined when there is no path segment after the bucket', () => {
    expect(resolveDialFileBucketAndPath('files/only-bucket')).toBeUndefined();
  });
});

describe('resolveRelativeDialFilePath', () => {
  it('strips the files/{bucket}/ prefix from a DIAL file ID', () => {
    expect(
      resolveRelativeDialFilePath(
        'files/my-bucket/reports/q1.pdf',
        'my-bucket',
      ),
    ).toBe('reports/q1.pdf');
  });

  it('decodes percent-encoded path segments', () => {
    expect(
      resolveRelativeDialFilePath(
        'files/my-bucket/folder%2Fname.pdf',
        'my-bucket',
      ),
    ).toBe('folder/name.pdf');
  });

  it('returns relative paths unchanged', () => {
    expect(resolveRelativeDialFilePath('reports/q1.pdf', 'my-bucket')).toBe(
      'reports/q1.pdf',
    );
  });
});

describe('getFileSelectionKind', () => {
  it('tells one file from one folder', () => {
    expect(getFileSelectionKind([{ nodeType: DialFileNodeType.ITEM }])).toBe(
      FileSelectionKind.File,
    );
    expect(getFileSelectionKind([{ nodeType: DialFileNodeType.FOLDER }])).toBe(
      FileSelectionKind.Folder,
    );
  });

  it('treats several items as multiple', () => {
    expect(
      getFileSelectionKind([
        { nodeType: DialFileNodeType.ITEM },
        { nodeType: DialFileNodeType.FOLDER },
      ]),
    ).toBe(FileSelectionKind.Multiple);
  });
});

describe('resolveDialFolderPath', () => {
  it('builds a files path in the given bucket with a trailing slash', () => {
    expect(resolveDialFolderPath({ id: '/docs/reports' }, 'b1')).toBe(
      'files/b1/docs/reports/',
    );
  });

  it("prefers the folder's own bucket and keeps an existing files path", () => {
    expect(resolveDialFolderPath({ id: 'docs', bucket: 'shared' }, 'b1')).toBe(
      'files/shared/docs/',
    );
    expect(resolveDialFolderPath({ url: 'files/b2/x/' }, 'b1')).toBe(
      'files/b2/x/',
    );
  });

  it('drops dot segments', () => {
    expect(resolveDialFolderPath({ id: 'a/../b/./c' }, 'b1')).toBe(
      'files/b1/a/b/c/',
    );
  });

  it('returns null without a url or id', () => {
    expect(resolveDialFolderPath({}, 'b1')).toBeNull();
  });
});
