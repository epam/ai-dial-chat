import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../../dial/dial-client.service';
import { buildDialFileResourceUrl } from '../dial-resource-path.util';
import type { CopyItemDto } from '../dto/copy-files.dto';
import { CopyFilesResponseDto, CopyItemResultDto } from '../dto/copy-files.dto';
import type { DeleteItemDto } from '../dto/delete-files.dto';
import {
  DeleteFilesResponseDto,
  DeleteItemResultDto,
} from '../dto/delete-files.dto';
import { DialFileNodeType } from '../dto/dial-file-node-type';
import type { MoveItemDto } from '../dto/move-files.dto';
import { MoveFilesResponseDto, MoveItemResultDto } from '../dto/move-files.dto';
import type { RenameItemDto } from '../dto/rename-files.dto';
import {
  RenameFilesResponseDto,
  RenameItemResultDto,
} from '../dto/rename-files.dto';
import { MARKER_NAME } from '../files.constants';
import type { ExpandedFile } from '../listing/files-listing.service';
import { FilesListingService } from '../listing/files-listing.service';

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

interface FolderFanOutSuccess<TChildResult> {
  success: true;
  childResults: TChildResult[];
}

interface FolderFanOutFailure {
  success: false;
  error: string;
}

type FolderFanOutOutcome<TChildResult> =
  | FolderFanOutSuccess<TChildResult>
  | FolderFanOutFailure;

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

    const childResults = await Promise.all(children.map(runChild));
    return { success: true, childResults };
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

  // ---- Rename ----

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

  private renameItem(
    item: RenameItemDto,
    at: string,
  ): Promise<RenameItemResultDto> {
    return this.dispatchByNodeType(
      item.nodeType,
      () =>
        this.renameFileItem(
          item.bucket,
          item.sourcePath,
          item.destinationPath,
          at,
        ),
      () =>
        this.renameFolderItem(
          item.bucket,
          item.sourcePath,
          item.destinationPath,
          at,
        ),
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

    const outcome = await this.runFolderFanOut(
      bucket,
      srcPrefix,
      at,
      'Rename failed',
      (child) =>
        this.renameFileItem(
          bucket,
          child.path,
          `${destPrefix}${child.archivePath}`,
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
        error: 'Partial rename',
      };
    }
    return {
      sourcePath: sourceFolderPath,
      destinationPath: destFolderPath,
      success: true,
    };
  }

  // ---- Copy ----

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

  private copyItem(item: CopyItemDto, at: string): Promise<CopyItemResultDto> {
    return this.dispatchByNodeType(
      item.nodeType,
      () =>
        this.copyFileItem(
          item.bucket,
          item.sourcePath,
          item.destinationPath,
          item.overwrite === true,
          at,
        ),
      () =>
        this.copyFolderItem(
          item.bucket,
          item.sourcePath,
          item.destinationPath,
          item.overwrite === true,
          at,
        ),
    );
  }

  private async copyFileItem(
    bucket: string,
    sourcePath: string,
    destPath: string,
    overwrite: boolean,
    at: string,
  ): Promise<CopyItemResultDto> {
    const sourceUrl = buildDialFileResourceUrl(bucket, sourcePath);
    const destinationUrl = buildDialFileResourceUrl(bucket, destPath);

    try {
      const { error, response } = (await this.dialClient.client.copyResource({
        headers: getBearerAuthHeaders(at),
        body: { sourceUrl, destinationUrl, overwrite },
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
    overwrite: boolean,
    at: string,
  ): Promise<CopyItemResultDto> {
    const srcPrefix = sourceFolderPath.endsWith('/')
      ? sourceFolderPath
      : `${sourceFolderPath}/`;
    const destPrefix = destFolderPath.endsWith('/')
      ? destFolderPath
      : `${destFolderPath}/`;

    const outcome = await this.runFolderFanOut(
      bucket,
      srcPrefix,
      at,
      'Copy failed',
      (child) =>
        this.copyFileItem(
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
        error: 'Partial copy',
      };
    }
    return {
      sourcePath: sourceFolderPath,
      destinationPath: destFolderPath,
      success: true,
    };
  }

  // ---- Move ----

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

  private moveItem(item: MoveItemDto, at: string): Promise<MoveItemResultDto> {
    return this.dispatchByNodeType(
      item.nodeType,
      () =>
        this.moveFileItem(
          item.bucket,
          item.sourcePath,
          item.destinationPath,
          item.overwrite === true,
          at,
        ),
      () =>
        this.moveFolderItem(
          item.bucket,
          item.sourcePath,
          item.destinationPath,
          item.overwrite === true,
          at,
        ),
    );
  }

  private async moveFileItem(
    bucket: string,
    sourcePath: string,
    destPath: string,
    overwrite: boolean,
    at: string,
  ): Promise<MoveItemResultDto> {
    const sourceUrl = buildDialFileResourceUrl(bucket, sourcePath);
    const destinationUrl = buildDialFileResourceUrl(bucket, destPath);

    try {
      const { error, response } = (await this.dialClient.client.moveResource({
        headers: getBearerAuthHeaders(at),
        body: { sourceUrl, destinationUrl, overwrite },
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
    overwrite: boolean,
    at: string,
  ): Promise<MoveItemResultDto> {
    const srcPrefix = sourceFolderPath.endsWith('/')
      ? sourceFolderPath
      : `${sourceFolderPath}/`;
    const destPrefix = destFolderPath.endsWith('/')
      ? destFolderPath
      : `${destFolderPath}/`;

    const outcome = await this.runFolderFanOut(
      bucket,
      srcPrefix,
      at,
      'Move failed',
      (child) =>
        this.moveFileItem(
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
        error: 'Partial move',
      };
    }
    return {
      sourcePath: sourceFolderPath,
      destinationPath: destFolderPath,
      success: true,
    };
  }
}
