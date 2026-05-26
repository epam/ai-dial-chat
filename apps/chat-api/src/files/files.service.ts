import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AppService } from '../app/app.service';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { handleDialError } from '../common/utils/dial-error';
import { EnvironmentVariables } from '../config/environment.config';
import { FileUploadResponseDto } from './dto/file-upload-response.dto';
import { getNextFileName } from './utils/file-name';

@Injectable()
export class FilesService extends AppService {
  protected logger = new Logger(FilesService.name);

  constructor(configService: ConfigService<EnvironmentVariables>) {
    super(configService);
  }

  private getTodayFolder(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private getUploadPath(): string {
    return `uploads/${this.getTodayFolder()}/`;
  }

  async uploadFile(
    token: string,
    bucket: string,
    file: Express.Multer.File,
  ): Promise<FileUploadResponseDto> {
    const folderPath = this.getUploadPath();

    const existingNames = await this.listFolderNames(token, bucket, folderPath);
    const finalName = getNextFileName(file.originalname, existingNames);
    const filePath = `${folderPath}${finalName}`;

    const formData = new FormData();
    const blob = new Blob([file.buffer], { type: file.mimetype });
    formData.append('file', blob, finalName);

    const { data, error } = (await this.client.uploadFile(bucket, filePath, {
      headers: getBearerAuthHeaders(token),
      body: formData as unknown as { file?: string },
    })) as { data?: Record<string, unknown>; error?: unknown };

    if (error !== undefined || !data) {
      this.logger.error('DIAL Core rejected uploadFile', error);
      return handleDialError(error);
    }

    return {
      url: (data['url'] as string) ?? `files/${bucket}/${filePath}`,
      name: finalName,
      contentType: file.mimetype,
      contentLength: file.size,
    };
  }

  async getFile(token: string, fileUrl: string, res: Response): Promise<void> {
    if (!fileUrl) throw new BadRequestException('url is required');

    // DIAL returns relative URLs like "files/{bucket}/{path}".
    // Full download URL is {DIAL_CORE_URL}/v1/{relative}.
    const resolvedUrl = fileUrl.startsWith('http')
      ? fileUrl
      : `${this.baseUrl}/v1/${fileUrl.replace(/^\//, '')}`;

    const upstream = await fetch(resolvedUrl, {
      headers: getBearerAuthHeaders(token),
    });

    if (!upstream.ok || !upstream.body) {
      this.logger.error('DIAL proxy failed', upstream.status, resolvedUrl);
      res.status(502).end();
      return;
    }

    const contentType =
      upstream.headers.get('content-type') ?? 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');

    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      reader.releaseLock();
      res.end();
    }
  }

  private async listFolderNames(
    token: string,
    bucket: string,
    folderPath: string,
  ): Promise<string[]> {
    try {
      const { data } = (await this.client.getFileMetadata(bucket, folderPath, {
        headers: getBearerAuthHeaders(token),
      })) as { data?: { items?: Array<{ name?: string }> }; error?: unknown };

      if (!data?.items) {
        return [];
      }

      return data.items
        .map((item) => item.name ?? '')
        .filter((name) => name.length > 0);
    } catch {
      return [];
    }
  }
}
