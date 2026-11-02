import { Injectable } from '@nestjs/common';
import { DiskFileUploadInterceptor } from './disk-file-upload.interceptor';

/** Stages the file of `POST /api/v1/files` to disk, bounded by `FILE_UPLOAD_MAX_BYTES`. */
@Injectable()
export class FileUploadInterceptor extends DiskFileUploadInterceptor {
  protected readonly maxBytesKey = 'FILE_UPLOAD_MAX_BYTES';
  /* Same message Nest's `FileInterceptor` returned, so the 413 body is unchanged. */
  protected readonly tooLargeMessage = 'File too large';
}
