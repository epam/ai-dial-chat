import { describe, expect, it } from 'vitest';
import {
  FileDownloadStatus,
  type FileUploadEntry,
  FileUploadStatus,
  isDownloadInProgress,
  isUploadInProgress,
} from '../upload-batch';

const entry = (
  status: FileUploadStatus,
  overrides: Partial<FileUploadEntry> = {},
): FileUploadEntry => ({
  id: status,
  name: `${status}.pdf`,
  status,
  ...overrides,
});

describe('isUploadInProgress', () => {
  it('is false with no batch', () => {
    expect(isUploadInProgress(null)).toBe(false);
  });

  it.each([FileUploadStatus.Queued, FileUploadStatus.Uploading])(
    'is true while a file is %s',
    (status) => {
      expect(
        isUploadInProgress({
          isOpen: true,
          files: [entry(FileUploadStatus.Completed), entry(status)],
        }),
      ).toBe(true);
    },
  );

  it('is false once every file has settled', () => {
    expect(
      isUploadInProgress({
        isOpen: true,
        files: [
          entry(FileUploadStatus.Completed),
          entry(FileUploadStatus.Failed),
          entry(FileUploadStatus.Cancelled),
        ],
      }),
    ).toBe(false);
  });
});

describe('isDownloadInProgress', () => {
  const download = (status: FileDownloadStatus) => ({
    id: status,
    name: `${status}.zip`,
    status,
  });

  it('is false without a batch', () => {
    expect(isDownloadInProgress(null)).toBe(false);
  });

  it('is true while any download is still downloading', () => {
    expect(
      isDownloadInProgress({
        isOpen: true,
        files: [
          download(FileDownloadStatus.Completed),
          download(FileDownloadStatus.Downloading),
        ],
      }),
    ).toBe(true);
  });

  it('is false once every download settled', () => {
    expect(
      isDownloadInProgress({
        isOpen: true,
        files: [
          download(FileDownloadStatus.Completed),
          download(FileDownloadStatus.Failed),
          download(FileDownloadStatus.Cancelled),
        ],
      }),
    ).toBe(false);
  });
});
