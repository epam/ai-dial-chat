import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, resolve, sep } from 'node:path';
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

const DEFAULT_MAX_UPLOAD_BYTES = 536_870_912;

/**
 * Stages the single multipart `file` part to a temporary file under
 * `tmpdir()` instead of holding it in memory, and deletes that file once the
 * request finishes — on success, on a handler error, and when multer rejects
 * the request. Subclasses name the size limit and its 413 message.
 */
@Injectable()
export abstract class DiskFileUploadInterceptor implements NestInterceptor {
  /** Environment variable holding the maximum `file` part size in bytes. */
  protected abstract readonly maxBytesKey: keyof EnvironmentVariables;
  /** Message of the `413` returned when the part exceeds that size. */
  protected abstract readonly tooLargeMessage: string;

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
      await this.parseUpload(request, response);
    } catch (err) {
      this.removeUploadedFile(request.file);
      throw err;
    }

    return next
      .handle()
      .pipe(finalize(() => this.removeUploadedFile(request.file)));
  }

  private parseUpload(request: Request, response: Response): Promise<void> {
    const maxBytes =
      this.configService.get<number>(this.maxBytesKey) ??
      DEFAULT_MAX_UPLOAD_BYTES;

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
        return new PayloadTooLargeException(this.tooLargeMessage);
      }
      return new BadRequestException(error.message);
    }

    return error;
  }

  /**
   * multer's diskStorage generates `file.path` from a random filename under
   * `tmpdir()` — never from the original upload's name — but `basename()`
   * strips any directory component before the path is rejoined with the
   * trusted temp dir, so the deletion provably cannot escape it regardless.
   */
  private removeUploadedFile(file: Express.Multer.File | undefined): void {
    if (file?.path == null) return;
    const resolvedTempDir = resolve(tmpdir());
    const fileName = basename(file.path);
    if (fileName.length === 0) return;
    const resolvedPath = resolve(resolvedTempDir, fileName);
    const isWithinTempDir =
      resolvedPath === resolvedTempDir ||
      resolvedPath.startsWith(`${resolvedTempDir}${sep}`);
    if (!isWithinTempDir) return;
    void rm(resolvedPath, { force: true }).catch(() => undefined);
  }
}
