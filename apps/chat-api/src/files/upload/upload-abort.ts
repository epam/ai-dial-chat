import { ServiceUnavailableException } from '@nestjs/common';

/*
 * Shared by the single-file transport (`FilesUploadService.uploadFileStream`)
 * and the archive pipeline (`FilesArchiveUploadService`). The message predates
 * the split and is kept for single-file uploads too, so they report an
 * already-aborted signal exactly as before.
 */
export const throwIfUploadAborted = (signal: AbortSignal): void => {
  if (signal.aborted) {
    throw new ServiceUnavailableException('Archive upload timed out');
  }
};
