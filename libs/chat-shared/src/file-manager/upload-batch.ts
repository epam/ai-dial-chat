/** Lifecycle status of a single file within an upload batch. */
export enum FileUploadStatus {
  Queued = 'queued',
  Uploading = 'uploading',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

/** Why a file in an upload batch failed, derived from the upload response. */
export enum FileUploadFailureReason {
  /** A file with this name already exists at the destination (HTTP 409). */
  Conflict = 'conflict',
  /** The file is larger than the server accepts (HTTP 413). */
  TooLarge = 'tooLarge',
  /** The user may not write to the destination (HTTP 403). */
  Forbidden = 'forbidden',
  /** The file service behind the API is unavailable (HTTP 502/503). */
  Unavailable = 'unavailable',
  /** The request never got a response, e.g. the connection dropped. */
  Network = 'network',
  /** Any other failure. */
  Unknown = 'unknown',
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
  /** Why the upload failed; set only when `status` is `Failed`. */
  failureReason?: FileUploadFailureReason;
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
