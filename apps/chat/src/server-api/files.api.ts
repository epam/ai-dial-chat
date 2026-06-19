import type {
  FileMetadataResponseDto,
  FileUploadResponseDto,
  ListFilesResponseDto,
} from '@epam/chat-api-client';
import { filesApi } from './api-client';

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
): Promise<FileUploadResponseDto> =>
  filesApi.uploadFile({ bucket, path, file });

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
