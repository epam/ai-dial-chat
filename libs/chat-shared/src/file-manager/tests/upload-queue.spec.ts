import { TransferQueueItemStatus } from '@epam/ai-dial-ui-kit';
import { describe, expect, it } from 'vitest';
import {
  FileDownloadStatus,
  type FileUploadEntry,
  FileUploadFailureReason,
  FileUploadStatus,
} from '../upload-batch';
import {
  buildTransferQueueLabels,
  parseTransferQueueRowId,
  toTransferQueueItems,
  toTransferQueueRowId,
  toUploadQueueItems,
  TransferQueueRowKind,
} from '../upload-queue';

const entry = (
  status: FileUploadStatus,
  overrides: Partial<FileUploadEntry> = {},
): FileUploadEntry => ({
  id: status,
  name: `${status}.pdf`,
  status,
  ...overrides,
});

describe('toUploadQueueItems', () => {
  it.each([
    [FileUploadStatus.Queued, TransferQueueItemStatus.InProgress],
    [FileUploadStatus.Uploading, TransferQueueItemStatus.InProgress],
    [FileUploadStatus.Completed, TransferQueueItemStatus.Success],
    [FileUploadStatus.Failed, TransferQueueItemStatus.Failed],
    [FileUploadStatus.Cancelled, TransferQueueItemStatus.Canceled],
  ])('maps %s to %s', (status, expected) => {
    expect(toUploadQueueItems([entry(status)])[0].status).toBe(expected);
  });

  it('keeps id, name and percent', () => {
    expect(
      toUploadQueueItems([
        entry(FileUploadStatus.Uploading, {
          id: 'f1',
          name: 'report.pdf',
          percent: 42,
        }),
      ]),
    ).toEqual([
      {
        id: 'f1',
        name: 'report.pdf',
        status: TransferQueueItemStatus.InProgress,
        percent: 42,
      },
    ]);
  });

  it('gives a failed row the host message for its failure reason', () => {
    const [item] = toUploadQueueItems(
      [
        entry(FileUploadStatus.Failed, {
          failureReason: FileUploadFailureReason.Conflict,
        }),
      ],
      { [FileUploadFailureReason.Conflict]: 'Already exists' },
    );

    expect(item.message).toBe('Already exists');
  });

  it('leaves the message unset without a reason or a message for it, so the generic one shows', () => {
    const messages = { [FileUploadFailureReason.Conflict]: 'Already exists' };

    expect(
      toUploadQueueItems([entry(FileUploadStatus.Failed)], messages)[0].message,
    ).toBeUndefined();
    expect(
      toUploadQueueItems(
        [
          entry(FileUploadStatus.Failed, {
            failureReason: FileUploadFailureReason.Unknown,
          }),
        ],
        messages,
      )[0].message,
    ).toBeUndefined();
  });
});

describe('toTransferQueueItems', () => {
  const uploads = {
    isOpen: true,
    files: [entry(FileUploadStatus.Uploading, { id: 'u1', name: 'a.pdf' })],
  };
  const downloads = {
    isOpen: true,
    files: [
      {
        id: 'd1',
        name: 'files.zip',
        status: FileDownloadStatus.Downloading,
        percent: 40,
      },
      {
        id: 'd2',
        name: 'b.pdf',
        status: FileDownloadStatus.Failed,
        failureReason: FileUploadFailureReason.Forbidden,
      },
    ],
  };

  it('lists upload rows first, then download rows, with kind-prefixed ids', () => {
    expect(
      toTransferQueueItems(uploads, downloads).map((item) => item.id),
    ).toEqual(['upload:u1', 'download:d1', 'download:d2']);
  });

  it('maps download statuses and keeps their percent and reason message', () => {
    const [, downloading, failed] = toTransferQueueItems(uploads, downloads, {
      [FileUploadFailureReason.Forbidden]: 'No permission',
    });

    expect(downloading).toMatchObject({
      status: TransferQueueItemStatus.InProgress,
      percent: 40,
    });
    expect(failed).toMatchObject({
      status: TransferQueueItemStatus.Failed,
      message: 'No permission',
    });
  });

  it('is empty without batches', () => {
    expect(toTransferQueueItems(null, null)).toEqual([]);
  });
});

describe('parseTransferQueueRowId', () => {
  it('round-trips a row id back to its kind and entry id', () => {
    expect(
      parseTransferQueueRowId(
        toTransferQueueRowId(TransferQueueRowKind.Download, 'd-1:x'),
      ),
    ).toEqual({ kind: TransferQueueRowKind.Download, entryId: 'd-1:x' });
  });

  it('rejects an id of neither kind', () => {
    expect(parseTransferQueueRowId('other:1')).toBeUndefined();
  });
});

describe('buildTransferQueueLabels', () => {
  const uploadLabels = {
    cancelItemAriaLabel: (name: string) => `Cancel uploading ${name}`,
    itemProgressAriaLabel: (name: string) => `Uploading ${name}`,
    queueProgressAriaLabel: 'Upload progress',
  };
  const downloadLabels = {
    cancelItemAriaLabel: (name: string) => `Cancel downloading ${name}`,
    itemProgressAriaLabel: (name: string) => `Downloading ${name}`,
    queueProgressAriaLabel: 'Download progress',
  };

  it('words each row for its own kind', () => {
    const labels = buildTransferQueueLabels({
      uploadLabels,
      downloadLabels,
      mixedProgressLabel: 'Transfer progress',
      uploadNames: new Set(['a.pdf']),
      downloadNames: new Set(['files.zip']),
    });

    expect(labels?.cancelItemAriaLabel?.('a.pdf')).toBe(
      'Cancel uploading a.pdf',
    );
    expect(labels?.cancelItemAriaLabel?.('files.zip')).toBe(
      'Cancel downloading files.zip',
    );
    expect(labels?.itemProgressAriaLabel?.('files.zip')).toBe(
      'Downloading files.zip',
    );
    expect(labels?.queueProgressAriaLabel).toBe('Transfer progress');
  });

  it('names the aggregate bar for downloads when only downloads run', () => {
    const labels = buildTransferQueueLabels({
      uploadLabels,
      downloadLabels,
      uploadNames: new Set(),
      downloadNames: new Set(['files.zip']),
    });

    expect(labels?.queueProgressAriaLabel).toBe('Download progress');
  });

  it('keeps the upload labels as they are without download rows', () => {
    expect(
      buildTransferQueueLabels({
        uploadLabels,
        downloadLabels,
        uploadNames: new Set(['a.pdf']),
        downloadNames: new Set(),
      }),
    ).toBe(uploadLabels);
  });
});
