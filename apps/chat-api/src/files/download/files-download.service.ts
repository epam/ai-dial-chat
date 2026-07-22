import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../../dial/dial-client.service';
import { toRelativePath } from '../dial-resource-path.util';

export const SAFE_DOWNLOAD_HEADERS = [
  'content-type',
  'content-disposition',
  'content-length',
] as const;

@Injectable()
export class FilesDownloadService {
  private readonly logger = new Logger(FilesDownloadService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  private getTimeoutMs(): number {
    return this.configService.get<number>('FILE_TRANSFER_TIMEOUT_MS') ?? 30_000;
  }

  async downloadFile(
    bucket: string,
    path: string,
    token: string,
  ): Promise<{ stream: ReadableStream; headers: Record<string, string> }> {
    const relativePath = toRelativePath(path, bucket);

    try {
      const { error, response } = (await this.dialClient.client.downloadFile(
        bucket,
        encodeDialResourcePath(relativePath),
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
        return handleDialSdkError(
          error,
          'files.downloadFile',
          this.logger,
          response,
        );
      }

      const headers = Object.fromEntries(
        SAFE_DOWNLOAD_HEADERS.map(
          (h) => [h, response.headers.get(h)] as const,
        ).filter(([, v]) => v !== null),
      ) as Record<string, string>;

      return { stream: response.body as ReadableStream, headers };
    } catch (err) {
      this.logger.error(`Download failed for ${bucket}/${path}`, err);
      return handleDialSdkError(err, 'files.downloadFile', this.logger);
    }
  }
}
