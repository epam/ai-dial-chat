import { TransferQueueItemStatus } from '@epam/ai-dial-ui-kit';
import { describe, expect, it } from 'vitest';
import { type FileUploadEntry, FileUploadStatus } from '../upload-batch';
import { toUploadQueueItems } from '../upload-queue';

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
});
