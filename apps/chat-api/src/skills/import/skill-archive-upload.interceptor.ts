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
import type { EnvironmentVariables } from '../../config/environment.config';

/**
 * Disk-stages the ZIP uploaded to `POST /api/v1/skills/import` (design.md
 * D7, `add-skill-archive-import`), modeled on
 * `apps/chat-api/src/files/archive-upload.interceptor.ts` but scoped to this
 * one route only — the Skills domain's other Multer config (`SkillsModule`)
 * stays on `memoryStorage()` for the discrete-multipart create/update
 * endpoints, which is sized for individual file parts, not a compressed
 * archive.
 */
@Injectable()
export class SkillArchiveUploadInterceptor implements NestInterceptor {
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
      this.configService.get<number>('SKILL_ARCHIVE_UPLOAD_MAX_BYTES') ??
      20_971_520;

    return new Promise((promiseResolve, reject) => {
      multer({
        storage: diskStorage({ destination: tmpdir() }),
        limits: { fileSize: maxBytes, files: 1 },
      }).single('file')(request, response, (error: unknown) => {
        if (error != null) {
          reject(this.mapMulterError(error));
          return;
        }
        promiseResolve();
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
