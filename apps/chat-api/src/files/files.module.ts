import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { EnvironmentVariables } from '../config/environment.config';
import { FilesArchiveDownloadService } from './archive/files-archive-download.service';
import { ArchiveUploadInterceptor } from './archive-upload.interceptor';
import { FilesBatchOperationsService } from './batch/files-batch-operations.service';
import { FilesDownloadService } from './download/files-download.service';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FilesFolderService } from './folder/files-folder.service';
import { FilesListingService } from './listing/files-listing.service';
import { FilesSharingService } from './sharing/files-sharing.service';
import { FilesUploadService } from './upload/files-upload.service';

@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables>) => ({
        storage: memoryStorage(),
        limits: {
          fileSize: config.get<number>('FILE_UPLOAD_MAX_BYTES') ?? 536_870_912,
        },
      }),
    }),
  ],
  controllers: [FilesController],
  providers: [
    ArchiveUploadInterceptor,
    FilesService,
    FilesListingService,
    FilesUploadService,
    FilesFolderService,
    FilesDownloadService,
    FilesArchiveDownloadService,
    FilesSharingService,
    FilesBatchOperationsService,
  ],
})
export class FilesModule {}
