import { Module } from '@nestjs/common';
import { FilesArchiveDownloadService } from './archive/files-archive-download.service';
import { ArchiveUploadInterceptor } from './archive-upload.interceptor';
import { FilesBatchOperationsService } from './batch/files-batch-operations.service';
import { FilesDownloadService } from './download/files-download.service';
import { FileUploadInterceptor } from './file-upload.interceptor';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FilesFolderService } from './folder/files-folder.service';
import { FilesListingModule } from './listing/files-listing.module';
import { FilesSharingService } from './sharing/files-sharing.service';
import { FilesUploadService } from './upload/files-upload.service';

@Module({
  imports: [FilesListingModule],
  controllers: [FilesController],
  providers: [
    ArchiveUploadInterceptor,
    FileUploadInterceptor,
    FilesService,
    FilesUploadService,
    FilesFolderService,
    FilesDownloadService,
    FilesArchiveDownloadService,
    FilesSharingService,
    FilesBatchOperationsService,
  ],
})
export class FilesModule {}
