import { Injectable } from '@nestjs/common';
import { DiskFileUploadInterceptor } from './disk-file-upload.interceptor';

/** Stages the ZIP archive of `POST /api/v1/files/upload-archive` to disk, bounded by `ARCHIVE_UPLOAD_MAX_BYTES`. */
@Injectable()
export class ArchiveUploadInterceptor extends DiskFileUploadInterceptor {
  protected readonly maxBytesKey = 'ARCHIVE_UPLOAD_MAX_BYTES';
  protected readonly tooLargeMessage = 'Archive payload too large';
}
