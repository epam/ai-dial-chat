import { Injectable } from '@nestjs/common';
import type { ArchiveDownloadResult } from './archive/files-archive-download.service';
import { FilesArchiveDownloadService } from './archive/files-archive-download.service';
import { FilesBatchOperationsService } from './batch/files-batch-operations.service';
import { FilesDownloadService } from './download/files-download.service';
import type { CopyFilesResponseDto, CopyItemDto } from './dto/copy-files.dto';
import type { CreateFolderResponseDto } from './dto/create-folder.dto';
import type {
  DeleteFilesResponseDto,
  DeleteItemDto,
} from './dto/delete-files.dto';
import type {
  DiscardSharedItemDto,
  DiscardSharedResponseDto,
} from './dto/discard-shared.dto';
import type { ArchiveItemDto } from './dto/download-archive.dto';
import type { FileMetadataResponseDto } from './dto/file-metadata-response.dto';
import type { ListFilesResponseDto } from './dto/list-files.dto';
import type { MoveFilesResponseDto, MoveItemDto } from './dto/move-files.dto';
import type {
  RenameFilesResponseDto,
  RenameItemDto,
} from './dto/rename-files.dto';
import type {
  RevokeAccessItemDto,
  RevokeAccessResponseDto,
} from './dto/revoke-access.dto';
import type { UploadArchiveResponseDto } from './dto/upload-archive.dto';
import type { FileUploadResponseDto } from './dto/upload-file-response.dto';
import type { UploadMode } from './dto/upload-file.dto';
import { FilesFolderService } from './folder/files-folder.service';
import { FilesListingService } from './listing/files-listing.service';
import { FilesSharingService } from './sharing/files-sharing.service';
import type {
  UploadedArchiveFile,
  UploadedFile,
} from './upload/files-upload.service';
import { FilesUploadService } from './upload/files-upload.service';

/**
 * Thin facade preserving the public API `FilesController` calls into.
 * All business logic lives in the single-concern services under
 * `apps/chat-api/src/files/{listing,upload,folder,download,archive,sharing,batch}/`
 * — see `files-service-decomposition` capability for the ownership map.
 */
@Injectable()
export class FilesService {
  constructor(
    private readonly filesListingService: FilesListingService,
    private readonly filesUploadService: FilesUploadService,
    private readonly filesFolderService: FilesFolderService,
    private readonly filesDownloadService: FilesDownloadService,
    private readonly filesArchiveDownloadService: FilesArchiveDownloadService,
    private readonly filesSharingService: FilesSharingService,
    private readonly filesBatchOperationsService: FilesBatchOperationsService,
  ) {}

  uploadFile(
    bucket: string,
    path: string,
    file: UploadedFile,
    token: string,
    uploadMode?: UploadMode,
  ): Promise<FileUploadResponseDto> {
    return this.filesUploadService.uploadFile(
      bucket,
      path,
      file,
      token,
      uploadMode,
    );
  }

  uploadArchive(
    bucket: string,
    destinationPath: string,
    archiveFile: UploadedArchiveFile,
    token: string,
  ): Promise<UploadArchiveResponseDto> {
    return this.filesUploadService.uploadArchive(
      bucket,
      destinationPath,
      archiveFile,
      token,
    );
  }

  listFiles(
    bucket: string,
    path: string | undefined,
    query: {
      token?: string;
      limit?: number;
      recursive?: boolean;
      permissions?: boolean;
    },
    at: string,
  ): Promise<ListFilesResponseDto> {
    return this.filesListingService.listFiles(bucket, path, query, at);
  }

  listPublicFiles(
    query: {
      path?: string;
      token?: string;
      limit?: number;
      recursive?: boolean;
    },
    at: string,
  ): Promise<ListFilesResponseDto> {
    return this.filesListingService.listPublicFiles(query, at);
  }

  listSharedFiles(
    query: { path?: string; token?: string; limit?: number },
    at: string,
  ): Promise<ListFilesResponseDto> {
    return this.filesListingService.listSharedFiles(query, at);
  }

  listSharedByMe(bucket: string, at: string): Promise<ListFilesResponseDto> {
    return this.filesListingService.listSharedByMe(bucket, at);
  }

  getFileMetadata(
    bucket: string,
    path: string,
    token: string,
  ): Promise<FileMetadataResponseDto> {
    return this.filesListingService.getFileMetadata(bucket, path, token);
  }

  createFolder(
    bucket: string,
    parentPath: string,
    name: string,
    at: string,
  ): Promise<CreateFolderResponseDto> {
    return this.filesFolderService.createFolder(bucket, parentPath, name, at);
  }

  downloadFile(
    bucket: string,
    path: string,
    token: string,
  ): Promise<{ stream: ReadableStream; headers: Record<string, string> }> {
    return this.filesDownloadService.downloadFile(bucket, path, token);
  }

  downloadArchive(
    items: ArchiveItemDto[],
    at: string,
  ): Promise<ArchiveDownloadResult> {
    return this.filesArchiveDownloadService.downloadArchive(items, at);
  }

  deleteFiles(
    items: DeleteItemDto[],
    at: string,
  ): Promise<DeleteFilesResponseDto> {
    return this.filesBatchOperationsService.deleteFiles(items, at);
  }

  renameFiles(
    items: RenameItemDto[],
    at: string,
  ): Promise<RenameFilesResponseDto> {
    return this.filesBatchOperationsService.renameFiles(items, at);
  }

  copyFiles(items: CopyItemDto[], at: string): Promise<CopyFilesResponseDto> {
    return this.filesBatchOperationsService.copyFiles(items, at);
  }

  moveFiles(items: MoveItemDto[], at: string): Promise<MoveFilesResponseDto> {
    return this.filesBatchOperationsService.moveFiles(items, at);
  }

  revokeAccess(
    items: RevokeAccessItemDto[],
    at: string,
  ): Promise<RevokeAccessResponseDto> {
    return this.filesSharingService.revokeAccess(items, at);
  }

  discardShared(
    items: DiscardSharedItemDto[],
    at: string,
  ): Promise<DiscardSharedResponseDto> {
    return this.filesSharingService.discardShared(items, at);
  }
}
