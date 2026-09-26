/** Lifecycle status of a single file within an upload batch. */
export enum FileUploadStatus {
  Queued = 'queued',
  Uploading = 'uploading',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

/** Progress state for a single file within an upload batch. */
export interface FileUploadEntry {
  /** Unique identifier of the file in the batch. */
  id: string;
  /** Display name of the file. */
  name: string;
  /** Current upload lifecycle status. */
  status: FileUploadStatus;
  /** 0–100 while uploading when the transport reports byte progress. */
  percent?: number;
}

/** State of the upload queue, as returned by `useDialFileUploadBatch`. */
export interface FileUploadBatchState {
  /** Every file uploaded since the queue was last cleared, settled ones included. */
  files: FileUploadEntry[];
  /** Whether the upload queue should be visible. */
  isOpen: boolean;
}

/** Returns whether any file in the batch is still queued or uploading. */
export const isUploadInProgress = (
  batchState: FileUploadBatchState | null,
): boolean =>
  batchState?.files.some(
    (file) =>
      file.status === FileUploadStatus.Queued ||
      file.status === FileUploadStatus.Uploading,
  ) ?? false;
