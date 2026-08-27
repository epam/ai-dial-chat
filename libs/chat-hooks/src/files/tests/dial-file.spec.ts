import { describe, expect, it } from 'vitest';
import {
  isDialFileId,
  resolveDialFileBucketAndPath,
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
