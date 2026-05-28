import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from '../app/app.service';
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
    const encodedPath = path
      .split('/')
      .map((s) => encodeURIComponent(s))
      .join('/');
    const url = `${this.baseUrl}/v1/files/${encodeURIComponent(bucket)}/${encodedPath}`;
    const signal = AbortSignal.timeout(this.getTimeoutMs());

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': file.mimetype,
        },
        body: file.buffer,
        signal,
      });
    } catch (err) {
      this.logger.error(`Upload fetch failed for ${bucket}/${path}`, err);
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new ServiceUnavailableException('DIAL Core request timed out');
      }
      handleDialError(err);
      throw err; // unreachable — handleDialError always throws
    }

    if (!response.ok) {
      handleDialError({ status: response.status });
    }

    const data = (await response.json()) as { url?: string };
    return { url: data.url ?? '' };
  }

  async downloadFile(
    bucket: string,
    path: string,
    token: string,
  ): Promise<{ stream: ReadableStream; headers: Record<string, string> }> {
    const encodedPath = path
      .split('/')
      .map((s) => encodeURIComponent(s))
      .join('/');
    const url = `${this.baseUrl}/v1/files/${encodeURIComponent(bucket)}/${encodedPath}`;
    const signal = AbortSignal.timeout(this.getTimeoutMs());

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });
    } catch (err) {
      this.logger.error(`Download fetch failed for ${bucket}/${path}`, err);
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new ServiceUnavailableException('DIAL Core request timed out');
      }
      handleDialError(err);
      throw err; // unreachable — handleDialError always throws
    }

    if (!response.ok) {
      handleDialError({ status: response.status });
    }

    const headers: Record<string, string> = {};
    for (const header of SAFE_DOWNLOAD_HEADERS) {
      const value = response.headers.get(header);
      if (value !== null) {
        headers[header] = value;
      }
    }

    return { stream: response.body as ReadableStream, headers };
  }
}
