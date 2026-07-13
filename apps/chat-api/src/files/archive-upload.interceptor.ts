import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import multer, { diskStorage, MulterError } from 'multer';
import { finalize, type Observable } from 'rxjs';
import type { EnvironmentVariables } from '../config/environment.config';

@Injectable()
export class ArchiveUploadInterceptor implements NestInterceptor {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    try {
      await this.parseArchiveUpload(request, response);
    } catch (err) {
      this.removeUploadedFile(request.file);
      throw err;
    }

    return next
      .handle()
      .pipe(finalize(() => this.removeUploadedFile(request.file)));
  }

  private parseArchiveUpload(
    request: Request,
    response: Response,
  ): Promise<void> {
    const maxBytes =
      this.configService.get<number>('ARCHIVE_UPLOAD_MAX_BYTES') ?? 536_870_912;

    return new Promise((resolve, reject) => {
      multer({
        storage: diskStorage({ destination: tmpdir() }),
        limits: { fileSize: maxBytes, files: 1 },
      }).single('file')(request, response, (error: unknown) => {
        if (error != null) {
          reject(this.mapMulterError(error));
          return;
        }
        resolve();
      });
    });
  }

  private mapMulterError(error: unknown): unknown {
    if (error instanceof MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return new PayloadTooLargeException('Archive payload too large');
      }
      return new BadRequestException(error.message);
    }

    return error;
  }

  private removeUploadedFile(file: Express.Multer.File | undefined): void {
    if (file?.path == null) return;
    void rm(file.path, { force: true }).catch(() => undefined);
  }
}
