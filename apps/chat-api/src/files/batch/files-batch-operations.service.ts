import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../../dial/dial-client.service';
import {
  buildDialFileResourceUrl,
  encodeDialFilePath,
} from '../dial-resource-path.util';
import type { CopyFilesResponseDto, CopyItemDto } from '../dto/copy-files.dto';
import type { DeleteItemDto } from '../dto/delete-files.dto';
import {
  DeleteFilesResponseDto,
  DeleteItemResultDto,
} from '../dto/delete-files.dto';
import { DialFileNodeType } from '../dto/dial-file-node-type';
import type { MoveFilesResponseDto, MoveItemDto } from '../dto/move-files.dto';
import type {
  RenameFilesResponseDto,
  RenameItemDto,
} from '../dto/rename-files.dto';
import { fileMetadataMatchesPath } from '../file-metadata-match';
import { MARKER_NAME } from '../files.constants';
import type { ExpandedFile } from '../listing/files-listing.service';
import { FilesListingService } from '../listing/files-listing.service';
import { FileTransferKind } from '../types/file-transfer-kind.enum';
import {
  FILE_TRANSFER_STRATEGIES,
  getTransferErrorMessage,
  type TransferCall,
  type TransferItem,
  type TransferItemResult,
} from './file-transfer-strategy';

/*
 * openapi-fetch leaves `error` undefined for an error response with an empty
 * body, so the HTTP status decides success alongside the parsed error.
 */
const isTransferSuccess = (
  error: unknown,
  response: { status: number },
): boolean => error == null && response.status < 400;

interface TransferFailure {
  error: unknown;
  status: number;
  bucket: string;
  destPath: string;
  overwrite: boolean;
  at: string;
  mapStatus: (error: unknown, response: { status: number }) => string;
  fallback: string;
}

interface FolderFanOutSuccess<TChildResult> {
  success: true;
  childResults: TChildResult[];
}

interface FolderFanOutFailure {
  success: false;
  error: string;
}

type FolderFanOutOutcome<TChildResult> =
  FolderFanOutSuccess<TChildResult> | FolderFanOutFailure;

@Injectable()
export class FilesBatchOperationsService {
  private readonly logger = new Logger(FilesBatchOperationsService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly configService: ConfigService<EnvironmentVariables>,
    private readonly filesListingService: FilesListingService,
  ) {}

  private getTimeoutMs(): number {
    return this.configService.get<number>('FILE_TRANSFER_TIMEOUT_MS') ?? 30_000;
  }

  private dispatchByNodeType<TResult>(
    nodeType: DialFileNodeType,
    onFile: () => Promise<TResult>,
    onFolder: () => Promise<TResult>,
  ): Promise<TResult> {
    return nodeType === DialFileNodeType.Folder ? onFolder() : onFile();
  }

  /**
   * Shared "expand a folder into its file list, then fan the per-child
   * operation out over every entry" step used by delete/rename/copy/move
   * folder operations. Each caller maps the resulting outcome into its own
   * result DTO shape (delete's is `{ path }`; rename/copy/move's is
   * `{ sourcePath, destinationPath }`).
   */
  private async runFolderFanOut<TChildResult extends { success: boolean }>(
    bucket: string,
    srcPrefix: string,
    at: string,
    expandFailedError: string,
    runChild: (child: ExpandedFile) => Promise<TChildResult>,
  ): Promise<FolderFanOutOutcome<TChildResult>> {
    let children: ExpandedFile[];
    try {
      children = await this.filesListingService.expandFolderContents(
        bucket,
        srcPrefix,
        '',
        at,
      );
    } catch (err) {
      this.logger.error(
        `Folder fan-out expandFolderContents exception: bucket=${bucket}, srcPrefix=${srcPrefix}, err=${err instanceof Error ? err.message : String(err)}`,
      );
      return { success: false, error: expandFailedError };
    }

    /* Children run one at a time so a large folder does not open one DIAL
     * Core request per file at once (see the file-manager-copy-move spec). */
    const childResults: TChildResult[] = [];
    for (const child of children) {
      childResults.push(await runChild(child));
    }
    return { success: true, childResults };
  }

  /**
   * Turns a failed rename/copy/move into the per-item `error` string.
   *
   * DIAL Core's transfer contract has no 409: `POST /v1/ops/resource/copy` and
   * `/move` declare 200/400/401/403/404/500 only, so a destination that is
   * already taken while `overwrite` is false comes back as a plain 400 and
   * would otherwise land in the generic "<operation> failed" fallback. When a
   * non-overwriting transfer fails with a 400, the destination is probed once —
   * if a resource is really sitting there, the item is reported as `Conflict`
   * so the UI can offer rename/overwrite instead of a dead-end error. The
   * probe only ever runs on the failure path, so the happy path stays at one
   * upstream call per item.
   */
  private async resolveTransferErrorMessage(
    failure: TransferFailure,
  ): Promise<string> {
    const { error, status, bucket, destPath, overwrite, at, mapStatus } =
      failure;

    const mapped = mapStatus(error, { status });
    if (mapped !== failure.fallback) return mapped;

    if (overwrite || status !== HttpStatus.BAD_REQUEST) return mapped;

    return (await this.resourceExists(bucket, destPath, at))
      ? 'Conflict'
      : mapped;
  }

  private async resourceExists(
    bucket: string,
    path: string,
    at: string,
  ): Promise<boolean> {
    try {
      const { data, error, response } =
        await this.dialClient.client.getFileMetadata(
          bucket,
          encodeDialFilePath(path),
          {
            headers: getBearerAuthHeaders(at),
            signal: AbortSignal.timeout(this.getTimeoutMs()),
          },
        );

      const status = (response as { status: number }).status;
      return (
        error == null &&
        status === HttpStatus.OK &&
        fileMetadataMatchesPath(data, bucket, path)
      );
    } catch (err) {
      this.logger.warn(
        `resourceExists probe failed: bucket=${bucket}, path=${path}, err=${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  // ---- Delete ----

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

  private deleteItem(
    item: DeleteItemDto,
    at: string,
  ): Promise<DeleteItemResultDto> {
    return this.dispatchByNodeType(
      item.nodeType,
      () => this.deleteFileItem(item.bucket, item.path, at),
      () => this.deleteFolderItem(item, at),
    );
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
        encodeDialFilePath(relPath),
        {
          headers: getBearerAuthHeaders(at),
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        },
      )) as { error?: unknown; response: { status: number } };

      this.logger.debug(
        `deleteFileItem result: bucket=${bucket}, relPath=${relPath}, status=${response.status}, hasError=${error != null}`,
      );

      if (response.status === 404 || isTransferSuccess(error, response)) {
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

    const outcome = await this.runFolderFanOut(
      item.bucket,
      folderRelPath,
      at,
      'Delete failed',
      (child) => this.deleteFileItem(child.bucket, child.path, at),
    );

    if (!outcome.success) {
      return { path: item.path, success: false, error: outcome.error };
    }

    const markerPath = `${folderRelPath}${MARKER_NAME}`;
    const markerResult = await this.deleteFileItem(item.bucket, markerPath, at);

    const anyChildFailed = outcome.childResults.some((r) => !r.success);
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

  // ---- Rename / copy / move ----

  async renameFiles(
    items: RenameItemDto[],
    at: string,
  ): Promise<RenameFilesResponseDto> {
    return this.transferFiles(FileTransferKind.Rename, items, at);
  }

  async copyFiles(
    items: CopyItemDto[],
    at: string,
  ): Promise<CopyFilesResponseDto> {
    return this.transferFiles(FileTransferKind.Copy, items, at);
  }

  async moveFiles(
    items: MoveItemDto[],
    at: string,
  ): Promise<MoveFilesResponseDto> {
    return this.transferFiles(FileTransferKind.Move, items, at);
  }

  /**
   * Shared rename/copy/move pipeline: top-level items run in parallel, each
   * dispatched by node type; every per-operation difference comes from
   * `FILE_TRANSFER_STRATEGIES`.
   */
  private async transferFiles(
    kind: FileTransferKind,
    items: TransferItem[],
    at: string,
  ): Promise<{ results: TransferItemResult[] }> {
    const { batchLabel } = FILE_TRANSFER_STRATEGIES[kind];
    this.logger.log(`${batchLabel} files started: batchSize=${items.length}`);

    const results = await Promise.all(
      items.map((item) => this.transferItem(kind, item, at)),
    );

    const successCount = results.filter((r) => r.success).length;
    this.logger.log(
      `${batchLabel} files completed: batchSize=${items.length}, successCount=${successCount}, failedCount=${items.length - successCount}`,
    );

    return { results };
  }

  private transferItem(
    kind: FileTransferKind,
    item: TransferItem,
    at: string,
  ): Promise<TransferItemResult> {
    const overwrite =
      FILE_TRANSFER_STRATEGIES[kind].honorsOverwrite && item.overwrite === true;
    return this.dispatchByNodeType(
      item.nodeType,
      () =>
        this.transferFileItem(
          kind,
          item.bucket,
          item.sourcePath,
          item.destinationPath,
          overwrite,
          at,
        ),
      () =>
        this.transferFolderItem(
          kind,
          item.bucket,
          item.sourcePath,
          item.destinationPath,
          overwrite,
          at,
        ),
    );
  }

  private async transferFileItem(
    kind: FileTransferKind,
    bucket: string,
    sourcePath: string,
    destPath: string,
    overwrite: boolean,
    at: string,
  ): Promise<TransferItemResult> {
    const strategy = FILE_TRANSFER_STRATEGIES[kind];
    const sourceUrl = buildDialFileResourceUrl(bucket, sourcePath);
    const destinationUrl = buildDialFileResourceUrl(bucket, destPath);
    const transfer = this.dialClient.client[strategy.sdkOperation].bind(
      this.dialClient.client,
    ) as unknown as TransferCall;

    try {
      const { error, response } = await transfer({
        headers: getBearerAuthHeaders(at),
        body: { sourceUrl, destinationUrl, overwrite },
        signal: AbortSignal.timeout(this.getTimeoutMs()),
      });

      if (isTransferSuccess(error, response)) {
        return { sourcePath, destinationPath: destPath, success: true };
      }

      const status = response.status;
      this.logger.warn(
        `${strategy.logName}FileItem failed: bucket=${bucket}, sourcePath=${sourcePath}, destPath=${destPath}, status=${status}`,
      );

      return {
        sourcePath,
        destinationPath: destPath,
        success: false,
        error: await this.resolveTransferErrorMessage({
          error,
          status,
          bucket,
          destPath,
          overwrite,
          at,
          mapStatus: (e, r) => getTransferErrorMessage(strategy, e, r),
          fallback: strategy.failedError,
        }),
      };
    } catch (err) {
      this.logger.error(
        `${strategy.logName}FileItem exception: bucket=${bucket}, sourcePath=${sourcePath}, err=${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        sourcePath,
        destinationPath: destPath,
        success: false,
        error: getTransferErrorMessage(strategy, err),
      };
    }
  }

  private async transferFolderItem(
    kind: FileTransferKind,
    bucket: string,
    sourceFolderPath: string,
    destFolderPath: string,
    overwrite: boolean,
    at: string,
  ): Promise<TransferItemResult> {
    const strategy = FILE_TRANSFER_STRATEGIES[kind];
    const srcPrefix = sourceFolderPath.endsWith('/')
      ? sourceFolderPath
      : `${sourceFolderPath}/`;
    const destPrefix = destFolderPath.endsWith('/')
      ? destFolderPath
      : `${destFolderPath}/`;

    /* Moving a folder into itself or one of its subfolders would nest every
       child one level deeper and break links to their old paths. */
    if (strategy.rejectsNestedDestination && destPrefix.startsWith(srcPrefix)) {
      this.logger.warn(
        `${strategy.logName}FolderItem rejected: destination inside source, bucket=${bucket}, sourcePath=${sourceFolderPath}, destPath=${destFolderPath}`,
      );
      return {
        sourcePath: sourceFolderPath,
        destinationPath: destFolderPath,
        success: false,
        error: 'Cannot move a folder into itself or its subfolders',
      };
    }

    const outcome = await this.runFolderFanOut(
      bucket,
      srcPrefix,
      at,
      strategy.failedError,
      (child) =>
        this.transferFileItem(
          kind,
          bucket,
          child.path,
          `${destPrefix}${child.archivePath}`,
          overwrite,
          at,
        ),
    );

    if (!outcome.success) {
      return {
        sourcePath: sourceFolderPath,
        destinationPath: destFolderPath,
        success: false,
        error: outcome.error,
      };
    }

    const anyFailed = outcome.childResults.some((r) => !r.success);
    if (anyFailed) {
      return {
        sourcePath: sourceFolderPath,
        destinationPath: destFolderPath,
        success: false,
        error: strategy.partialError,
      };
    }
    return {
      sourcePath: sourceFolderPath,
      destinationPath: destFolderPath,
      success: true,
    };
  }
}
