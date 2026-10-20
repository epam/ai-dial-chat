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

/** Lifecycle status of a single download in the download batch. */
export enum FileDownloadStatus {
  Downloading = 'downloading',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

/** Progress state for a single download: one file, or one archive of a selection. */
export interface FileDownloadEntry {
  /** Unique identifier of the download in the batch. */
  id: string;
  /** Display name: the file name, or the archive name (`<folder>.zip` / `files.zip`). */
  name: string;
  /** Current download lifecycle status. */
  status: FileDownloadStatus;
  /** 0–100 while downloading when the total size is known or estimated; unset otherwise. */
  percent?: number;
  /** Why the download failed; set only when `status` is `Failed`. Shares the upload reasons. */
  failureReason?: FileUploadFailureReason;
}

/** State of the download batch kept by `useDialFileMutations`. */
export interface FileDownloadBatchState {
  /** Every download started since the batch was last cleared, settled ones included. */
  files: FileDownloadEntry[];
  /** Whether the download rows should be visible in the transfer queue. */
  isOpen: boolean;
}

/** Returns whether any download in the batch is still in progress. */
export const isDownloadInProgress = (
  batchState: FileDownloadBatchState | null,
): boolean =>
  batchState?.files.some(
    (file) => file.status === FileDownloadStatus.Downloading,
  ) ?? false;

/** Returns whether any file in the batch is still queued or uploading. */
export const isUploadInProgress = (
  batchState: FileUploadBatchState | null,
): boolean =>
  batchState?.files.some(
    (file) =>
      file.status === FileUploadStatus.Queued ||
      file.status === FileUploadStatus.Uploading,
  ) ?? false;
