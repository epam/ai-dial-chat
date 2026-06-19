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
}

export interface FileUploadBatchState {
  files: FileUploadEntry[];
  isOpen: boolean;
}
