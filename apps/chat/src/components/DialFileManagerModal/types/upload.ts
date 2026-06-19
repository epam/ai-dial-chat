export enum FileUploadStatus {
  Queued = 'queued',
  Uploading = 'uploading',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export interface FileUploadEntry {
  id: string;
  name: string;
  status: FileUploadStatus;
  /** 0–100 while uploading when the transport reports byte progress. */
  percent?: number;
}

export interface FileUploadBatchState {
  files: FileUploadEntry[];
  isOpen: boolean;
}
