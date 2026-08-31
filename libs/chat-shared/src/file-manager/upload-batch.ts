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

/** State of an in-progress or just-settled upload batch, as returned by `useDialFileUploadBatch`. */
export interface FileUploadBatchState {
  /** Individual file entries in this batch. */
  files: FileUploadEntry[];
  /** Whether the upload progress modal should be visible. */
  isOpen: boolean;
}
