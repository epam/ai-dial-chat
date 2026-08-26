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

/** Upload mode passed through to `DialFilesApi.uploadFile` — mirrors the BFF's `uploadMode` form field. */
export enum DialFilesApiUploadMode {
  Overwrite = 'overwrite',
  CreateOnly = 'create-only',
}

/** Options accepted by `DialFilesApi.uploadFile` beyond an already-created `AbortSignal`. */
export interface DialFilesApiUploadOptions {
  /** Aborts the in-flight upload when triggered. */
  signal?: AbortSignal;
  /** Called with the 0–100 upload progress percentage when the transport reports byte progress. */
  onProgress?: (percent: number) => void;
  /** Controls create-only vs. overwrite semantics for the destination path. */
  uploadMode?: DialFilesApiUploadMode;
}

/**
 * Operation port every file-manager hook that performs network I/O accepts as
 * a parameter, replacing direct `server-api/files.api` access. Mirrors
 * `apps/chat/src/server-api/files.api.ts`'s exact function signatures — not
 * the generated client's own method shapes — since that file wraps
 * `uploadFile`/`uploadArchive` with custom XHR-based progress/cancellation
 * that has no equivalent in the generated client.
 */
export interface DialFilesApi {
  /** Lists files/folders directly under `params.path` within `params.bucket`. */
  listFiles(
    params: {
      bucket: string;
      path?: string;
      token?: string;
      limit?: number;
      recursive?: boolean;
      permissions?: boolean;
    },
    signal?: AbortSignal,
  ): Promise<ListFilesResponseDto>;
  /** Lists files/folders under the organization's public root. */
  listPublicFiles(
    params: ListPublicFilesRequest,
  ): Promise<ListFilesResponseDto>;
  /** Lists files/folders shared with the current user. */
  listSharedFiles(
    params: ListSharedFilesRequest,
  ): Promise<ListFilesResponseDto>;
  /** Lists items the current user has shared with others, from their own bucket. */
  listSharedByMe(bucket: string): Promise<ListFilesResponseDto>;
  /** Fetches metadata for a single file or folder. */
  getFileMetadata(params: {
    bucket: string;
    path: string;
  }): Promise<FileMetadataResponseDto>;
  /**
   * Uploads a file, reporting progress via `options.onProgress` when supplied
   * and honoring cancellation via `options.signal` or a bare `AbortSignal`.
   */
  uploadFile(
    bucket: string,
    path: string,
    file: File,
    options?: AbortSignal | DialFilesApiUploadOptions,
  ): Promise<FileUploadResponseDto>;
  /** Uploads a ZIP archive and extracts its entries under `destinationPath`. */
  uploadArchive(
    file: File,
    bucket: string,
    destinationPath: string,
  ): Promise<UploadArchiveResponseDto>;
  /** Creates a new folder. */
  createFolder(params: CreateFolderDto): Promise<CreateFolderResponseDto>;
  /** Deletes one or more files/folders. */
  deleteFiles(items: DeleteItemDto[]): Promise<DeleteFilesResponseDto>;
  /** Renames one or more files/folders in place (same parent folder). */
  renameFiles(items: RenameItemDto[]): Promise<RenameFilesResponseDto>;
  /** Copies one or more files/folders to a destination path. */
  copyFiles(
    items: CopyItemDto[],
    signal?: AbortSignal,
  ): Promise<CopyFilesResponseDto>;
  /** Moves one or more files/folders to a destination path (different parent folder). */
  moveFiles(
    items: MoveItemDto[],
    signal?: AbortSignal,
  ): Promise<MoveFilesResponseDto>;
  /** Downloads a single file, returning the raw fetch `Response`. */
  downloadFile(
    bucket: string,
    path: string,
    signal?: AbortSignal,
  ): Promise<Response>;
  /** Downloads a ZIP archive of the given items, returning the raw fetch `Response`. */
  downloadArchive(items: ArchiveItemDto[]): Promise<Response>;
  /** Revokes access previously granted on the given owned items. */
  revokeAccess(items: RevokeAccessItemDto[]): Promise<RevokeAccessResponseDto>;
  /** Discards items shared with the current user. */
  discardShared(
    items: DiscardSharedItemDto[],
  ): Promise<DiscardSharedResponseDto>;
}
