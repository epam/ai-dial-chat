import type { components } from '@epam/ai-dial-typescript-sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { safeDecodeURIComponent } from '../../common/utils/uri';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../../dial/dial-client.service';
import { toRelativePath } from '../dial-resource-path.util';
import type { FileMetadataResponseDto } from '../dto/file-metadata-response.dto';
import type { ListFilesResponseDto } from '../dto/list-files.dto';
import type { DialFileItem } from '../normalize-file-item';
import { normalizeFileItem } from '../normalize-file-item';
import { resolveListingPermissions } from '../resolve-listing-permissions';

export interface ExpandedFile {
  bucket: string;
  path: string;
  name: string;
  size: number;
  archivePath: string;
}

const FULL_FILE_LIST_PAGE_LIMIT = 1000;

const safeDecodePathForCompare = (path: string): string =>
  path.split('/').map(safeDecodeURIComponent).join('/');

@Injectable()
export class FilesListingService {
  private readonly logger = new Logger(FilesListingService.name);

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
      await this.dialClient.client.getFileMetadata(
        bucket,
        encodeDialResourcePath(normalizedPath),
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

    if (error != null || (data == null && response.status >= 300)) {
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
        await this.dialClient.client.getFileMetadata(
          bucket,
          encodeDialResourcePath(path),
          {
            headers: getBearerAuthHeaders(token),
            signal: AbortSignal.timeout(this.getTimeoutMs()),
          },
        );

      if (error != null || data == null) {
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
    const relFolderPath = toRelativePath(folderPath, bucket);

    const results: ExpandedFile[] = [];
    let token: string | undefined;
    let page = 0;

    this.logger.debug(
      `Archive folder expansion started: bucket=${bucket}, inputPath=${folderPath}, relativePath=${relFolderPath}, archiveRoot=${archiveRoot}`,
    );

    do {
      page += 1;
      const { data, error, response } =
        await this.dialClient.client.getFileMetadata(
          bucket,
          encodeDialResourcePath(relFolderPath),
          {
            headers: getBearerAuthHeaders(at),
            params: {
              query: { recursive: true, limit: 1000, token },
            },
            signal: AbortSignal.timeout(this.getTimeoutMs()),
          },
        );

      if (error != null || (data == null && response.status >= 300)) {
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
        const relItemPath = toRelativePath(rawUrl, bucket);

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
}
