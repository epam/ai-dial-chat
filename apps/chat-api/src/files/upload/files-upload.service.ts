import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
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
import * as yauzl from 'yauzl';
import {
  handleDialFetchError,
  handleDialSdkError,
  mapDialHttpStatus,
} from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { StringUtils } from '../../common/utils/string-utils';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../../dial/dial-client.service';
import { buildDialFileUrl } from '../dial-resource-path.util';
import type {
  UploadArchiveEntryResultDto,
  UploadArchiveResponseDto,
} from '../dto/upload-archive.dto';
import type { FileUploadResponseDto } from '../dto/upload-file-response.dto';
import type { UploadMode } from '../dto/upload-file.dto';

interface ArchiveEntryPathResult {
  isDirectory: boolean;
  safeRelativePath: string | null;
}

export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
}

export interface UploadedArchiveFile {
  path: string;
  size?: number;
}

const getFileNameFromPath = (path: string): string =>
  path.split('/').filter(Boolean).pop() ?? 'file';

const DIAL_RESOURCE_SEGMENT_BYTE_LIMIT = 255;
const ARCHIVE_ENTRY_CONFLICT_RETRY_LIMIT = 50;

const splitFilePath = (
  path: string,
): { parentPath: string; fileName: string } => {
  const slashIndex = path.lastIndexOf('/');
  if (slashIndex === -1) {
    return { parentPath: '', fileName: path };
  }

  return {
    parentPath: path.slice(0, slashIndex + 1),
    fileName: path.slice(slashIndex + 1),
  };
};

const buildDeduplicatedFileName = (fileName: string, index: number): string => {
  const dotIndex = fileName.lastIndexOf('.');
  const hasExtension = dotIndex > 0;
  const baseName = hasExtension ? fileName.slice(0, dotIndex) : fileName;
  const extension = hasExtension ? fileName.slice(dotIndex) : '';
  const suffix = ` (${index})`;
  const suffixBytes = StringUtils.getUtf8ByteLength(suffix);
  const extensionLimit = Math.max(
    0,
    DIAL_RESOURCE_SEGMENT_BYTE_LIMIT - suffixBytes - 1,
  );
  const safeExtension = StringUtils.truncateToUtf8Bytes(
    extension,
    extensionLimit,
  );
  const baseLimit = Math.max(
    1,
    DIAL_RESOURCE_SEGMENT_BYTE_LIMIT -
      suffixBytes -
      StringUtils.getUtf8ByteLength(safeExtension),
  );
  const safeBase =
    StringUtils.truncateToUtf8Bytes(baseName, baseLimit).trimEnd() ||
    StringUtils.truncateToUtf8Bytes('file', baseLimit);

  return `${safeBase}${suffix}${safeExtension}`;
};

const buildDeduplicatedFilePath = (path: string, index: number): string => {
  const { parentPath, fileName } = splitFilePath(path);
  return `${parentPath}${buildDeduplicatedFileName(fileName, index)}`;
};

const isConflictError = (err: unknown): boolean =>
  err instanceof HttpException && err.getStatus() === HttpStatus.CONFLICT;

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

@Injectable()
export class FilesUploadService {
  private readonly logger = new Logger(FilesUploadService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  private getTimeoutMs(): number {
    return this.configService.get<number>('FILE_TRANSFER_TIMEOUT_MS') ?? 30_000;
  }

  /*
   * Parallels uploadFileStream() below: both independently implement the
   * DIAL Core create-only upload contract (`If-None-Match: '*'`, 412 -> 409
   * Conflict). uploadFileStream() can't reuse this SDK/FormData path without
   * re-buffering the staged archive entry into memory (design D2). If the
   * upload contract changes, update both.
   */
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
    let normalizedDestination = destinationPath;
    while (normalizedDestination.endsWith('/')) {
      normalizedDestination = normalizedDestination.slice(0, -1);
    }
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
          const uploadedPath =
            await this.uploadArchiveEntryWithDeduplicatedName(
              bucket,
              entryPath,
              entryTempPath,
              token,
              signal,
            );
          results.push({ path: uploadedPath, success: true });
        } catch (err) {
          this.throwIfArchiveUploadAborted(signal);

          results.push({
            path: entryPath,
            success: false,
            error: isConflictError(err)
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

  private async uploadArchiveEntryWithDeduplicatedName(
    bucket: string,
    path: string,
    tempPath: string,
    token: string,
    signal: AbortSignal,
  ): Promise<string> {
    let nextPath = path;

    for (
      let conflictIndex = 0;
      conflictIndex <= ARCHIVE_ENTRY_CONFLICT_RETRY_LIMIT;
      conflictIndex += 1
    ) {
      try {
        await this.uploadArchiveEntryFromTemp(
          bucket,
          nextPath,
          tempPath,
          token,
          signal,
        );
        return nextPath;
      } catch (err) {
        this.throwIfArchiveUploadAborted(signal);

        if (
          !isConflictError(err) ||
          conflictIndex === ARCHIVE_ENTRY_CONFLICT_RETRY_LIMIT
        ) {
          throw err;
        }

        nextPath = buildDeduplicatedFilePath(path, conflictIndex + 1);
        this.logger.warn(
          `Archive entry upload conflict: bucket=${bucket}, originalPath=${path}, retryPath=${nextPath}`,
        );
      }
    }

    throw new ConflictException('File already exists at this path');
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

  /*
   * Parallels uploadFile() above: both independently implement the DIAL Core
   * create-only upload contract (`If-None-Match: '*'`, 412 -> 409 Conflict).
   * This raw-fetch path exists only so archive extraction can stream from
   * disk instead of re-buffering into a FormData/Blob (design D2). If the
   * upload contract changes, update both.
   */
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
        body: Readable.toWeb(multipartStream) as RequestInit['body'],
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

  /** Decodes a yauzl entry name read with `decodeStrings: false` (raw `Buffer`), or passes a string through unchanged. */
  private decodeArchiveEntryName(rawFileName: string): string {
    const raw: unknown = rawFileName;
    return Buffer.isBuffer(raw) ? raw.toString('utf8') : rawFileName;
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
      entryFileName === '' ||
      entryFileName.startsWith('/') ||
      /^[a-zA-Z]:/.test(entryFileName) ||
      entryFileName.includes('\\') ||
      entryFileName.split('/').includes('..');

    return {
      isDirectory: false,
      safeRelativePath: isUnsafe ? null : entryFileName,
    };
  }
}
