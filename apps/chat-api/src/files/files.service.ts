import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from '../app/app.service';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { handleDialError } from '../common/utils/dial-error';
import type { EnvironmentVariables } from '../config/environment.config';
import type { FileUploadResponseDto } from './dto/upload-file-response.dto';

export const SAFE_DOWNLOAD_HEADERS = [
  'content-type',
  'content-disposition',
  'content-length',
] as const;

interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
}

@Injectable()
export class FilesService extends AppService {
  private readonly logger = new Logger(FilesService.name);

  constructor(configService: ConfigService<EnvironmentVariables>) {
    super(configService);
  }

  private getTimeoutMs(): number {
    return (
      (this.configService.get('FILE_TRANSFER_TIMEOUT_MS', {
        infer: true,
      }) as number | undefined) ?? 30_000
    );
  }

  async uploadFile(
    bucket: string,
    path: string,
    file: UploadedFile,
    token: string,
  ): Promise<FileUploadResponseDto> {
    try {
      const { data, error, response } = (await this.client.uploadFile(
        bucket,
        path,
        {
          headers: {
            ...getBearerAuthHeaders(token),
            'Content-Type': file.mimetype,
          },
          body: file.buffer as unknown as string,
          signal: AbortSignal.timeout(this.getTimeoutMs()),
        },
      )) as { data?: { url?: string }; error?: unknown; response: Response };

      if (error !== undefined) {
        return handleDialError({ status: response.status });
      }

      return { url: data?.url ?? '' };
    } catch (err) {
      this.logger.error(`Upload failed for ${bucket}/${path}`, err);
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

      if (error !== undefined) {
        return handleDialError({ status: response.status });
      }

      const headers: Record<string, string> = {};
      for (const header of SAFE_DOWNLOAD_HEADERS) {
        const value = response.headers.get(header);
        if (value !== null) {
          headers[header] = value;
        }
      }

      return { stream: response.body as ReadableStream, headers };
    } catch (err) {
      this.logger.error(`Download failed for ${bucket}/${path}`, err);
      return handleDialError(err);
    }
  }
}
