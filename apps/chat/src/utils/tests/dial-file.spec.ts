import {
  AttachmentType,
  RequestStatus,
  type DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  resolveDialFileDownloadUrl,
  resolveDialFileMetadataUrl,
  resolveDialUrl,
} from '../dial-file';

const makeAttachment = (
  overrides: Partial<DisplayAttachment>,
): DisplayAttachment => ({
  id: 'attachment-1',
  name: 'report.txt',
  contentType: 'text/plain',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  ...overrides,
});

describe('resolveDialUrl', () => {
  it('resolves a file id to its download URL', () => {
    expect(
      resolveDialUrl(makeAttachment({ url: 'files/bucket-1/docs/report.txt' })),
    ).toBe('/api/v1/files/download?bucket=bucket-1&path=docs%2Freport.txt');
  });

  it('returns undefined for a folder id, which has no download', () => {
    expect(
      resolveDialUrl(
        makeAttachment({
          name: 'New folder',
          url: 'files/bucket-1/New%20folder/',
        }),
      ),
    ).toBeUndefined();
  });

  it('falls back to a file referenceUrl when url is a folder id', () => {
    expect(
      resolveDialUrl(
        makeAttachment({
          url: 'files/bucket-1/docs/',
          referenceUrl: 'files/bucket-1/docs/report.txt#page=2',
        }),
      ),
    ).toBe('/api/v1/files/download?bucket=bucket-1&path=docs%2Freport.txt');
  });
});

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
