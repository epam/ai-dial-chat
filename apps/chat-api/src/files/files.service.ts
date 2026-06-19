import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { finished, pipeline } from 'node:stream/promises';
import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import archiver from 'archiver';
import type { Response as ExpressResponse } from 'express';
import { AppService } from '../app/app.service';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { handleDialError } from '../common/utils/dial-error';
import type { EnvironmentVariables } from '../config/environment.config';
import type { CreateFolderResponseDto } from './dto/create-folder.dto';
import type { ArchiveItemDto } from './dto/download-archive.dto';
import { ArchiveItemNodeType } from './dto/download-archive.dto';
import type { FileMetadataResponseDto } from './dto/file-metadata-response.dto';
import type { ListFilesResponseDto } from './dto/list-files.dto';
import type { FileUploadResponseDto } from './dto/upload-file-response.dto';
import { FOLDER_NODE_TYPE, MARKER_NAME } from './files.constants';
import {
  summarizeDialRawItems,
  summarizeListFilesItems,
} from './list-items-debug';
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

interface StagedArchiveFile {
  file: ExpandedFile;
  tempPath: string;
  status: number;
  contentLength: string;
}

interface FailedArchiveFile {
  file: ExpandedFile;
  error: unknown;
  status?: number;
}

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

const buildDialFileUrl = (bucket: string, path: string): string =>
  `files/${bucket}/${path}`;

const getFileNameFromPath = (path: string): string =>
  path.split('/').filter(Boolean).pop() ?? 'file';

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
export class FilesService extends AppService {
  protected override readonly logger = new Logger(FilesService.name);

  constructor(configService: ConfigService<EnvironmentVariables>) {
    super(configService);
  }

  private getTimeoutMs(): number {
    return this.configService.get<number>('FILE_TRANSFER_TIMEOUT_MS') ?? 30_000;
  }

  async uploadFile(
    bucket: string,
    path: string,
    file: UploadedFile,
    token: string,
  ): Promise<FileUploadResponseDto> {
    try {
      this.logger.debug(
        `Uploading file to DIAL Core: bucket=${bucket}, path=${path}, mimetype=${file.mimetype}, size=${file.buffer.length}`,
      );

      const { data, error, response } = (await this.client.uploadFile(
        bucket,
        path,
        {
          headers: {
            ...getBearerAuthHeaders(token),
          },
          body: buildUploadFormData(file, path) as unknown as string,
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        },
      )) as { data?: { url?: string }; error?: unknown; response: Response };

      if (error != null) {
        this.logger.warn(
          `DIAL Core upload returned error: status=${response.status}, bucket=${bucket}, path=${path}`,
        );
        return handleDialError({ status: response.status });
      }

      const url = buildDialFileUrl(bucket, path);
      this.logger.debug(
        `File upload succeeded: bucket=${bucket}, path=${path}, url=${url}, upstreamUrl=${data?.url ?? ''}`,
      );
      return { url };
    } catch (err) {
      this.logger.error(`Upload failed for ${bucket}/${path}`, err);
      return handleDialError(err);
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
      const { data, error, response } = await this.client.getFileMetadata(
        bucket,
        normalizedPath,
        {
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
        },
      );

      if (error != null) {
        this.logger.warn(
          `DIAL Core listFiles returned error: status=${response.status}, bucket=${bucket}`,
        );
        return handleDialError({ status: response.status });
      }

      const dialData = (data ?? {}) as typeof data & {
        nextToken?: string;
        permissions?: string[];
        items?: DialFileItem[];
      };
      const rawItems = dialData.items ?? [];
      this.logger.debug(
        `listFiles DIAL raw: bucket=${bucket}, path=${normalizedPath}, count=${rawItems.length}, items=[${summarizeDialRawItems(rawItems)}]`,
      );

      const items = rawItems.map((item) => normalizeFileItem(item, bucket));
      const resolvedPermissions = resolveListingPermissions(
        rawItems,
        normalizedPath,
      );
      const permissions = dialData.permissions ?? resolvedPermissions;
      const permissionsSource = dialData.permissions
        ? 'dial'
        : resolvedPermissions
          ? 'marker'
          : 'none';

      this.logger.debug(
        `listFiles normalized: bucket=${bucket}, path=${normalizedPath}, count=${items.length}, items=[${summarizeListFilesItems(items)}], permissionsSource=${permissionsSource}, permissions=${JSON.stringify(permissions ?? [])}`,
      );
      return {
        bucket,
        path: normalizedPath,
        items,
        nextToken: dialData.nextToken,
        permissions,
      };
    } catch (err) {
      this.logger.warn(`listFiles failed for bucket=${bucket}`, err);
      return handleDialError(err);
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

      const { data, error, response } = await this.client.getFileMetadata(
        bucket,
        path,
        {
          headers: getBearerAuthHeaders(token),
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        },
      );

      if (error != null) {
        this.logger.warn(
          `DIAL Core getFileMetadata returned error: status=${response.status}, bucket=${bucket}, path=${path}`,
        );
        return handleDialError({ status: response.status });
      }

      if (data == null) {
        this.logger.warn(
          `DIAL Core getFileMetadata returned no data: bucket=${bucket}, path=${path}`,
        );
        return handleDialError({ status: response.status });
      }

      this.logger.debug(
        `getFileMetadata succeeded: bucket=${bucket}, path=${path}`,
      );

      const fileData = data as typeof data & { etag?: string };
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
      return handleDialError(err);
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
      } = await this.client.getFileMetadata(bucket, markerPath, {
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
        handleDialError({ status: metaStatus });
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
      return handleDialError(err);
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
      const { error, response } = (await this.client.downloadFile(
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
        return handleDialError({ status: response.status });
      }

      const headers = Object.fromEntries(
        SAFE_DOWNLOAD_HEADERS.map(
          (h) => [h, response.headers.get(h)] as const,
        ).filter(([, v]) => v !== null),
      ) as Record<string, string>;

      return { stream: response.body as ReadableStream, headers };
    } catch (err) {
      this.logger.error(`Download failed for ${bucket}/${path}`, err);
      return handleDialError(err);
    }
  }

  async expandFolderContents(
    bucket: string,
    folderPath: string,
    archiveRoot: string,
    at: string,
  ): Promise<ExpandedFile[]> {
    // DialFile.path is the full DIAL resource path: "files/{bucket}/reports/"
    // Both the metadata API and download SDK expect the relative path: "reports/"
    const relFolderPath = this.toRelativePath(folderPath, bucket);

    const results: ExpandedFile[] = [];
    let token: string | undefined;
    let page = 0;

    this.logger.debug(
      `Archive folder expansion started: bucket=${bucket}, inputPath=${folderPath}, relativePath=${relFolderPath}, archiveRoot=${archiveRoot}`,
    );

    do {
      page += 1;
      const { data, error, response } = await this.client.getFileMetadata(
        bucket,
        relFolderPath,
        {
          headers: getBearerAuthHeaders(at),
          params: {
            query: { recursive: true, limit: 1000, token },
          },
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        },
      );

      if (error != null) {
        this.logger.warn(
          `Archive folder metadata failed: bucket=${bucket}, path=${relFolderPath}, page=${page}, status=${response.status}`,
        );
        return handleDialError({
          status: (response as { status: number }).status,
        });
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

        const relative = relItemPath.startsWith(relFolderPath)
          ? relItemPath.slice(relFolderPath.length)
          : (item.name ?? relItemPath);

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

    try {
      const pendingDownloads = new Map<
        number,
        Promise<{
          index: number;
          result: StagedArchiveFile | FailedArchiveFile;
        }>
      >();
      const startDownload = (index: number): void => {
        const file = expanded[index];
        const tempPath = join(tempDirectory, `${index}.download`);
        this.logger.debug(
          `Archive file prefetch started: index=${index}, bucket=${file.bucket}, path=${file.path}, archivePath=${file.archivePath}`,
        );
        pendingDownloads.set(
          index,
          this.stageArchiveFile(
            index,
            file,
            tempPath,
            at,
            archiveAbortController,
            timeoutMs,
          ),
        );
      };

      let nextIndex = 0;
      while (nextIndex < Math.min(downloadConcurrency, expanded.length)) {
        startDownload(nextIndex);
        nextIndex += 1;
      }

      while (pendingDownloads.size > 0) {
        const completed = await Promise.race(pendingDownloads.values());
        pendingDownloads.delete(completed.index);

        if (nextIndex < expanded.length) {
          startDownload(nextIndex);
          nextIndex += 1;
        }

        const result = completed.result;
        if ('error' in result) {
          failedFiles += 1;
          this.logger.warn(
            `Archive file download failed: bucket=${result.file.bucket}, path=${result.file.path}, archivePath=${result.file.archivePath}, status=${result.status ?? 'network-error'}, error=${result.error instanceof Error ? result.error.message : 'unknown'}`,
          );
          continue;
        }

        const nodeStream = createReadStream(result.tempPath);
        archive.append(nodeStream, { name: result.file.archivePath });
        appendedFiles += 1;
        this.logger.debug(
          `Archive file queued: bucket=${result.file.bucket}, path=${result.file.path}, archivePath=${result.file.archivePath}, status=${result.status}, contentLength=${result.contentLength}`,
        );

        const fileStartedAt = Date.now();
        await finished(nodeStream);
        await rm(result.tempPath, { force: true });
        this.logger.debug(
          `Archive file streamed: bucket=${result.file.bucket}, path=${result.file.path}, archivePath=${result.file.archivePath}, archiveBytes=${archive.pointer()}, elapsedMs=${Date.now() - fileStartedAt}`,
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

  private async stageArchiveFile(
    index: number,
    file: ExpandedFile,
    tempPath: string,
    at: string,
    abortController: AbortController,
    timeoutMs: number,
  ): Promise<{ index: number; result: StagedArchiveFile | FailedArchiveFile }> {
    try {
      const {
        data: downloadedStream,
        error,
        response,
      } = (await this.client.downloadFile(file.bucket, file.path, {
        headers: getBearerAuthHeaders(at),
        parseAs: 'stream',
        signal: AbortSignal.any([
          abortController.signal,
          AbortSignal.timeout(timeoutMs),
        ]),
      })) as { data?: ReadableStream; error?: unknown; response?: Response };

      if (error != null) {
        return {
          index,
          result: {
            file,
            error,
            status: response?.status,
          },
        };
      }

      const webStream = downloadedStream ?? response?.body;
      if (webStream == null) {
        return {
          index,
          result: {
            file,
            error: new Error('DIAL Core returned no file stream'),
            status: response?.status,
          },
        };
      }

      await pipeline(Readable.fromWeb(webStream), createWriteStream(tempPath));
      this.logger.debug(
        `Archive file staged: index=${index}, bucket=${file.bucket}, path=${file.path}, archivePath=${file.archivePath}, status=${response?.status ?? 'unknown'}`,
      );
      return {
        index,
        result: {
          file,
          tempPath,
          status: response?.status ?? 200,
          contentLength: response?.headers.get('content-length') ?? 'unknown',
        },
      };
    } catch (error) {
      return { index, result: { file, error } };
    }
  }
}
