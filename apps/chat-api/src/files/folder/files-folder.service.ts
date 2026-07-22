import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../../dial/dial-client.service';
import { buildDialFileUrl } from '../dial-resource-path.util';
import type { CreateFolderResponseDto } from '../dto/create-folder.dto';
import { FOLDER_NODE_TYPE, MARKER_NAME } from '../files.constants';
import { markerMetadataMatches } from '../marker-metadata';
import { FilesUploadService } from '../upload/files-upload.service';

@Injectable()
export class FilesFolderService {
  private readonly logger = new Logger(FilesFolderService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly configService: ConfigService<EnvironmentVariables>,
    private readonly filesUploadService: FilesUploadService,
  ) {}

  private getTimeoutMs(): number {
    return this.configService.get<number>('FILE_TRANSFER_TIMEOUT_MS') ?? 30_000;
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
      } = await this.dialClient.client.getFileMetadata(
        bucket,
        encodeDialResourcePath(markerPath),
        {
          headers: getBearerAuthHeaders(at),
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        },
      );

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

      await this.filesUploadService.uploadFile(
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
}
