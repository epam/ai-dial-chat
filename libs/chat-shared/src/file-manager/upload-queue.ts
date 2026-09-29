import {
  type TransferQueueItem,
  TransferQueueItemStatus,
} from '@epam/ai-dial-ui-kit';
import { type FileUploadEntry, FileUploadStatus } from './upload-batch';

/*
 * Kept out of `upload-batch.ts`, which the root entry re-exports: this is a
 * value import of the kit, so it lives beside the shell in the
 * `./file-manager` entry and a host that never renders the queue never loads it.
 */
const UPLOAD_QUEUE_STATUS: Record<FileUploadStatus, TransferQueueItemStatus> = {
  [FileUploadStatus.Queued]: TransferQueueItemStatus.InProgress,
  [FileUploadStatus.Uploading]: TransferQueueItemStatus.InProgress,
  [FileUploadStatus.Completed]: TransferQueueItemStatus.Success,
  [FileUploadStatus.Failed]: TransferQueueItemStatus.Failed,
  [FileUploadStatus.Cancelled]: TransferQueueItemStatus.Canceled,
};

/** Maps upload entries onto the UI kit's `TransferQueue` rows. */
export const toUploadQueueItems = (
  files: FileUploadEntry[],
): TransferQueueItem[] =>
  files.map((file) => ({
    id: file.id,
    name: file.name,
    status: UPLOAD_QUEUE_STATUS[file.status],
    percent: file.percent,
  }));
