import type {
  ArchiveItemDto,
  CreateFolderDto,
  CreateFolderResponseDto,
  DeleteFilesResponseDto,
  DeleteItemDto,
  FileMetadataResponseDto,
  FileUploadResponseDto,
  ListFilesResponseDto,
  ListPublicFilesRequest,
  ListSharedFilesRequest,
  RenameFilesResponseDto,
  RenameItemDto,
} from '@epam/chat-api-client';
import { filesApi } from './api-client';
import {
  type UploadFileWithProgressOptions,
  uploadFileWithProgress,
} from './upload-file-with-progress';

export type UploadFileOptions = UploadFileWithProgressOptions;

const resolveUploadOptions = (
  options?: AbortSignal | UploadFileOptions,
): UploadFileOptions =>
  options instanceof AbortSignal ? { signal: options } : (options ?? {});

export const listPublicFiles = (
  params: ListPublicFilesRequest,
): Promise<ListFilesResponseDto> => filesApi.listPublicFiles(params);

export const listSharedFiles = (
  params: ListSharedFilesRequest,
): Promise<ListFilesResponseDto> => filesApi.listSharedFiles(params);

export const listFiles = (params: {
  bucket: string;
  path?: string;
  token?: string;
  limit?: number;
  recursive?: boolean;
  permissions?: boolean;
}): Promise<ListFilesResponseDto> => filesApi.listFiles(params);

export const uploadFile = (
  bucket: string,
  path: string,
  file: File,
  options?: AbortSignal | UploadFileOptions,
): Promise<FileUploadResponseDto> => {
  const { signal, onProgress, uploadMode } = resolveUploadOptions(options);

  if (onProgress != null) {
    return uploadFileWithProgress(bucket, path, file, {
      signal,
      onProgress,
      uploadMode,
    });
  }

  return filesApi.uploadFile(
    { bucket, path, file, uploadMode },
    signal ? { signal } : undefined,
  );
};

export const getFileMetadata = (params: {
  bucket: string;
  path: string;
}): Promise<FileMetadataResponseDto> => filesApi.getFileMetadata(params);

// downloadFileRaw() is used instead of downloadFile() because the generator
// emits `Blob | void` for application/octet-stream responses, which loses stream
// semantics. The raw method returns the native fetch Response whose `.body` is a
// ReadableStream and whose `.blob()` buffers the full content when needed.
export const downloadFile = async (
  bucket: string,
  path: string,
): Promise<Response> => {
  const raw = await filesApi.downloadFileRaw({ bucket, path });
  return raw.raw;
};

export const createFolder = (
  params: CreateFolderDto,
): Promise<CreateFolderResponseDto> =>
  filesApi.createFolder({ createFolderDto: params });

export const deleteFiles = (
  items: DeleteItemDto[],
): Promise<DeleteFilesResponseDto> =>
  filesApi.deleteFiles({ deleteFilesDto: { items } });

export const renameFiles = (
  items: RenameItemDto[],
): Promise<RenameFilesResponseDto> =>
  filesApi.renameFiles({ renameFilesDto: { items } });

// downloadArchiveRaw() is used instead of downloadArchive() for the same reason
// as downloadFileRaw() above — binary response semantics require the raw fetch Response.
export const downloadArchive = async (
  items: ArchiveItemDto[],
): Promise<Response> => {
  const raw = await filesApi.downloadArchiveRaw({
    downloadArchiveDto: { items },
  });
  return raw.raw;
};
