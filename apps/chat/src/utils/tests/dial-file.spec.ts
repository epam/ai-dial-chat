import { describe, expect, it } from 'vitest';
import {
  resolveDialFileDownloadUrl,
  resolveDialFileMetadataUrl,
} from '../dial-file';

describe('resolveDialFileDownloadUrl', () => {
  it('builds a /api/v1/files/download URL from a files/{bucket}/{path} id', () => {
    expect(
      resolveDialFileDownloadUrl('files/bucket-1/generated/report.txt'),
    ).toBe(
      '/api/v1/files/download?bucket=bucket-1&path=generated%2Freport.txt',
    );
  });

  it('returns undefined when the input is not a files/ id', () => {
    expect(
      resolveDialFileDownloadUrl('https://example.com/report.txt'),
    ).toBeUndefined();
  });
});

describe('resolveDialFileMetadataUrl', () => {
  it('builds a /api/v1/files/metadata URL from a files/{bucket}/{path} id', () => {
    expect(
      resolveDialFileMetadataUrl('files/bucket-1/generated/report.txt'),
    ).toBe(
      '/api/v1/files/metadata?bucket=bucket-1&path=generated%2Freport.txt',
    );
  });

  it('returns undefined when the input is not a files/ id', () => {
    expect(
      resolveDialFileMetadataUrl('https://example.com/report.txt'),
    ).toBeUndefined();
  });
});
