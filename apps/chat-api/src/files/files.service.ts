import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from '../app/app.service';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { handleDialError } from '../common/utils/dial-error';
import type { EnvironmentVariables } from '../config/environment.config';
import type { ListFilesResponseDto } from './dto/list-files.dto';
import type { FileUploadResponseDto } from './dto/upload-file-response.dto';
import { normalizeFileItem } from './normalize-file-item';

export const SAFE_DOWNLOAD_HEADERS = [
  'content-type',
  'content-disposition',
  'content-length',
] as const;

const INSTALLED_DEPLOYMENTS = 'clientdata/installed_deployments.json';

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

  async listInstalledDeployments(
    bucket: string,
    at: string,
  ): Promise<string[]> {
    try {
      const { data, error, response } = await this.client.getFileMetadata(
        bucket,
        INSTALLED_DEPLOYMENTS,
        {
          headers: getBearerAuthHeaders(at),
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        },
      );

      console.log('listInstalledDeployments', {
        bucket,
        at,
        data,
        error,
        response,
      });

      if (error != null) {
        this.logger.warn(
          `Could not read installed deployments list from DIAL Core at ${INSTALLED_DEPLOYMENTS}. Returning empty list. Error: ${error}`,
        );
        return [];
      }

      if (Array.isArray(data)) {
        return data.filter((id): id is string => typeof id === 'string');
      } else {
        this.logger.warn(
          `Unexpected format for installed deployments list from DIAL Core at ${INSTALLED_DEPLOYMENTS}. Expected an array of strings. Returning empty list.`,
        );
        return [];
      }
    } catch (err) {
      this.logger.error(
        `Failed to fetch installed deployments list from DIAL Core at ${INSTALLED_DEPLOYMENTS}. Returning empty list.`,
        err,
      );
      return [];
    }
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
          query: {
            token: query.token,
            limit: query.limit,
            recursive: query.recursive ?? false,
            permissions: query.permissions ?? true,
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

      const dialData = data as typeof data & { nextToken?: string };
      const items = (dialData.items ?? []).map((item) =>
        normalizeFileItem(item, bucket),
      );

      this.logger.debug(
        `listFiles succeeded: bucket=${bucket}, path=${normalizedPath}, count=${items.length}`,
      );
      return {
        bucket,
        path: normalizedPath,
        items,
        nextToken: dialData.nextToken,
      };
    } catch (err) {
      this.logger.warn(`listFiles failed for bucket=${bucket}`, err);
      return handleDialError(err);
    }
  }

  async downloadFile(
    bucket: string,
    path: string,
    token: string,
  ): Promise<{ stream: ReadableStream; headers: Record<string, string> }> {
    try {
      const { error, response } = (await this.client.downloadFile(
        bucket,
        path,
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
}
