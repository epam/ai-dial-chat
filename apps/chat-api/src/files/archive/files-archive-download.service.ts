import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { finished, pipeline } from 'node:stream/promises';
import { Injectable, Logger, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import archiver from 'archiver';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../../dial/dial-client.service';
import { toRelativePath } from '../dial-resource-path.util';
import type { ArchiveItemDto } from '../dto/download-archive.dto';
import { ArchiveItemNodeType } from '../dto/download-archive.dto';
import type { ExpandedFile } from '../listing/files-listing.service';
import { FilesListingService } from '../listing/files-listing.service';

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

export interface ArchiveDownloadResult {
  stream: Readable;
  headers: Record<string, string>;
  /** Call when the client disconnects before the stream finishes, mirroring the previous `res.on('close')` handling. */
  abortOnDisconnect: () => void;
}

/** Request-scoped state `populateArchive` needs purely for logging/cancellation — bundled so it isn't threaded through as loose positional params. */
interface ArchivePopulationContext {
  requestedItemCount: number;
  startedAt: number;
  timeoutMs: number;
  downloadConcurrency: number;
  timeout: NodeJS.Timeout;
  abortController: AbortController;
}

@Injectable()
export class FilesArchiveDownloadService {
  private readonly logger = new Logger(FilesArchiveDownloadService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly configService: ConfigService<EnvironmentVariables>,
    private readonly filesListingService: FilesListingService,
  ) {}

  private getTimeoutMs(): number {
    return this.configService.get<number>('FILE_TRANSFER_TIMEOUT_MS') ?? 30_000;
  }

  async downloadArchive(
    items: ArchiveItemDto[],
    at: string,
  ): Promise<ArchiveDownloadResult> {
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
        const files = await this.filesListingService.expandFolderContents(
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
        const relPath = toRelativePath(item.path, item.bucket);
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

    // Compute headers — the caller (controller) commits them before piping the stream
    const archiveName =
      items.length === 1 ? `${items[0].name}.zip` : 'files.zip';
    const safeName = archiveName.replace(/[^\w.-]/g, '_');
    const headers: Record<string, string> = {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    };

    const archive = archiver('zip', { store: true });
    archive.on('warning', (error) => {
      this.logger.warn(`Archive warning: ${error.message}`);
    });
    archive.on('error', (error) => {
      this.logger.error(`Archive stream error: ${error.message}`, error.stack);
    });

    const archiveAbortController = new AbortController();
    let timedOutOrAborted = false;
    const timeout = setTimeout(() => {
      this.logger.error(
        `Archive generation timed out: expandedFiles=${expanded.length}, elapsedMs=${Date.now() - startedAt}`,
      );
      timedOutOrAborted = true;
      archiveAbortController.abort();
      archive.abort();
    }, timeoutMs);

    const abortOnDisconnect = (): void => {
      if (timedOutOrAborted) return;
      timedOutOrAborted = true;
      this.logger.warn(
        `Archive response closed before completion: expandedFiles=${expanded.length}, archiveBytes=${archive.pointer()}, elapsedMs=${Date.now() - startedAt}`,
      );
      clearTimeout(timeout);
      archiveAbortController.abort();
      archive.abort();
    };

    /*
     * `populateArchive` fills the archive stream after we've already returned
     * it to the caller (the controller starts piping before this resolves),
     * so nothing downstream is left to catch a rejection from this call — it
     * must handle and log its own failures. Losing this `.catch()` turns any
     * error here (including the routine timeout-driven abort below) into an
     * unhandled promise rejection.
     */
    void this.populateArchive(archive, expanded, at, {
      requestedItemCount: items.length,
      startedAt,
      timeoutMs,
      downloadConcurrency,
      timeout,
      abortController: archiveAbortController,
    }).catch((err: unknown) => {
      this.logger.error(
        `Archive generation failed asynchronously: expandedFiles=${expanded.length}, elapsedMs=${Date.now() - startedAt}`,
        err instanceof Error ? err.stack : String(err),
      );
      archive.destroy(err instanceof Error ? err : new Error(String(err)));
    });

    return { stream: archive, headers, abortOnDisconnect };
  }

  private async populateArchive(
    archive: archiver.Archiver,
    expanded: ExpandedFile[],
    at: string,
    context: ArchivePopulationContext,
  ): Promise<void> {
    const {
      requestedItemCount,
      startedAt,
      timeoutMs,
      downloadConcurrency,
      timeout,
      abortController: archiveAbortController,
    } = context;

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
          `Archive contains no files: requestedItems=${requestedItemCount}, expandedFiles=${expanded.length}, failedFiles=${failedFiles}`,
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
      } = (await this.dialClient.client.downloadFile(
        file.bucket,
        encodeDialResourcePath(file.path),
        {
          headers: getBearerAuthHeaders(at),
          parseAs: 'stream',
          signal: AbortSignal.any([
            abortController.signal,
            AbortSignal.timeout(timeoutMs),
          ]),
        },
      )) as { data?: ReadableStream; error?: unknown; response?: Response };

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
