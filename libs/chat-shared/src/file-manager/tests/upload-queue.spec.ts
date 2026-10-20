import { TransferQueueItemStatus } from '@epam/ai-dial-ui-kit';
import { describe, expect, it } from 'vitest';
import {
  type FileUploadEntry,
  FileUploadFailureReason,
  FileUploadStatus,
} from '../upload-batch';
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
