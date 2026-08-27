import type {
  ArchiveItemDto,
  CopyFilesResponseDto,
  CopyItemDto,
  CreateFolderDto,
  CreateFolderResponseDto,
  DeleteFilesResponseDto,
  DeleteItemDto,
  DiscardSharedItemDto,
  DiscardSharedResponseDto,
  FileMetadataResponseDto,
  FileUploadResponseDto,
  FilesApi,
  ListFilesResponseDto,
  ListPublicFilesRequest,
  ListSharedFilesRequest,
  MoveFilesResponseDto,
  MoveItemDto,
  RenameFilesResponseDto,
  RenameItemDto,
  RevokeAccessItemDto,
  RevokeAccessResponseDto,
  UploadArchiveResponseDto,
} from '@epam/ai-dial-chat-api-client';

/** Upload mode passed to `FilesApi.uploadFile`: overwrite an existing file or fail if it already exists. */
export type UploadMode = 'overwrite' | 'create-only';

/** Options accepted by an {@link UploadFileWithProgressFn}. */
export interface UploadFileWithProgressOptions {
  /** Aborts the upload in flight. */
  signal?: AbortSignal;
  /** Called with the upload's progress percentage (0–100). */
  onProgress?: (percent: number) => void;
  /** Defaults to the generated client's own default when omitted. */
  uploadMode?: UploadMode;
}

/** Shape of a progress-reporting file upload function, e.g. the return value of `createUploadFileWithProgress`. */
export type UploadFileWithProgressFn = (
  bucket: string,
  path: string,
  file: File,
  options?: UploadFileWithProgressOptions,
) => Promise<FileUploadResponseDto>;

/** Options accepted by the returned `uploadFile`. */
export type UploadFileOptions = UploadFileWithProgressOptions;

/** The DIAL files API surface produced by {@link createFilesApiClient}. */
export interface FilesApiClient {
  listPublicFiles: (
    params: ListPublicFilesRequest,
  ) => Promise<ListFilesResponseDto>;
  listSharedFiles: (
    params: ListSharedFilesRequest,
  ) => Promise<ListFilesResponseDto>;
  listFiles: (
    params: {
      bucket: string;
      path?: string;
      token?: string;
      limit?: number;
      recursive?: boolean;
      permissions?: boolean;
    },
    signal?: AbortSignal,
  ) => Promise<ListFilesResponseDto>;
  uploadFile: (
    bucket: string,
    path: string,
    file: File,
    options?: AbortSignal | UploadFileOptions,
  ) => Promise<FileUploadResponseDto>;
  uploadArchive: (
    file: File,
    bucket: string,
    destinationPath: string,
  ) => Promise<UploadArchiveResponseDto>;
  getFileMetadata: (params: {
    bucket: string;
    path: string;
  }) => Promise<FileMetadataResponseDto>;
  downloadFile: (
    bucket: string,
    path: string,
    signal?: AbortSignal,
  ) => Promise<Response>;
  createFolder: (params: CreateFolderDto) => Promise<CreateFolderResponseDto>;
  deleteFiles: (items: DeleteItemDto[]) => Promise<DeleteFilesResponseDto>;
  renameFiles: (items: RenameItemDto[]) => Promise<RenameFilesResponseDto>;
  copyFiles: (
    items: CopyItemDto[],
    signal?: AbortSignal,
  ) => Promise<CopyFilesResponseDto>;
  moveFiles: (
    items: MoveItemDto[],
    signal?: AbortSignal,
  ) => Promise<MoveFilesResponseDto>;
  downloadArchive: (items: ArchiveItemDto[]) => Promise<Response>;
  revokeAccess: (
    items: RevokeAccessItemDto[],
  ) => Promise<RevokeAccessResponseDto>;
  discardShared: (
    items: DiscardSharedItemDto[],
  ) => Promise<DiscardSharedResponseDto>;
  listSharedByMe: (bucket: string) => Promise<ListFilesResponseDto>;
}

const resolveUploadOptions = (
  options?: AbortSignal | UploadFileOptions,
): UploadFileOptions =>
  options instanceof AbortSignal ? { signal: options } : (options ?? {});

/**
 * Builds the DIAL files API wrapper functions `apps/chat/src/server-api/files.api.ts`
 * exposes today, delegating to an already-configured `FilesApi` instance and
 * an injected progress-reporting upload function.
 */
export const createFilesApiClient = (
  filesApi: FilesApi,
  uploadFileWithProgress: UploadFileWithProgressFn,
): FilesApiClient => ({
  listPublicFiles: (params) => filesApi.listPublicFiles(params),

  listSharedFiles: (params) => filesApi.listSharedFiles(params),

  listFiles: (params, signal) =>
    filesApi.listFiles(params, signal ? { signal } : undefined),

  uploadFile: (bucket, path, file, options) => {
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
  },

  uploadArchive: (file, bucket, destinationPath) =>
    filesApi.uploadArchive({ file, bucket, destinationPath }),

  getFileMetadata: (params) => filesApi.getFileMetadata(params),

  /*
   * downloadFileRaw() is used instead of downloadFile() because the generator
   * emits `Blob | void` for application/octet-stream responses, which loses stream
   * semantics. The raw method returns the native fetch Response whose `.body` is a
   * ReadableStream and whose `.blob()` buffers the full content when needed.
   */
  downloadFile: async (bucket, path, signal) => {
    const raw = await filesApi.downloadFileRaw(
      { bucket, path },
      ...(signal ? [{ signal }] : []),
    );
    return raw.raw;
  },

  createFolder: (params) => filesApi.createFolder({ createFolderDto: params }),

  deleteFiles: (items) => filesApi.deleteFiles({ deleteFilesDto: { items } }),

  renameFiles: (items) => filesApi.renameFiles({ renameFilesDto: { items } }),

  copyFiles: (items, signal) =>
    filesApi.copyFiles(
      { copyFilesDto: { items } },
      signal ? { signal } : undefined,
    ),

  moveFiles: (items, signal) =>
    filesApi.moveFiles(
      { moveFilesDto: { items } },
      signal ? { signal } : undefined,
    ),

  /*
   * downloadArchiveRaw() is used instead of downloadArchive() for the same reason
   * as downloadFileRaw() above — binary response semantics require the raw fetch Response.
   */
  downloadArchive: async (items) => {
    const raw = await filesApi.downloadArchiveRaw({
      downloadArchiveDto: { items },
    });
    return raw.raw;
  },

  revokeAccess: (items) =>
    filesApi.revokeAccess({ revokeAccessDto: { items } }),

  discardShared: (items) =>
    filesApi.discardShared({ discardSharedDto: { items } }),

  listSharedByMe: (bucket) => filesApi.listSharedByMe({ bucket }),
});
