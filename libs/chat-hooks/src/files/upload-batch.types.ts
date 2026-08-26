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
  id: string;
  name: string;
  status: FileUploadStatus;
  /** 0–100 while uploading when the transport reports byte progress. */
  percent?: number;
}

/** State of an in-progress or just-settled upload batch, as returned by `useDialFileUploadBatch`. */
export interface FileUploadBatchState {
  files: FileUploadEntry[];
  isOpen: boolean;
}
