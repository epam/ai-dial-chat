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
  mapDialHttpStatus,
} from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { StringUtils } from '../../common/utils/string-utils';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../../dial/dial-client.service';
import {
  buildDialFileUrl,
  encodeDialFilePath,
} from '../dial-resource-path.util';
import type {
  UploadArchiveEntryResultDto,
  UploadArchiveResponseDto,
} from '../dto/upload-archive.dto';
import type { FileUploadResponseDto } from '../dto/upload-file-response.dto';
import type { UploadMode } from '../dto/upload-file.dto';
import {
  UPLOAD_CHUNK_BYTES,
  UPLOAD_MAX_DURATION_MS,
  UPLOAD_RESPONSE_TIMEOUT_MS,
  UploadAbortReason,
  UploadWatchdog,
  type UploadWatchdogLimits,
  sliceBuffer,
} from './upload-watchdog';

interface ArchiveEntryPathResult {
  isDirectory: boolean;
  safeRelativePath: string | null;
}

interface ArchiveFileEntry {
  entry: yauzl.Entry;
  fileName: string;
  safeRelativePath: string | null;
}

interface UploadedFileMeta {
  mimetype: string;
  originalname?: string;
}

/** A file multer staged to a temporary path on disk. */
export interface StagedUploadFile extends UploadedFileMeta {
  path: string;
  size: number;
}

/** A file already held in memory (the zero-byte folder marker). */
export interface BufferedUploadFile extends UploadedFileMeta {
  buffer: Buffer;
}

/**
 * A request body read as it arrives (`PUT /api/v1/files/content`). `size` is
 * the declared `Content-Length`; the stream must end with exactly that many
 * bytes.
 */
export interface StreamedUploadFile extends UploadedFileMeta {
  stream: Readable;
  size: number;
}

export type UploadedFile =
  StagedUploadFile | BufferedUploadFile | StreamedUploadFile;

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

const UPLOAD_ABORT_MESSAGES: Record<UploadAbortReason, string> = {
  [UploadAbortReason.Stalled]:
    'File upload stalled: no data reached DIAL Core within the idle limit',
  [UploadAbortReason.ResponseTimeout]:
    'DIAL Core did not respond after the file was sent',
  [UploadAbortReason.MaxDuration]:
    'File upload exceeded the maximum allowed duration',
};

const getUploadedFileSize = (file: UploadedFile): number =>
  'buffer' in file ? file.buffer.length : file.size;

/**
 * Passes the chunks of `stream` through and errors unless it ends with exactly
 * `size` bytes, so a short body aborts the DIAL Core request instead of
 * completing a truncated file. `destroyOnReturn: false` leaves the stream to
 * its owner when the upload stops early: destroying an unfinished request
 * would close the socket before the error response reaches the browser.
 */
async function* readExactly(
  stream: Readable,
  size: number,
): AsyncGenerator<Buffer> {
  let received = 0;
  for await (const chunk of stream.iterator({ destroyOnReturn: false })) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    received += buffer.length;
    if (received > size) {
      throw new Error(`Upload body exceeded its declared ${size} bytes`);
    }
    yield buffer;
  }
  if (received !== size) {
    throw new Error(
      `Upload body ended after ${received} of its declared ${size} bytes`,
    );
  }
}

const readUploadedFile = (
  file: UploadedFile,
): AsyncIterable<Buffer> | Iterable<Buffer> => {
  if ('buffer' in file) {
    return sliceBuffer(file.buffer);
  }
  if ('stream' in file) {
    return readExactly(file.stream, file.size);
  }
  return createReadStream(file.path, { highWaterMark: UPLOAD_CHUNK_BYTES });
};

interface StreamUploadOptions {
  /** Sends `If-None-Match: *` so DIAL Core rejects an existing path with 412. Defaults to true. */
  createOnly?: boolean;
  fileName?: string;
  contentType?: string;
  /**
   * Encodes `path` for the DIAL Core URL. Archive entries carry plain names
   * (encode once); a single-file request path may already be percent-encoded
   * (decode each segment once, then encode).
   */
  encodePath?: (path: string) => string;
}

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

  private getUploadLimits(): UploadWatchdogLimits {
    return {
      idleMs: this.getTimeoutMs(),
      responseMs: UPLOAD_RESPONSE_TIMEOUT_MS,
      maxDurationMs: UPLOAD_MAX_DURATION_MS,
    };
  }

  /*
   * The file (staged on disk, or the in-memory folder marker) is handed to
   * DIAL Core as a stream of bounded chunks so the transfer is bounded by
   * progress (idle / response timeouts) instead of one absolute timer that
   * large files outlive. Shares the DIAL Core upload contract
   * (`If-None-Match: '*'`, 412 -> 409 Conflict) with archive entries through
   * uploadFileStream().
   *
   * `clientSignal` aborts the transfer when the caller goes away (the browser
   * closing a streamed request body); it is combined with the watchdog.
   */
  async uploadFile(
    bucket: string,
    path: string,
    file: UploadedFile,
    token: string,
    uploadMode?: UploadMode,
    clientSignal?: AbortSignal,
  ): Promise<FileUploadResponseDto> {
    const fileSize = getUploadedFileSize(file);
    this.logger.debug(
      `Uploading file to DIAL Core: bucket=${bucket}, path=${path}, mimetype=${file.mimetype}, size=${fileSize}, uploadMode=${uploadMode ?? 'overwrite'}`,
    );

    const watchdog = new UploadWatchdog(this.getUploadLimits());
    const signal =
      clientSignal == null
        ? watchdog.signal
        : AbortSignal.any([watchdog.signal, clientSignal]);

    try {
      await this.uploadFileStream(
        bucket,
        path,
        Readable.from(watchdog.watch(readUploadedFile(file))),
        fileSize,
        token,
        signal,
        {
          createOnly: uploadMode === 'create-only',
          fileName: file.originalname ?? getFileNameFromPath(path),
          contentType: file.mimetype,
          encodePath: encodeDialResourcePath,
        },
      );

      const url = buildDialFileUrl(bucket, path);
      this.logger.debug(
        `File upload succeeded: bucket=${bucket}, path=${path}, url=${url}`,
      );
      return { url };
    } catch (err) {
      if (watchdog.reason !== undefined) {
        this.logger.error(
          `Upload aborted (${watchdog.reason}) for ${bucket}/${path}, size=${fileSize}`,
        );
        throw new ServiceUnavailableException(
          UPLOAD_ABORT_MESSAGES[watchdog.reason],
        );
      }
      if (clientSignal?.aborted) {
        this.logger.warn(
          `Upload aborted: the client closed the upload for ${bucket}/${path}, size=${fileSize}`,
        );
        throw new BadRequestException('The client closed the upload');
      }
      if (!(err instanceof HttpException)) {
        this.logger.error(`Upload failed for ${bucket}/${path}`, err);
      }
      throw err;
    } finally {
      watchdog.dispose();
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
    let cumulativeBytes = 0;
    const tempDirectory = await mkdtemp(join(tmpdir(), 'dial-upload-archive-'));

    /*
     * decodeStrings: false — yauzl's own filename validation aborts the
     * *whole* archive on the first unsafe entry name, but D4 requires
     * per-entry rejection (record a failed result, keep processing the
     * rest). Reading the raw name lets resolveArchiveEntryPath be the sole
     * zip-slip authority.
     *
     * autoClose: false — keep the file descriptor open after eachEntry()
     * exhausts all central-directory records so the extraction pass can call
     * openReadStreamPromise() on the pre-collected entries.
     */
    const zipfile = await yauzl
      .openPromise(archivePath, {
        lazyEntries: true,
        decodeStrings: false,
        autoClose: false,
      })
      .catch(async (err: unknown) => {
        await this.removeArchiveUploadTempDirectory(tempDirectory);
        throw err;
      });

    this.logger.log(
      `Archive upload started: bucket=${bucket}, entryCount=${zipfile.entryCount}`,
    );

    try {
      /*
       * Pass 1: read all central-directory metadata without opening any read
       * streams. Enforcing the file-count limit here ensures no bytes are
       * extracted before the check fires, as required by spec.
       *
       * Guard against directory-entry amplification: directory entries are
       * skipped by the per-file counter below, so a crafted archive with many
       * directory entries would iterate them all unchecked. The compressed-size
       * pre-check already bounds the central-directory size; this caps the
       * total iteration count (directories + files combined).
       */
      if (zipfile.entryCount > maxFiles * 10) {
        throw new UnprocessableEntityException(
          `Archive contains too many entries`,
        );
      }

      const fileEntries: ArchiveFileEntry[] = [];
      let fileEntryCount = 0;
      for await (const entry of zipfile.eachEntry()) {
        const fileName = this.decodeArchiveEntryName(entry.fileName);
        const { isDirectory, safeRelativePath } =
          this.resolveArchiveEntryPath(fileName);
        if (isDirectory) {
          continue;
        }

        fileEntryCount += 1;
        if (fileEntryCount > maxFiles) {
          throw new UnprocessableEntityException(
            `Archive contains more than ${maxFiles} files`,
          );
        }

        fileEntries.push({ entry, fileName, safeRelativePath });
      }

      /*
       * Pass 2: extract and upload. The file-count limit has already been
       * validated; the abort signal and uncompressed-bytes budget are still
       * enforced per entry.
       */
      let entryIndex = 0;
      for (const { entry, fileName, safeRelativePath } of fileEntries) {
        this.throwIfArchiveUploadAborted(signal);

        entryIndex += 1;

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
          `${entryIndex}-${randomUUID()}.entry`,
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
              entryBytes,
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
    fileSize: number,
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
          fileSize,
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
    fileSize: number,
    token: string,
    signal: AbortSignal,
  ): Promise<void> {
    const stream = createReadStream(tempPath);
    await this.uploadFileStream(bucket, path, stream, fileSize, token, signal);
  }

  /*
   * Single DIAL Core upload implementation, shared by uploadFile() (buffered
   * single files) and archive extraction (staged files streamed from disk).
   * Raw fetch instead of the SDK helper, which requires a whole FormData/Blob.
   * Create-only (`If-None-Match: '*'`, 412 -> 409 Conflict) unless
   * `options.createOnly` is false.
   *
   * `fileSize` makes the multipart body length known up front, so the request
   * carries an exact `Content-Length` instead of chunked transfer encoding.
   * DIAL Core enforces `storage.maxUploadedFileSize` against that header only.
   */
  private async uploadFileStream(
    bucket: string,
    path: string,
    fileStream: Readable,
    fileSize: number,
    token: string,
    signal: AbortSignal,
    options: StreamUploadOptions = {},
  ): Promise<void> {
    const {
      createOnly = true,
      fileName = getFileNameFromPath(path),
      contentType = 'application/octet-stream',
      encodePath = encodeDialFilePath,
    } = options;
    this.throwIfArchiveUploadAborted(signal);

    /* boundary is UUIDv4 and cannot be influenced by user input — safe to
       interpolate directly into Content-Type and the multipart preamble. */
    const boundary = `dial-upload-${randomUUID()}`;
    const { preamble, epilogue } = this.buildMultipartEnvelope(
      boundary,
      fileName,
      contentType,
    );
    const contentLength = preamble.length + fileSize + epilogue.length;
    const multipartStream = this.createMultipartFileStream(
      fileStream,
      preamble,
      epilogue,
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
      const response = await this.dialClient.fetchCore(
        this.buildDialUploadUrl(bucket, encodePath(path)),
        {
          method: 'PUT',
          headers: {
            ...getBearerAuthHeaders(token),
            ...(createOnly ? { 'If-None-Match': '*' } : {}),
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': String(contentLength),
          },
          body: Readable.toWeb(multipartStream) as RequestInit['body'],
          signal,
          duplex: 'half',
        } as RequestInit & { duplex: 'half' },
      );

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
      /* The owner of the signal reports why it aborted (watchdog limit, archive timeout, client gone). */
      if (signal.aborted && !(err instanceof HttpException)) {
        throw err;
      }
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

  private buildMultipartEnvelope(
    boundary: string,
    fileName: string,
    contentType: string,
  ): { preamble: Buffer; epilogue: Buffer } {
    const safeFileName = fileName.replace(/[\r\n"]/g, '_');
    const safeContentType = contentType.replace(/[\r\n]/g, '');

    return {
      preamble: Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeFileName}"\r\nContent-Type: ${safeContentType}\r\n\r\n`,
      ),
      epilogue: Buffer.from(`\r\n--${boundary}--\r\n`),
    };
  }

  private createMultipartFileStream(
    fileStream: Readable,
    preamble: Buffer,
    epilogue: Buffer,
  ): Readable {
    async function* parts(): AsyncGenerator<Buffer> {
      yield preamble;
      for await (const chunk of fileStream) {
        yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      }
      yield epilogue;
    }

    return Readable.from(parts());
  }

  private buildDialUploadUrl(bucket: string, encodedPath: string): string {
    const baseUrl = StringUtils.stripTrailingSlashes(this.dialClient.baseUrl);
    return `${baseUrl}/v1/files/${encodeURIComponent(bucket)}/${encodedPath}`;
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
      entryFileName.split('/').some((seg) => seg === '..' || seg === '.');

    return {
      isDirectory: false,
      safeRelativePath: isUnsafe ? null : entryFileName,
    };
  }
}
