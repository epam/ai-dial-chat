import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { finished, pipeline } from 'node:stream/promises';
import type { components } from '@epam/ai-dial-typescript-sdk';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import archiver from 'archiver';
import type { Response as ExpressResponse } from 'express';
import * as yauzl from 'yauzl';
import {
  handleDialFetchError,
  handleDialSdkError,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import { safeDecodeURIComponent } from '../common/utils/uri';
import type { EnvironmentVariables } from '../config/environment.config';
import { DialClientService } from '../dial/dial-client.service';
import type { CopyItemDto } from './dto/copy-files.dto';
import {
  CopyFilesResponseDto,
  CopyItemNodeType,
  CopyItemResultDto,
} from './dto/copy-files.dto';
import type { CreateFolderResponseDto } from './dto/create-folder.dto';
import type { DeleteItemDto } from './dto/delete-files.dto';
import {
  DeleteFilesResponseDto,
  DeleteItemNodeType,
  DeleteItemResultDto,
} from './dto/delete-files.dto';
import type {
  DiscardSharedItemDto,
  DiscardSharedResponseDto,
} from './dto/discard-shared.dto';
import type { ArchiveItemDto } from './dto/download-archive.dto';
import { ArchiveItemNodeType } from './dto/download-archive.dto';
import type { FileMetadataResponseDto } from './dto/file-metadata-response.dto';
import type { ListFilesResponseDto } from './dto/list-files.dto';
import type { MoveItemDto } from './dto/move-files.dto';
import {
  MoveFilesResponseDto,
  MoveItemNodeType,
  MoveItemResultDto,
} from './dto/move-files.dto';
import type { RenameItemDto } from './dto/rename-files.dto';
import {
  RenameFilesResponseDto,
  RenameItemNodeType,
  RenameItemResultDto,
} from './dto/rename-files.dto';
import type {
  RevokeAccessItemDto,
  RevokeAccessResponseDto,
} from './dto/revoke-access.dto';
import type {
  ShareItemDto,
  ShareFilesResponseDto,
} from './dto/share-files.dto';
import { SharePermission } from './dto/share-files.dto';
import type {
  UploadArchiveEntryResultDto,
  UploadArchiveResponseDto,
} from './dto/upload-archive.dto';
import type { FileUploadResponseDto } from './dto/upload-file-response.dto';
import type { UploadMode } from './dto/upload-file.dto';
import { FOLDER_NODE_TYPE, MARKER_NAME } from './files.constants';
import { summarizeDialRawItems } from './list-items-debug';
import { markerMetadataMatches } from './marker-metadata';
import type { DialFileItem } from './normalize-file-item';
import { normalizeFileItem } from './normalize-file-item';
import { resolveListingPermissions } from './resolve-listing-permissions';

interface ExpandedFile {
  bucket: string;
  path: string;
  name: string;
  size: number;
  archivePath: string;
}

interface ArchiveEntryPathResult {
  isDirectory: boolean;
  safeRelativePath: string | null;
}

type StagedArchiveFile = {
  tempPath: string;
};

type FailedArchiveFile = {
  error: unknown;
  status?: number;
};

type ArchiveStageResult = StagedArchiveFile | FailedArchiveFile;

const isFailedArchiveStage = (
  result: ArchiveStageResult,
): result is FailedArchiveFile => 'error' in result;

const FULL_FILE_LIST_PAGE_LIMIT = 1000;

export const SAFE_DOWNLOAD_HEADERS = [
  'content-type',
  'content-disposition',
  'content-length',
] as const;

interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
}

interface UploadedArchiveFile {
  path: string;
  size?: number;
}

const buildDialFileUrl = (bucket: string, path: string): string =>
  `files/${bucket}/${path}`;

const getFileNameFromPath = (path: string): string =>
  path.split('/').filter(Boolean).pop() ?? 'file';

const safeDecodePathForCompare = (path: string): string =>
  path.split('/').map(safeDecodeURIComponent).join('/');

const buildDialFileResourceUrl = (bucket: string, path: string): string =>
  buildDialFileUrl(bucket, encodeDialResourcePath(path));

const mapSharePermission = (
  permission: SharePermission,
): Array<components['schemas']['ResourceAccessType']> =>
  permission === SharePermission.ReadWrite ? ['READ', 'WRITE'] : ['READ'];

const buildUploadFormData = (file: UploadedFile, path: string): FormData => {
  const formData = new FormData();
  const fileName = file.originalname ?? getFileNameFromPath(path);
  formData.append(
    'file',
    new Blob([file.buffer], { type: file.mimetype }),
    fileName,
  );
  return formData;
};

const getResourceOperationErrorMessage = (
  error: unknown,
  operationTag: string,
  fallback: string,
): string => {
  try {
    handleDialSdkError(error, operationTag);
  } catch (err) {
    if (err instanceof HttpException) {
      if (err.getStatus() === HttpStatus.CONFLICT) return 'Conflict';
      if (err.getStatus() === HttpStatus.FORBIDDEN) return 'Forbidden';
      if (err.getStatus() === HttpStatus.NOT_FOUND) return 'Not found';
    }
  }

  return fallback;
};

const getRenameErrorMessage = (error: unknown): string =>
  getResourceOperationErrorMessage(error, 'files.renameItem', 'Rename failed');

const getCopyErrorMessage = (error: unknown): string =>
  getResourceOperationErrorMessage(error, 'files.copyItem', 'Copy failed');

const getMoveErrorMessage = (error: unknown): string =>
  getResourceOperationErrorMessage(error, 'files.moveItem', 'Move failed');

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  private getTimeoutMs(): number {
    return this.configService.get<number>('FILE_TRANSFER_TIMEOUT_MS') ?? 30_000;
  }

  private async fetchFileMetadataPage(
    bucket: string,
    normalizedPath: string,
    query: {
      token?: string;
      limit?: number;
      recursive?: boolean;
      permissions?: boolean;
    },
    at: string,
  ): Promise<{
    items: DialFileItem[];
    nextToken?: string;
    permissions?: string[];
  }> {
    const { data, error, response } =
      await this.dialClient.client.getFileMetadata(bucket, normalizedPath, {
        headers: getBearerAuthHeaders(at),
        params: {
          query: {
            token: query.token,
            limit: query.limit,
            recursive: query.recursive ?? false,
            permissions: query.permissions ?? true,
          },
        },
        signal: AbortSignal.timeout(this.getTimeoutMs()),
      });

    if (error != null) {
      this.logger.warn(
        `DIAL Core listFiles returned error: status=${response.status}, bucket=${bucket}`,
      );
      return handleDialSdkError(
        error,
        'files.listFiles',
        this.logger,
        response,
      );
    }

    const dialData = (data ?? {}) as typeof data & {
      nextToken?: string;
      permissions?: string[];
      items?: DialFileItem[];
    };

    return {
      items: dialData.items ?? [],
      nextToken: dialData.nextToken,
      permissions: dialData.permissions,
    };
  }

  async uploadFile(
    bucket: string,
    path: string,
    file: UploadedFile,
    token: string,
    uploadMode?: UploadMode,
  ): Promise<FileUploadResponseDto> {
    try {
      this.logger.debug(
        `Uploading file to DIAL Core: bucket=${bucket}, path=${path}, mimetype=${file.mimetype}, size=${file.buffer.length}, uploadMode=${uploadMode ?? 'overwrite'}`,
      );

      const conditionalHeaders =
        uploadMode === 'create-only' ? { 'If-None-Match': '*' } : {};

      const { data, error, response } =
        (await this.dialClient.client.uploadFile(bucket, path, {
          headers: {
            ...getBearerAuthHeaders(token),
            ...conditionalHeaders,
          },
          body: buildUploadFormData(file, path) as unknown as string,
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        })) as { data?: { url?: string }; error?: unknown; response: Response };

      if (error != null) {
        if (response.status === 412) {
          this.logger.warn(
            `DIAL Core upload precondition failed (412): bucket=${bucket}, path=${path} — mapping to 409 Conflict`,
          );
          throw new HttpException(
            'File already exists at this path',
            HttpStatus.CONFLICT,
          );
        }
        this.logger.warn(
          `DIAL Core upload returned error: status=${response.status}, bucket=${bucket}, path=${path}`,
        );
        return handleDialSdkError(
          error,
          'files.uploadFile',
          this.logger,
          response,
        );
      }

      const url = buildDialFileUrl(bucket, path);
      this.logger.debug(
        `File upload succeeded: bucket=${bucket}, path=${path}, url=${url}, upstreamUrl=${data?.url ?? ''}`,
      );
      return { url };
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`Upload failed for ${bucket}/${path}`, err);
      return handleDialSdkError(err, 'files.uploadFile', this.logger);
    }
  }

  async uploadArchive(
    bucket: string,
    destinationPath: string,
    archiveFile: UploadedArchiveFile,
    token: string,
  ): Promise<UploadArchiveResponseDto> {
    if (archiveFile.path === '') {
      throw new BadRequestException('file is required');
    }

    const maxArchiveBytes =
      this.configService.get<number>('ARCHIVE_UPLOAD_MAX_BYTES') ?? 536_870_912;
    if (archiveFile.size != null && archiveFile.size > maxArchiveBytes) {
      throw new PayloadTooLargeException('Archive payload too large');
    }

    const maxFiles =
      this.configService.get<number>('ARCHIVE_UPLOAD_MAX_FILES') ?? 1000;
    const maxUncompressedBytes =
      this.configService.get<number>('ARCHIVE_UPLOAD_MAX_UNCOMPRESSED_BYTES') ??
      2_147_483_648;
    const timeoutMs =
      this.configService.get<number>('ARCHIVE_UPLOAD_TIMEOUT_MS') ?? 300_000;

    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const results = await this.extractAndUploadArchive(
        bucket,
        destinationPath,
        archiveFile.path,
        token,
        maxFiles,
        maxUncompressedBytes,
        abortController.signal,
      );

      const successCount = results.filter((r) => r.success).length;
      this.logger.log(
        `Archive upload completed: successCount=${successCount}, failedCount=${results.length - successCount}`,
      );

      return { results };
    } catch (err) {
      if (abortController.signal.aborted) {
        this.logger.error(
          `Archive upload timed out: bucket=${bucket}, timeoutMs=${timeoutMs}`,
        );
        throw new ServiceUnavailableException('Archive upload timed out');
      }
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.warn(
        `Archive upload failed to open or extract: bucket=${bucket}, error=${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException('Invalid or corrupted ZIP archive');
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private async extractAndUploadArchive(
    bucket: string,
    destinationPath: string,
    archivePath: string,
    token: string,
    maxFiles: number,
    maxUncompressedBytes: number,
    signal: AbortSignal,
  ): Promise<UploadArchiveEntryResultDto[]> {
    const normalizedDestination = destinationPath.replace(/\/+$/, '');
    const results: UploadArchiveEntryResultDto[] = [];
    let entryCount = 0;
    let cumulativeBytes = 0;
    const tempDirectory = await mkdtemp(join(tmpdir(), 'dial-upload-archive-'));

    /*
     * decodeStrings: false — yauzl's own filename validation aborts the
     * *whole* archive on the first unsafe entry name, but D4 requires
     * per-entry rejection (record a failed result, keep processing the
     * rest). Reading the raw name lets resolveArchiveEntryPath be the sole
     * zip-slip authority.
     */
    const zipfile = await yauzl
      .openPromise(archivePath, {
        lazyEntries: true,
        decodeStrings: false,
      })
      .catch(async (err: unknown) => {
        await this.removeArchiveUploadTempDirectory(tempDirectory);
        throw err;
      });

    this.logger.log(
      `Archive upload started: bucket=${bucket}, entryCount=${zipfile.entryCount}`,
    );

    try {
      for await (const entry of zipfile.eachEntry()) {
        this.throwIfArchiveUploadAborted(signal);

        const fileName = this.decodeArchiveEntryName(entry.fileName);
        const { isDirectory, safeRelativePath } =
          this.resolveArchiveEntryPath(fileName);

        if (isDirectory) {
          continue;
        }

        entryCount += 1;
        if (entryCount > maxFiles) {
          throw new UnprocessableEntityException(
            `Archive contains more than ${maxFiles} files`,
          );
        }

        if (safeRelativePath == null) {
          results.push({
            path: fileName,
            success: false,
            error: 'Invalid path',
          });
          continue;
        }

        const entryPath = normalizedDestination
          ? `${normalizedDestination}/${safeRelativePath}`
          : safeRelativePath;
        const entryTempPath = join(
          tempDirectory,
          `${entryCount}-${randomUUID()}.entry`,
        );

        const stream = await zipfile.openReadStreamPromise(entry);
        const entryBytes = await this.stageArchiveEntryToTemp(
          stream,
          entryTempPath,
          maxUncompressedBytes - cumulativeBytes,
          signal,
        );
        cumulativeBytes += entryBytes;

        try {
          await this.uploadArchiveEntryFromTemp(
            bucket,
            entryPath,
            entryTempPath,
            token,
            signal,
          );
          results.push({ path: entryPath, success: true });
        } catch (err) {
          this.throwIfArchiveUploadAborted(signal);

          const isConflict =
            err instanceof HttpException &&
            err.getStatus() === HttpStatus.CONFLICT;
          results.push({
            path: entryPath,
            success: false,
            error: isConflict
              ? 'Conflict'
              : err instanceof HttpException
                ? err.message
                : 'Upload failed',
          });
        }
      }
    } finally {
      zipfile.close();
      await this.removeArchiveUploadTempDirectory(tempDirectory);
    }

    return results;
  }

  private async stageArchiveEntryToTemp(
    stream: Readable,
    tempPath: string,
    remainingBudget: number,
    signal: AbortSignal,
  ): Promise<number> {
    this.throwIfArchiveUploadAborted(signal);

    if (remainingBudget < 0) {
      throw new UnprocessableEntityException(
        'Archive uncompressed size exceeds the configured limit',
      );
    }

    let readBytes = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        readBytes += chunk.length;
        if (readBytes > remainingBudget) {
          callback(
            new UnprocessableEntityException(
              'Archive uncompressed size exceeds the configured limit',
            ),
          );
          return;
        }
        callback(null, chunk);
      },
    });
    const abortCurrentEntry = (): void => {
      const error = new Error('ARCHIVE_UPLOAD_ABORTED');
      stream.destroy(error);
      limiter.destroy(error);
    };

    signal.addEventListener('abort', abortCurrentEntry, { once: true });

    try {
      await pipeline(stream, limiter, createWriteStream(tempPath));
      this.throwIfArchiveUploadAborted(signal);
      return readBytes;
    } finally {
      signal.removeEventListener('abort', abortCurrentEntry);
    }
  }

  private async uploadArchiveEntryFromTemp(
    bucket: string,
    path: string,
    tempPath: string,
    token: string,
    signal: AbortSignal,
  ): Promise<void> {
    const stream = createReadStream(tempPath);
    await this.uploadFileStream(bucket, path, stream, token, signal);
  }

  private async uploadFileStream(
    bucket: string,
    path: string,
    fileStream: Readable,
    token: string,
    signal: AbortSignal,
  ): Promise<void> {
    this.throwIfArchiveUploadAborted(signal);

    const boundary = `dial-upload-${randomUUID()}`;
    const multipartStream = this.createMultipartFileStream(
      fileStream,
      boundary,
      getFileNameFromPath(path),
    );
    const abortCurrentUpload = (): void => {
      const error = new Error('ARCHIVE_UPLOAD_ABORTED');
      fileStream.destroy(error);
      multipartStream.destroy(error);
    };

    signal.addEventListener('abort', abortCurrentUpload, { once: true });

    try {
      /*
       * The SDK upload helper requires FormData/Blob, which would buffer the
       * staged file again. Raw fetch lets archive uploads stream from disk.
       */
      const response = await fetch(this.buildDialUploadUrl(bucket, path), {
        method: 'PUT',
        headers: {
          ...getBearerAuthHeaders(token),
          'If-None-Match': '*',
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: Readable.toWeb(multipartStream) as unknown as BodyInit,
        signal,
        duplex: 'half',
      } as RequestInit & { duplex: 'half' });

      if (response.status === 412) {
        throw new ConflictException('File already exists at this path');
      }

      if (!response.ok) {
        return mapDialHttpStatus(
          response.status,
          'files.uploadFile',
          this.logger,
        );
      }
    } catch (err) {
      return handleDialFetchError(
        err,
        'files.uploadFile',
        this.logger,
        this.getTimeoutMs(),
      );
    } finally {
      signal.removeEventListener('abort', abortCurrentUpload);
      fileStream.destroy();
      multipartStream.destroy();
    }
  }

  private createMultipartFileStream(
    fileStream: Readable,
    boundary: string,
    fileName: string,
  ): Readable {
    const safeFileName = fileName.replace(/[\r\n"]/g, '_');

    async function* parts(): AsyncGenerator<Buffer> {
      yield Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeFileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
      );
      for await (const chunk of fileStream) {
        yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      }
      yield Buffer.from(`\r\n--${boundary}--\r\n`);
    }

    return Readable.from(parts());
  }

  private buildDialUploadUrl(bucket: string, path: string): string {
    const baseUrl = this.dialClient.baseUrl.replace(/\/+$/, '');
    return `${baseUrl}/v1/files/${encodeURIComponent(bucket)}/${encodeDialResourcePath(path)}`;
  }

  private async removeArchiveUploadTempDirectory(
    tempDirectory: string,
  ): Promise<void> {
    await rm(tempDirectory, { recursive: true, force: true }).catch(
      (err: unknown) => {
        this.logger.warn(
          `Failed to remove archive upload temp directory: ${err instanceof Error ? err.message : String(err)}`,
        );
      },
    );
  }

  private throwIfArchiveUploadAborted(signal: AbortSignal): void {
    if (signal.aborted) {
      throw new ServiceUnavailableException('Archive upload timed out');
    }
  }

  async listFiles(
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
    const normalizedPath =
      path != null && path !== '' && !path.endsWith('/')
        ? `${path}/`
        : (path ?? '');

    try {
      const shouldAggregateAllPages =
        query.token == null && query.limit == null;
      const rawItems: DialFileItem[] = [];
      let token = query.token;
      let nextToken: string | undefined;
      let page = 0;
      let permissions: string[] | undefined;

      do {
        page += 1;
        const pageData = await this.fetchFileMetadataPage(
          bucket,
          normalizedPath,
          {
            ...query,
            token,
            limit: shouldAggregateAllPages
              ? FULL_FILE_LIST_PAGE_LIMIT
              : query.limit,
          },
          at,
        );

        rawItems.push(...pageData.items);
        permissions ??= pageData.permissions;
        nextToken = pageData.nextToken;
        token = nextToken;

        this.logger.debug(
          `listFiles DIAL page: bucket=${bucket}, path=${normalizedPath}, page=${page}, count=${pageData.items.length}, hasNextPage=${nextToken != null}`,
        );
      } while (shouldAggregateAllPages && token != null);

      this.logger.debug(
        `listFiles DIAL raw: bucket=${bucket}, path=${normalizedPath}, count=${rawItems.length}, items=[${summarizeDialRawItems(rawItems)}]`,
      );

      const items = rawItems.map((item) => normalizeFileItem(item, bucket));
      const resolvedPermissions = resolveListingPermissions(
        rawItems,
        normalizedPath,
      );

      return {
        bucket,
        path: normalizedPath,
        items,
        nextToken: shouldAggregateAllPages ? undefined : nextToken,
        permissions: permissions ?? resolvedPermissions,
      };
    } catch (err) {
      this.logger.warn(`listFiles failed for bucket=${bucket}`, err);
      return handleDialSdkError(err, 'files.listFiles', this.logger);
    }
  }

  async listPublicFiles(
    query: {
      path?: string;
      token?: string;
      limit?: number;
      recursive?: boolean;
    },
    at: string,
  ): Promise<ListFilesResponseDto> {
    return this.listFiles(
      'public',
      query.path,
      { ...query, permissions: false },
      at,
    );
  }

  async listSharedFiles(
    query: { path?: string; token?: string; limit?: number },
    at: string,
  ): Promise<ListFilesResponseDto> {
    try {
      const { data, error, response } =
        await this.dialClient.client.getSharedResources({
          headers: getBearerAuthHeaders(at),
          body: { resourceTypes: ['FILE'], with: 'me', includeUserInfo: true },
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        });

      if (error != null) {
        this.logger.warn(
          `DIAL Core getSharedResources returned error: status=${response.status}`,
        );
        return handleDialSdkError(
          error,
          'files.listSharedFiles',
          this.logger,
          response,
        );
      }

      const sharedData = (data ?? {}) as typeof data & {
        resources?: DialFileItem[];
      };
      const rawItems = sharedData.resources ?? [];

      const allItems = rawItems
        .map((item) => normalizeFileItem(item, item.bucket ?? ''))
        .filter((item) => {
          if (!query.path) return true;
          return item.path === query.path || item.path.startsWith(query.path);
        });

      const limit = query.limit;
      const items = limit != null ? allItems.slice(0, limit) : allItems;

      this.logger.debug(`listSharedFiles: count=${items.length}`);

      return { bucket: '', path: query.path ?? '', items };
    } catch (err) {
      this.logger.warn('listSharedFiles failed', err);
      return handleDialSdkError(err, 'files.listSharedFiles', this.logger);
    }
  }

  async listSharedByMe(
    bucket: string,
    at: string,
  ): Promise<ListFilesResponseDto> {
    try {
      const { data, error, response } =
        await this.dialClient.client.getSharedResources({
          headers: getBearerAuthHeaders(at),
          body: {
            resourceTypes: ['FILE'],
            with: 'others',
            includeUserInfo: false,
          },
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        });

      if (error != null) {
        this.logger.warn(
          `DIAL Core getSharedResources (others) returned error: status=${response.status}`,
        );
        return handleDialSdkError(
          error,
          'files.listSharedByMe',
          this.logger,
          response,
        );
      }

      const sharedData = (data ?? {}) as typeof data & {
        resources?: DialFileItem[];
      };
      const rawItems = sharedData.resources ?? [];

      const items = rawItems
        .filter((item) => (item.bucket ?? '') === bucket)
        .map((item) => normalizeFileItem(item, bucket));

      this.logger.debug(
        `listSharedByMe: bucket=${bucket}, count=${items.length}`,
      );

      return { bucket, path: '', items };
    } catch (err) {
      this.logger.warn(`listSharedByMe failed for bucket=${bucket}`, err);
      return handleDialSdkError(err, 'files.listSharedByMe', this.logger);
    }
  }

  async shareFiles(
    items: ShareItemDto[],
    permission: SharePermission,
    at: string,
  ): Promise<ShareFilesResponseDto> {
    this.logger.log(`Share files started: itemCount=${items.length}`);

    try {
      const permissions = mapSharePermission(permission);
      const { data, error, response } =
        await this.dialClient.client.shareResource({
          headers: getBearerAuthHeaders(at),
          body: {
            invitationType: 'LINK',
            resources: items.map((item) => ({
              url: buildDialFileResourceUrl(item.bucket, item.path),
              permissions,
            })),
          },
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        });

      if (error != null) {
        this.logger.warn(
          `Share files failed: itemCount=${items.length}, status=${response.status}`,
        );
        return handleDialSdkError(
          error,
          'files.shareFiles',
          this.logger,
          response,
        );
      }

      this.logger.log(
        `Share files completed: itemCount=${items.length}, success=true`,
      );

      return { invitationLink: data?.invitationLink ?? '' };
    } catch (err) {
      this.logger.error(
        `Share files exception: itemCount=${items.length}`,
        err,
      );
      return handleDialSdkError(err, 'files.shareFiles', this.logger);
    }
  }

  async revokeAccess(
    items: RevokeAccessItemDto[],
    at: string,
  ): Promise<RevokeAccessResponseDto> {
    this.logger.log(`Revoke access started: itemCount=${items.length}`);

    try {
      const { error, response } =
        await this.dialClient.client.revokeSharedResources({
          headers: getBearerAuthHeaders(at),
          body: {
            resources: items.map((item) => ({
              url: buildDialFileResourceUrl(item.bucket, item.path),
            })),
          },
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        });

      if (error != null) {
        this.logger.warn(
          `Revoke access failed: itemCount=${items.length}, status=${response.status}`,
        );
        return handleDialSdkError(
          error,
          'files.revokeAccess',
          this.logger,
          response,
        );
      }

      this.logger.log(
        `Revoke access completed: itemCount=${items.length}, success=true`,
      );

      return { success: true };
    } catch (err) {
      this.logger.error(
        `Revoke access exception: itemCount=${items.length}`,
        err,
      );
      return handleDialSdkError(err, 'files.revokeAccess', this.logger);
    }
  }

  async discardShared(
    items: DiscardSharedItemDto[],
    at: string,
  ): Promise<DiscardSharedResponseDto> {
    this.logger.log(`Discard shared started: itemCount=${items.length}`);

    try {
      const { error, response } =
        await this.dialClient.client.discardSharedResources({
          headers: getBearerAuthHeaders(at),
          body: {
            resources: items.map((item) => ({
              url: buildDialFileResourceUrl(item.bucket, item.path),
            })),
          },
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        });

      if (error != null) {
        this.logger.warn(
          `Discard shared failed: itemCount=${items.length}, status=${response.status}`,
        );
        return handleDialSdkError(
          error,
          'files.discardShared',
          this.logger,
          response,
        );
      }

      this.logger.log(
        `Discard shared completed: itemCount=${items.length}, success=true`,
      );

      return { success: true };
    } catch (err) {
      this.logger.error(
        `Discard shared exception: itemCount=${items.length}`,
        err,
      );
      return handleDialSdkError(err, 'files.discardShared', this.logger);
    }
  }

  async getFileMetadata(
    bucket: string,
    path: string,
    token: string,
  ): Promise<FileMetadataResponseDto> {
    try {
      this.logger.debug(
        `Getting file metadata from DIAL Core: bucket=${bucket}, path=${path}`,
      );

      const { data, error, response } =
        await this.dialClient.client.getFileMetadata(bucket, path, {
          headers: getBearerAuthHeaders(token),
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        });

      if (error != null) {
        this.logger.warn(
          `DIAL Core getFileMetadata returned error: status=${response.status}, bucket=${bucket}, path=${path}`,
        );
        return handleDialSdkError(
          error,
          'files.getFileMetadata',
          this.logger,
          response,
        );
      }

      this.logger.debug(
        `getFileMetadata succeeded: bucket=${bucket}, path=${path}`,
      );

      const fileData = data as components['schemas']['FileMetadata'];
      return {
        name: fileData.name,
        nodeType: fileData.nodeType,
        bucket: fileData.bucket,
        parentPath: fileData.parentPath,
        url: fileData.url,
        resourceType: fileData.resourceType,
        etag: fileData.etag,
        contentLength: fileData.contentLength,
        contentType: fileData.contentType,
        createdAt: fileData.createdAt,
        updatedAt: fileData.updatedAt,
        permissions: fileData.permissions,
        author: fileData.author,
      };
    } catch (err) {
      this.logger.error(
        `getFileMetadata failed for bucket=${bucket}, path=${path}`,
        err,
      );
      return handleDialSdkError(err, 'files.getFileMetadata', this.logger);
    }
  }

  async createFolder(
    bucket: string,
    parentPath: string,
    name: string,
    at: string,
  ): Promise<CreateFolderResponseDto> {
    const normalizedParent =
      parentPath !== '' && !parentPath.endsWith('/')
        ? `${parentPath}/`
        : parentPath;
    const markerPath = `${normalizedParent}${name}/${MARKER_NAME}`;
    const folderResponse = this.buildCreateFolderResponse(
      bucket,
      normalizedParent,
      name,
    );

    this.logger.debug(
      `createFolder request: bucket=${bucket}, parentPath=${normalizedParent}, name=${name}, markerPath=${markerPath}, responsePath=${folderResponse.path}, responseFolderId=${folderResponse.folderId}`,
    );

    try {
      const {
        data,
        error: metaError,
        response: metaResponse,
      } = await this.dialClient.client.getFileMetadata(bucket, markerPath, {
        headers: getBearerAuthHeaders(at),
        signal: AbortSignal.timeout(this.getTimeoutMs()),
      });

      const metaStatus = (metaResponse as { status: number }).status;
      const markerExists =
        metaError == null &&
        metaStatus === 200 &&
        markerMetadataMatches(data, bucket, markerPath);

      if (markerExists) {
        this.logger.debug(
          `createFolder conflict: marker verified at ${markerPath}, folderId=${folderResponse.folderId}`,
        );
        throw new ConflictException(
          `Folder "${name}" already exists at ${normalizedParent || 'root'}`,
        );
      }

      if (metaError == null && metaStatus === 200) {
        const probe = data as { name?: string; url?: string };
        this.logger.debug(
          `createFolder marker probe mismatch: requested=${markerPath}, probeName=${probe.name ?? '(none)'}, probeUrl=${probe.url ?? '(none)'}`,
        );
      } else if (metaError != null && metaStatus !== 404) {
        handleDialSdkError(metaError, 'files.createFolder', this.logger, {
          status: metaStatus,
        });
      }

      await this.uploadFile(
        bucket,
        markerPath,
        {
          buffer: Buffer.alloc(0),
          mimetype: 'application/octet-stream',
          originalname: MARKER_NAME,
        },
        at,
      );

      this.logger.debug(
        `createFolder uploaded marker: bucket=${bucket}, markerPath=${markerPath}, folderId=${folderResponse.folderId}`,
      );
      return folderResponse;
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(
        `createFolder failed for ${bucket}/${normalizedParent}${name}`,
        err,
      );
      return handleDialSdkError(err, 'files.createFolder', this.logger);
    }
  }

  private buildCreateFolderResponse(
    bucket: string,
    normalizedParent: string,
    name: string,
  ): CreateFolderResponseDto {
    const relativeFolderPath = `${normalizedParent}${name}/`;
    const resourcePath = buildDialFileUrl(bucket, relativeFolderPath);
    return {
      name,
      path: resourcePath,
      parentPath: normalizedParent.replace(/\/$/, ''),
      bucket,
      nodeType: FOLDER_NODE_TYPE,
      folderId: `${bucket}:${resourcePath}`,
    };
  }

  private toRelativePath(path: string, bucket: string): string {
    const prefix = `files/${bucket}/`;
    return path.startsWith(prefix) ? path.slice(prefix.length) : path;
  }

  async downloadFile(
    bucket: string,
    path: string,
    token: string,
  ): Promise<{ stream: ReadableStream; headers: Record<string, string> }> {
    const relativePath = this.toRelativePath(path, bucket);

    try {
      const { error, response } = (await this.dialClient.client.downloadFile(
        bucket,
        relativePath,
        {
          headers: getBearerAuthHeaders(token),
          parseAs: 'stream',
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        },
      )) as {
        error?: unknown;
        response: Response;
      };

      if (error != null) {
        return handleDialSdkError(
          error,
          'files.downloadFile',
          this.logger,
          response,
        );
      }

      const headers = Object.fromEntries(
        SAFE_DOWNLOAD_HEADERS.map(
          (h) => [h, response.headers.get(h)] as const,
        ).filter(([, v]) => v !== null),
      ) as Record<string, string>;

      return { stream: response.body as ReadableStream, headers };
    } catch (err) {
      this.logger.error(`Download failed for ${bucket}/${path}`, err);
      return handleDialSdkError(err, 'files.downloadFile', this.logger);
    }
  }

  async expandFolderContents(
    bucket: string,
    folderPath: string,
    archiveRoot: string,
    at: string,
  ): Promise<ExpandedFile[]> {
    /*
     * DialFile.path is the full DIAL resource path: "files/{bucket}/reports/"
     * Both the metadata API and download SDK expect the relative path: "reports/"
     */
    const relFolderPath = this.toRelativePath(folderPath, bucket);

    const results: ExpandedFile[] = [];
    let token: string | undefined;
    let page = 0;

    this.logger.debug(
      `Archive folder expansion started: bucket=${bucket}, inputPath=${folderPath}, relativePath=${relFolderPath}, archiveRoot=${archiveRoot}`,
    );

    do {
      page += 1;
      const { data, error, response } =
        await this.dialClient.client.getFileMetadata(bucket, relFolderPath, {
          headers: getBearerAuthHeaders(at),
          params: {
            query: { recursive: true, limit: 1000, token },
          },
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        });

      if (error != null) {
        this.logger.warn(
          `Archive folder metadata failed: bucket=${bucket}, path=${relFolderPath}, page=${page}, status=${response.status}`,
        );
        return handleDialSdkError(
          error,
          'files.expandFolderContents',
          this.logger,
          response as { status: number },
        );
      }

      const dialData = (data ?? {}) as typeof data & {
        nextToken?: string;
        items?: Array<{
          name?: string;
          url?: string;
          nodeType?: string;
          contentLength?: number;
        }>;
      };
      token = dialData.nextToken;
      this.logger.debug(
        `Archive folder metadata received: bucket=${bucket}, path=${relFolderPath}, page=${page}, itemCount=${dialData.items?.length ?? 0}, hasNextPage=${token != null}`,
      );

      for (const item of dialData.items ?? []) {
        const rawNodeType = (item.nodeType ?? '').toLowerCase();
        if (rawNodeType === 'folder') {
          this.logger.debug(
            `Archive folder item skipped: reason=folder-node, bucket=${bucket}, path=${item.url ?? item.name ?? ''}`,
          );
          continue;
        }

        // item.url may be a full resource path or already relative — normalise to relative
        const rawUrl = item.url ?? item.name ?? '';
        const relItemPath = this.toRelativePath(rawUrl, bucket);

        const relative = this.getRelativeChildPath(
          relItemPath,
          relFolderPath,
          item.name ?? relItemPath,
        );

        const archivePath = this.buildArchivePath(archiveRoot, relative);
        if (archivePath == null) {
          this.logger.warn(
            `Archive folder item skipped: reason=invalid-archive-path, bucket=${bucket}, sourcePath=${rawUrl}, relativePath=${relative}`,
          );
          continue;
        }

        results.push({
          bucket,
          path: relItemPath,
          name: item.name ?? '',
          size: item.contentLength ?? 0,
          archivePath,
        });
        this.logger.debug(
          `Archive folder item expanded: bucket=${bucket}, downloadPath=${relItemPath}, archivePath=${archivePath}, size=${item.contentLength ?? 0}`,
        );
      }
    } while (token != null);

    this.logger.debug(
      `Archive folder expansion completed: bucket=${bucket}, path=${relFolderPath}, fileCount=${results.length}`,
    );
    return results;
  }

  buildArchivePath(root: string, relative: string): string | null {
    if (
      !relative ||
      relative.includes('..') ||
      relative.startsWith('/') ||
      relative.includes('\\')
    ) {
      return null;
    }
    const joined = root ? `${root}/${relative}` : relative;
    return joined;
  }

  /**
   * Zip-slip defense for an uploaded archive entry (D4): rejects absolute
   * paths, drive letters, `..` segments, and backslashes. Directory entries
   * (trailing `/`) are flagged so callers can skip them silently rather than
   * treat them as a failed result.
   */
  resolveArchiveEntryPath(entryFileName: string): ArchiveEntryPathResult {
    if (entryFileName.endsWith('/')) {
      return { isDirectory: true, safeRelativePath: null };
    }

    const isUnsafe =
      entryFileName.startsWith('/') ||
      /^[a-zA-Z]:/.test(entryFileName) ||
      entryFileName.includes('\\') ||
      entryFileName.split('/').includes('..');

    return {
      isDirectory: false,
      safeRelativePath: isUnsafe ? null : entryFileName,
    };
  }

  /** Decodes a yauzl entry name read with `decodeStrings: false` (raw `Buffer`), or passes a string through unchanged. */
  private decodeArchiveEntryName(rawFileName: string): string {
    const raw: unknown = rawFileName;
    return Buffer.isBuffer(raw) ? raw.toString('utf8') : rawFileName;
  }

  private getRelativeChildPath(
    childPath: string,
    folderPath: string,
    fallback: string,
  ): string {
    const folderPrefix = folderPath.endsWith('/')
      ? folderPath
      : `${folderPath}/`;
    if (childPath.startsWith(folderPrefix)) {
      return childPath.slice(folderPrefix.length);
    }

    const comparableChildPath = safeDecodePathForCompare(childPath);
    const comparableFolderPrefix = safeDecodePathForCompare(folderPrefix);
    if (comparableChildPath.startsWith(comparableFolderPrefix)) {
      return comparableChildPath.slice(comparableFolderPrefix.length);
    }

    return fallback;
  }

  async downloadArchive(
    items: ArchiveItemDto[],
    at: string,
    res: ExpressResponse,
  ): Promise<void> {
    const maxItems = this.configService.get<number>('ARCHIVE_MAX_ITEMS') ?? 100;
    const maxFiles =
      this.configService.get<number>('ARCHIVE_MAX_FILES') ?? 1000;
    const maxBytes =
      this.configService.get<number>('ARCHIVE_MAX_UNCOMPRESSED_BYTES') ??
      5_368_709_120;
    const timeoutMs =
      this.configService.get<number>('ARCHIVE_TIMEOUT_MS') ?? 300_000;
    const downloadConcurrency =
      this.configService.get<number>('ARCHIVE_DOWNLOAD_CONCURRENCY') ?? 32;
    const startedAt = Date.now();

    this.logger.log(
      `Archive download started: requestedItems=${items.length}, timeoutMs=${timeoutMs}, downloadConcurrency=${downloadConcurrency}, items=${items
        .map(
          (item) =>
            `${item.nodeType}:${item.bucket}:${item.path}->${item.name}`,
        )
        .join(',')}`,
    );

    if (items.length > maxItems) {
      throw new PayloadTooLargeException(
        `Too many items: max ${maxItems}, got ${items.length}`,
      );
    }

    // Expand all items to a flat file list
    const expanded: ExpandedFile[] = [];
    const seenPaths = new Set<string>();
    const usedRoots = new Map<string, number>();

    for (const item of items) {
      // Deduplicate root name collisions
      const count = (usedRoots.get(item.name) ?? 0) + 1;
      usedRoots.set(item.name, count);
      const archiveRoot = count > 1 ? `${item.name}_${count - 1}` : item.name;

      if (item.nodeType === ArchiveItemNodeType.Folder) {
        const folderPath = item.path.endsWith('/')
          ? item.path
          : `${item.path}/`;
        const files = await this.expandFolderContents(
          item.bucket,
          folderPath,
          archiveRoot,
          at,
        );
        this.logger.debug(
          `Archive folder expanded: bucket=${item.bucket}, path=${folderPath}, fileCount=${files.length}`,
        );
        for (const f of files) {
          const key = `${f.bucket}:${f.path}`;
          if (!seenPaths.has(key)) {
            seenPaths.add(key);
            expanded.push(f);
          } else {
            this.logger.debug(
              `Archive entry skipped: reason=duplicate, bucket=${f.bucket}, path=${f.path}`,
            );
          }
        }
      } else {
        // Strip "files/{bucket}/" prefix so the SDK download URL is correct
        const relPath = this.toRelativePath(item.path, item.bucket);
        const key = `${item.bucket}:${relPath}`;
        if (!seenPaths.has(key)) {
          seenPaths.add(key);
          expanded.push({
            bucket: item.bucket,
            path: relPath,
            name: item.name,
            size: 0,
            archivePath: archiveRoot,
          });
          this.logger.debug(
            `Archive file queued: bucket=${item.bucket}, inputPath=${item.path}, downloadPath=${relPath}, archivePath=${archiveRoot}`,
          );
        } else {
          this.logger.debug(
            `Archive entry skipped: reason=duplicate, bucket=${item.bucket}, path=${relPath}`,
          );
        }
      }
    }

    this.logger.log(
      `Archive expansion completed: requestedItems=${items.length}, expandedFiles=${expanded.length}, declaredBytes=${expanded.reduce((sum, file) => sum + file.size, 0)}`,
    );

    if (expanded.length > maxFiles) {
      throw new PayloadTooLargeException(
        `Archive would contain ${expanded.length} files, max is ${maxFiles}`,
      );
    }

    const totalBytes = expanded.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > maxBytes) {
      throw new PayloadTooLargeException(
        `Archive uncompressed size ${totalBytes} exceeds limit of ${maxBytes} bytes`,
      );
    }

    // Commit headers — stream starts here
    const archiveName =
      items.length === 1 ? `${items[0].name}.zip` : 'files.zip';
    const safeName = archiveName.replace(/[^\w.-]/g, '_');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Accel-Buffering', 'no');

    const archive = archiver('zip', { store: true });
    archive.on('warning', (error) => {
      this.logger.warn(`Archive warning: ${error.message}`);
    });
    archive.on('error', (error) => {
      this.logger.error(`Archive stream error: ${error.message}`, error.stack);
    });
    archive.pipe(res as unknown as import('stream').Writable);
    res.flushHeaders();

    const archiveAbortController = new AbortController();
    const timeout = setTimeout(() => {
      this.logger.error(
        `Archive generation timed out: expandedFiles=${expanded.length}, elapsedMs=${Date.now() - startedAt}`,
      );
      archiveAbortController.abort();
      archive.abort();
    }, timeoutMs);

    res.on('close', () => {
      if (!res.writableEnded) {
        this.logger.warn(
          `Archive response closed before completion: expandedFiles=${expanded.length}, archiveBytes=${archive.pointer()}, elapsedMs=${Date.now() - startedAt}`,
        );
        clearTimeout(timeout);
        archiveAbortController.abort();
        archive.abort();
      }
    });

    let appendedFiles = 0;
    let failedFiles = 0;
    const tempDirectory = await mkdtemp(join(tmpdir(), 'dial-archive-'));
    const stagedDownloads = new Map<number, Promise<ArchiveStageResult>>();

    if (expanded.length > 1) {
      this.fillArchiveDownloadPool(
        expanded,
        tempDirectory,
        stagedDownloads,
        at,
        archiveAbortController,
        timeoutMs,
        downloadConcurrency,
      );
    }

    try {
      for (let index = 0; index < expanded.length; index += 1) {
        const file = expanded[index];
        const fileStartedAt = Date.now();

        let nodeStream: Readable | null = null;
        let tempPath: string | null = null;

        const stagedPromise = stagedDownloads.get(index);
        if (stagedPromise) {
          const staged = await stagedPromise;
          stagedDownloads.delete(index);
          if (isFailedArchiveStage(staged)) {
            failedFiles += 1;
            this.logger.warn(
              `Archive file download failed: bucket=${file.bucket}, path=${file.path}, archivePath=${file.archivePath}, status=${staged.status ?? 'network-error'}, error=${staged.error instanceof Error ? staged.error.message : 'unknown'}`,
            );
            continue;
          }
          tempPath = staged.tempPath;
          nodeStream = createReadStream(tempPath);
          this.logger.debug(
            `Archive file streaming started from prefetch: index=${index}, bucket=${file.bucket}, path=${file.path}, archivePath=${file.archivePath}`,
          );
        } else {
          nodeStream = await this.openDialDownloadStream(
            file,
            at,
            archiveAbortController,
            timeoutMs,
          );
          if (nodeStream == null) {
            failedFiles += 1;
            continue;
          }
          this.logger.debug(
            `Archive file streaming started: index=${index}, bucket=${file.bucket}, path=${file.path}, archivePath=${file.archivePath}`,
          );
        }

        archive.append(nodeStream, { name: file.archivePath });
        await finished(nodeStream);
        if (tempPath != null) {
          await rm(tempPath, { force: true });
        }
        appendedFiles += 1;
        this.logger.debug(
          `Archive file streamed: index=${index}, bucket=${file.bucket}, path=${file.path}, archivePath=${file.archivePath}, archiveBytes=${archive.pointer()}, elapsedMs=${Date.now() - fileStartedAt}`,
        );
      }

      if (appendedFiles === 0) {
        this.logger.error(
          `Archive contains no files: requestedItems=${items.length}, expandedFiles=${expanded.length}, failedFiles=${failedFiles}`,
        );
      }

      this.logger.debug(
        `Archive finalization started: appendedFiles=${appendedFiles}, archiveBytes=${archive.pointer()}`,
      );
      await archive.finalize();
      this.logger.log(
        `Archive download completed: appendedFiles=${appendedFiles}, failedFiles=${failedFiles}, archiveBytes=${archive.pointer()}, elapsedMs=${Date.now() - startedAt}`,
      );
    } finally {
      clearTimeout(timeout);
      archiveAbortController.abort();
      await rm(tempDirectory, { recursive: true, force: true });
    }
  }

  async deleteFiles(
    items: DeleteItemDto[],
    at: string,
  ): Promise<DeleteFilesResponseDto> {
    this.logger.log(`Delete files started: batchSize=${items.length}`);

    const results: DeleteItemResultDto[] = await Promise.all(
      items.map((item) => this.deleteItem(item, at)),
    );

    const successCount = results.filter((r) => r.success).length;
    this.logger.log(
      `Delete files completed: batchSize=${items.length}, success=${successCount}, failed=${items.length - successCount}`,
    );

    return { results };
  }

  private async deleteItem(
    item: DeleteItemDto,
    at: string,
  ): Promise<DeleteItemResultDto> {
    if (item.nodeType === DeleteItemNodeType.Folder) {
      return this.deleteFolderItem(item, at);
    }
    return this.deleteFileItem(item.bucket, item.path, at);
  }

  private async deleteFileItem(
    bucket: string,
    relPath: string,
    at: string,
  ): Promise<DeleteItemResultDto> {
    this.logger.debug(`deleteFileItem: bucket=${bucket}, relPath=${relPath}`);
    try {
      const { error, response } = (await this.dialClient.client.deleteFile(
        bucket,
        relPath,
        {
          headers: getBearerAuthHeaders(at),
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        },
      )) as { error?: unknown; response: { status: number } };

      this.logger.debug(
        `deleteFileItem result: bucket=${bucket}, relPath=${relPath}, status=${response.status}, hasError=${error != null}`,
      );

      if (response.status === 404 || error == null) {
        return { path: relPath, success: true };
      }

      if (response.status === 403) {
        return { path: relPath, success: false, error: 'Forbidden' };
      }

      this.logger.warn(
        `deleteFileItem failed: bucket=${bucket}, relPath=${relPath}, status=${response.status}, error=${JSON.stringify(error)}`,
      );
      return { path: relPath, success: false, error: 'Delete failed' };
    } catch (err) {
      this.logger.error(
        `deleteFileItem exception: bucket=${bucket}, relPath=${relPath}, err=${err instanceof Error ? err.message : String(err)}`,
      );
      return { path: relPath, success: false, error: 'Delete failed' };
    }
  }

  private async deleteFolderItem(
    item: DeleteItemDto,
    at: string,
  ): Promise<DeleteItemResultDto> {
    const folderRelPath = item.path.endsWith('/') ? item.path : `${item.path}/`;

    let children: ExpandedFile[];
    try {
      children = await this.expandFolderContents(
        item.bucket,
        folderRelPath,
        '',
        at,
      );
    } catch {
      return { path: item.path, success: false, error: 'Delete failed' };
    }

    const childResults = await Promise.all(
      children.map((child) =>
        this.deleteFileItem(child.bucket, child.path, at),
      ),
    );

    const markerPath = `${folderRelPath}${MARKER_NAME}`;
    const markerResult = await this.deleteFileItem(item.bucket, markerPath, at);

    const anyChildFailed = childResults.some((r) => !r.success);
    if (
      anyChildFailed ||
      (!markerResult.success && markerResult.error !== undefined)
    ) {
      return {
        path: item.path,
        success: false,
        error: 'Partial folder delete',
      };
    }

    return { path: item.path, success: true };
  }

  async renameFiles(
    items: RenameItemDto[],
    at: string,
  ): Promise<RenameFilesResponseDto> {
    this.logger.log(`Rename files started: batchSize=${items.length}`);

    const results: RenameItemResultDto[] = await Promise.all(
      items.map((item) => this.renameItem(item, at)),
    );

    const successCount = results.filter((r) => r.success).length;
    this.logger.log(
      `Rename files completed: batchSize=${items.length}, successCount=${successCount}, failedCount=${items.length - successCount}`,
    );

    return { results };
  }

  private async renameItem(
    item: RenameItemDto,
    at: string,
  ): Promise<RenameItemResultDto> {
    if (item.nodeType === RenameItemNodeType.Folder) {
      return this.renameFolderItem(
        item.bucket,
        item.sourcePath,
        item.destinationPath,
        at,
      );
    }
    return this.renameFileItem(
      item.bucket,
      item.sourcePath,
      item.destinationPath,
      at,
    );
  }

  private async renameFileItem(
    bucket: string,
    sourcePath: string,
    destPath: string,
    at: string,
  ): Promise<RenameItemResultDto> {
    const sourceUrl = buildDialFileResourceUrl(bucket, sourcePath);
    const destinationUrl = buildDialFileResourceUrl(bucket, destPath);

    try {
      const { error, response } = (await this.dialClient.client.moveResource({
        headers: getBearerAuthHeaders(at),
        body: { sourceUrl, destinationUrl, overwrite: false },
        signal: AbortSignal.timeout(this.getTimeoutMs()),
      })) as { error?: unknown; response: { status: number } };

      if (error == null) {
        return { sourcePath, destinationPath: destPath, success: true };
      }

      const status = response.status;
      this.logger.warn(
        `renameFileItem failed: bucket=${bucket}, sourcePath=${sourcePath}, destPath=${destPath}, status=${status}`,
      );

      return {
        sourcePath,
        destinationPath: destPath,
        success: false,
        error: getRenameErrorMessage({ status }),
      };
    } catch (err) {
      this.logger.error(
        `renameFileItem exception: bucket=${bucket}, sourcePath=${sourcePath}, err=${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        sourcePath,
        destinationPath: destPath,
        success: false,
        error: getRenameErrorMessage(err),
      };
    }
  }

  private async renameFolderItem(
    bucket: string,
    sourceFolderPath: string,
    destFolderPath: string,
    at: string,
  ): Promise<RenameItemResultDto> {
    const srcPrefix = sourceFolderPath.endsWith('/')
      ? sourceFolderPath
      : `${sourceFolderPath}/`;
    const destPrefix = destFolderPath.endsWith('/')
      ? destFolderPath
      : `${destFolderPath}/`;

    let children: ExpandedFile[];
    try {
      children = await this.expandFolderContents(bucket, srcPrefix, '', at);
    } catch (err) {
      this.logger.error(
        `renameFolderItem expandFolderContents exception: bucket=${bucket}, sourceFolderPath=${sourceFolderPath}, err=${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        sourcePath: sourceFolderPath,
        destinationPath: destFolderPath,
        success: false,
        error: 'Rename failed',
      };
    }

    let anyFailed = false;
    for (const child of children) {
      const relative = child.archivePath;
      const destChildPath = `${destPrefix}${relative}`;
      const result = await this.renameFileItem(
        bucket,
        child.path,
        destChildPath,
        at,
      );
      if (!result.success) {
        anyFailed = true;
      }
    }

    if (anyFailed) {
      return {
        sourcePath: sourceFolderPath,
        destinationPath: destFolderPath,
        success: false,
        error: 'Partial rename',
      };
    }
    return {
      sourcePath: sourceFolderPath,
      destinationPath: destFolderPath,
      success: true,
    };
  }

  async copyFiles(
    items: CopyItemDto[],
    at: string,
  ): Promise<CopyFilesResponseDto> {
    this.logger.log(`Copy files started: batchSize=${items.length}`);

    const results: CopyItemResultDto[] = await Promise.all(
      items.map((item) => this.copyItem(item, at)),
    );

    const successCount = results.filter((r) => r.success).length;
    this.logger.log(
      `Copy files completed: batchSize=${items.length}, successCount=${successCount}, failedCount=${items.length - successCount}`,
    );

    return { results };
  }

  private async copyItem(
    item: CopyItemDto,
    at: string,
  ): Promise<CopyItemResultDto> {
    if (item.nodeType === CopyItemNodeType.Folder) {
      return this.copyFolderItem(
        item.bucket,
        item.sourcePath,
        item.destinationPath,
        at,
      );
    }
    return this.copyFileItem(
      item.bucket,
      item.sourcePath,
      item.destinationPath,
      at,
    );
  }

  private async copyFileItem(
    bucket: string,
    sourcePath: string,
    destPath: string,
    at: string,
  ): Promise<CopyItemResultDto> {
    const sourceUrl = buildDialFileResourceUrl(bucket, sourcePath);
    const destinationUrl = buildDialFileResourceUrl(bucket, destPath);

    try {
      const { error, response } = (await this.dialClient.client.copyResource({
        headers: getBearerAuthHeaders(at),
        body: { sourceUrl, destinationUrl, overwrite: false },
        signal: AbortSignal.timeout(this.getTimeoutMs()),
      })) as { error?: unknown; response: { status: number } };

      if (error == null) {
        return { sourcePath, destinationPath: destPath, success: true };
      }

      const status = response.status;
      this.logger.warn(
        `copyFileItem failed: bucket=${bucket}, sourcePath=${sourcePath}, destPath=${destPath}, status=${status}`,
      );

      return {
        sourcePath,
        destinationPath: destPath,
        success: false,
        error: getCopyErrorMessage({ status }),
      };
    } catch (err) {
      this.logger.error(
        `copyFileItem exception: bucket=${bucket}, sourcePath=${sourcePath}, err=${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        sourcePath,
        destinationPath: destPath,
        success: false,
        error: getCopyErrorMessage(err),
      };
    }
  }

  private async copyFolderItem(
    bucket: string,
    sourceFolderPath: string,
    destFolderPath: string,
    at: string,
  ): Promise<CopyItemResultDto> {
    const srcPrefix = sourceFolderPath.endsWith('/')
      ? sourceFolderPath
      : `${sourceFolderPath}/`;
    const destPrefix = destFolderPath.endsWith('/')
      ? destFolderPath
      : `${destFolderPath}/`;

    let children: ExpandedFile[];
    try {
      children = await this.expandFolderContents(bucket, srcPrefix, '', at);
    } catch (err) {
      this.logger.error(
        `copyFolderItem expandFolderContents exception: bucket=${bucket}, sourceFolderPath=${sourceFolderPath}, err=${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        sourcePath: sourceFolderPath,
        destinationPath: destFolderPath,
        success: false,
        error: 'Copy failed',
      };
    }

    let anyFailed = false;
    for (const child of children) {
      const relative = child.archivePath;
      const destChildPath = `${destPrefix}${relative}`;
      const result = await this.copyFileItem(
        bucket,
        child.path,
        destChildPath,
        at,
      );
      if (!result.success) {
        anyFailed = true;
      }
    }

    if (anyFailed) {
      return {
        sourcePath: sourceFolderPath,
        destinationPath: destFolderPath,
        success: false,
        error: 'Partial copy',
      };
    }
    return {
      sourcePath: sourceFolderPath,
      destinationPath: destFolderPath,
      success: true,
    };
  }

  async moveFiles(
    items: MoveItemDto[],
    at: string,
  ): Promise<MoveFilesResponseDto> {
    this.logger.log(`Move files started: batchSize=${items.length}`);

    const results: MoveItemResultDto[] = await Promise.all(
      items.map((item) => this.moveItem(item, at)),
    );

    const successCount = results.filter((r) => r.success).length;
    this.logger.log(
      `Move files completed: batchSize=${items.length}, successCount=${successCount}, failedCount=${items.length - successCount}`,
    );

    return { results };
  }

  private async moveItem(
    item: MoveItemDto,
    at: string,
  ): Promise<MoveItemResultDto> {
    if (item.nodeType === MoveItemNodeType.Folder) {
      return this.moveFolderItem(
        item.bucket,
        item.sourcePath,
        item.destinationPath,
        at,
      );
    }
    return this.moveFileItem(
      item.bucket,
      item.sourcePath,
      item.destinationPath,
      at,
    );
  }

  private async moveFileItem(
    bucket: string,
    sourcePath: string,
    destPath: string,
    at: string,
  ): Promise<MoveItemResultDto> {
    const sourceUrl = buildDialFileResourceUrl(bucket, sourcePath);
    const destinationUrl = buildDialFileResourceUrl(bucket, destPath);

    try {
      const { error, response } = (await this.dialClient.client.moveResource({
        headers: getBearerAuthHeaders(at),
        body: { sourceUrl, destinationUrl, overwrite: false },
        signal: AbortSignal.timeout(this.getTimeoutMs()),
      })) as { error?: unknown; response: { status: number } };

      if (error == null) {
        return { sourcePath, destinationPath: destPath, success: true };
      }

      const status = response.status;
      this.logger.warn(
        `moveFileItem failed: bucket=${bucket}, sourcePath=${sourcePath}, destPath=${destPath}, status=${status}`,
      );

      return {
        sourcePath,
        destinationPath: destPath,
        success: false,
        error: getMoveErrorMessage({ status }),
      };
    } catch (err) {
      this.logger.error(
        `moveFileItem exception: bucket=${bucket}, sourcePath=${sourcePath}, err=${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        sourcePath,
        destinationPath: destPath,
        success: false,
        error: getMoveErrorMessage(err),
      };
    }
  }

  private async moveFolderItem(
    bucket: string,
    sourceFolderPath: string,
    destFolderPath: string,
    at: string,
  ): Promise<MoveItemResultDto> {
    const srcPrefix = sourceFolderPath.endsWith('/')
      ? sourceFolderPath
      : `${sourceFolderPath}/`;
    const destPrefix = destFolderPath.endsWith('/')
      ? destFolderPath
      : `${destFolderPath}/`;

    let children: ExpandedFile[];
    try {
      children = await this.expandFolderContents(bucket, srcPrefix, '', at);
    } catch (err) {
      this.logger.error(
        `moveFolderItem expandFolderContents exception: bucket=${bucket}, sourceFolderPath=${sourceFolderPath}, err=${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        sourcePath: sourceFolderPath,
        destinationPath: destFolderPath,
        success: false,
        error: 'Move failed',
      };
    }

    let anyFailed = false;
    for (const child of children) {
      const relative = child.archivePath;
      const destChildPath = `${destPrefix}${relative}`;
      const result = await this.moveFileItem(
        bucket,
        child.path,
        destChildPath,
        at,
      );
      if (!result.success) {
        anyFailed = true;
      }
    }

    if (anyFailed) {
      return {
        sourcePath: sourceFolderPath,
        destinationPath: destFolderPath,
        success: false,
        error: 'Partial move',
      };
    }
    return {
      sourcePath: sourceFolderPath,
      destinationPath: destFolderPath,
      success: true,
    };
  }

  private fillArchiveDownloadPool(
    expanded: ExpandedFile[],
    tempDirectory: string,
    stagedDownloads: Map<number, Promise<ArchiveStageResult>>,
    at: string,
    abortController: AbortController,
    timeoutMs: number,
    concurrency: number,
  ): void {
    let nextIndex = 1;
    let inFlight = 0;

    const schedule = (): void => {
      while (inFlight < concurrency && nextIndex < expanded.length) {
        const index = nextIndex;
        nextIndex += 1;
        inFlight += 1;
        this.startArchiveFilePrefetch(
          index,
          expanded[index],
          tempDirectory,
          stagedDownloads,
          at,
          abortController,
          timeoutMs,
          () => {
            inFlight -= 1;
            schedule();
          },
        );
      }
    };

    schedule();
  }

  private startArchiveFilePrefetch(
    index: number,
    file: ExpandedFile,
    tempDirectory: string,
    stagedDownloads: Map<number, Promise<ArchiveStageResult>>,
    at: string,
    abortController: AbortController,
    timeoutMs: number,
    onSettled?: () => void,
  ): void {
    if (stagedDownloads.has(index)) {
      return;
    }

    const tempPath = join(tempDirectory, `${index}.download`);
    this.logger.debug(
      `Archive file prefetch started: index=${index}, bucket=${file.bucket}, path=${file.path}, archivePath=${file.archivePath}`,
    );
    stagedDownloads.set(
      index,
      this.stageArchiveFileToTemp(
        file,
        tempPath,
        at,
        abortController,
        timeoutMs,
      ).finally(() => {
        onSettled?.();
      }),
    );
  }

  private async openDialDownloadStream(
    file: ExpandedFile,
    at: string,
    abortController: AbortController,
    timeoutMs: number,
  ): Promise<Readable | null> {
    try {
      const {
        data: downloadedStream,
        error,
        response,
      } = (await this.dialClient.client.downloadFile(file.bucket, file.path, {
        headers: getBearerAuthHeaders(at),
        parseAs: 'stream',
        signal: AbortSignal.any([
          abortController.signal,
          AbortSignal.timeout(timeoutMs),
        ]),
      })) as { data?: ReadableStream; error?: unknown; response?: Response };

      if (error != null) {
        this.logger.warn(
          `Archive file download failed: bucket=${file.bucket}, path=${file.path}, archivePath=${file.archivePath}, status=${response?.status ?? 'network-error'}, error=${error instanceof Error ? error.message : 'unknown'}`,
        );
        return null;
      }

      const webStream = downloadedStream ?? response?.body;
      if (webStream == null) {
        this.logger.warn(
          `Archive file download failed: bucket=${file.bucket}, path=${file.path}, archivePath=${file.archivePath}, status=${response?.status ?? 'network-error'}, error=DIAL Core returned no file stream`,
        );
        return null;
      }

      return Readable.fromWeb(webStream);
    } catch (error) {
      this.logger.warn(
        `Archive file download failed: bucket=${file.bucket}, path=${file.path}, archivePath=${file.archivePath}, error=${error instanceof Error ? error.message : 'unknown'}`,
      );
      return null;
    }
  }

  private async stageArchiveFileToTemp(
    file: ExpandedFile,
    tempPath: string,
    at: string,
    abortController: AbortController,
    timeoutMs: number,
  ): Promise<ArchiveStageResult> {
    try {
      const nodeStream = await this.openDialDownloadStream(
        file,
        at,
        abortController,
        timeoutMs,
      );
      if (nodeStream == null) {
        return { error: new Error('DIAL Core download failed') };
      }

      await pipeline(nodeStream, createWriteStream(tempPath));
      this.logger.debug(
        `Archive file staged: bucket=${file.bucket}, path=${file.path}, archivePath=${file.archivePath}`,
      );
      return { tempPath };
    } catch (error) {
      return { error };
    }
  }
}
