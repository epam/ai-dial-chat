import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import type { FileUploadResponseDto } from '../dto/upload-file-response.dto';
import { UploadMode } from '../types/upload-mode.enum';
import { throwIfUploadAborted } from './upload-abort';
import {
  UPLOAD_CHUNK_BYTES,
  UPLOAD_MAX_DURATION_MS,
  UPLOAD_RESPONSE_TIMEOUT_MS,
  UploadAbortReason,
  UploadWatchdog,
  type UploadWatchdogLimits,
  sliceBuffer,
} from './upload-watchdog';

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

export interface StreamUploadOptions {
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
          createOnly: uploadMode === UploadMode.CreateOnly,
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

  /*
   * Single DIAL Core upload implementation, shared by uploadFile() (buffered
   * single files) and FilesArchiveUploadService (archive entries staged on
   * disk and streamed from there).
   * Raw fetch instead of the SDK helper, which requires a whole FormData/Blob.
   * Create-only (`If-None-Match: '*'`, 412 -> 409 Conflict) unless
   * `options.createOnly` is false.
   *
   * `fileSize` makes the multipart body length known up front, so the request
   * carries an exact `Content-Length` instead of chunked transfer encoding.
   * DIAL Core enforces `storage.maxUploadedFileSize` against that header only.
   */
  async uploadFileStream(
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
    throwIfUploadAborted(signal);

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
       * staged file again. `uploadCore` (not native fetch) because native
       * fetch ignores socket backpressure on a streamed body and would queue
       * the whole file in memory when DIAL Core reads slower than the source.
       */
      const response = await this.dialClient.uploadCore(
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
      /* Only the status is used; release the connection. */
      await response.body?.cancel();

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
}
