import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as yauzl from 'yauzl';
import type { EnvironmentVariables } from '../../config/environment.config';
import type {
  UploadArchiveEntryResultDto,
  UploadArchiveResponseDto,
} from '../dto/upload-archive.dto';
import {
  ARCHIVE_ENTRY_CONFLICT_RETRY_LIMIT,
  buildDeduplicatedFilePath,
  decodeArchiveEntryName,
  isConflictError,
  resolveArchiveEntryPath,
} from './archive-upload';
import {
  FilesUploadService,
  type UploadedArchiveFile,
} from './files-upload.service';
import { throwIfUploadAborted } from './upload-abort';

interface ArchiveFileEntry {
  entry: yauzl.Entry;
  fileName: string;
  safeRelativePath: string | null;
}

/**
 * ZIP archive upload (`POST /api/v1/files/upload-archive`): enforces the
 * archive limits and timeout, scans the central directory, stages each entry
 * to a temp file and uploads it through `FilesUploadService.uploadFileStream`,
 * renaming on conflict.
 */
@Injectable()
export class FilesArchiveUploadService {
  private readonly logger = new Logger(FilesArchiveUploadService.name);

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
    private readonly filesUploadService: FilesUploadService,
  ) {}

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
        const fileName = decodeArchiveEntryName(entry.fileName);
        const { isDirectory, safeRelativePath } =
          resolveArchiveEntryPath(fileName);
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
        throwIfUploadAborted(signal);

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
          throwIfUploadAborted(signal);

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
        throwIfUploadAborted(signal);

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
    throwIfUploadAborted(signal);

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
      throwIfUploadAborted(signal);
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
    await this.filesUploadService.uploadFileStream(
      bucket,
      path,
      stream,
      fileSize,
      token,
      signal,
    );
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
}
