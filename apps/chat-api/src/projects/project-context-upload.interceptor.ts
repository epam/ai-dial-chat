import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import multer, { memoryStorage, MulterError } from 'multer';
import type { Observable } from 'rxjs';
import type { EnvironmentVariables } from '../config/environment.config';
import {
  DEFAULT_PROJECT_CONTEXT_FILE_MAX_BYTES,
  PROJECT_CONTEXT_MAX_FILES,
} from './constants/project-context.constants';
import { ProjectCreateErrorCode } from './types/project-create-error-code.enum';
import {
  projectBadRequest,
  projectPayloadTooLarge,
} from './utils/project-create-error.util';

/** Multipart field the context file parts are sent under. */
export const PROJECT_CONTEXT_FILES_FIELD = 'files';

/* `name`, `description`, `instructions`, `fileNames`, with headroom for the
 * ValidationPipe to name an unknown field instead of Multer cutting it off. */
const MAX_TEXT_FIELDS = 16;

/**
 * Parses the multipart body of `POST /api/v1/projects` into memory, scoped
 * to that one route and modelled on `SkillArchiveUploadInterceptor`. Multer
 * aborts mid-stream at the per-file and count limits; this interceptor
 * turns those aborts into the same typed `file-too-large` / `too-many-files`
 * errors `ProjectsCreateService` throws, so a client sees one contract
 * whichever layer rejects. The service re-checks every limit against the
 * received bytes.
 */
@Injectable()
export class ProjectContextUploadInterceptor implements NestInterceptor {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    await this.parse(http.getRequest<Request>(), http.getResponse<Response>());
    return next.handle();
  }

  private parse(request: Request, response: Response): Promise<void> {
    const maxFileBytes =
      this.configService.get<number>('PROJECT_CONTEXT_FILE_MAX_BYTES') ??
      DEFAULT_PROJECT_CONTEXT_FILE_MAX_BYTES;

    return new Promise((resolve, reject) => {
      multer({
        storage: memoryStorage(),
        limits: {
          fileSize: maxFileBytes,
          files: PROJECT_CONTEXT_MAX_FILES,
          fields: MAX_TEXT_FIELDS,
        },
      }).array(PROJECT_CONTEXT_FILES_FIELD, PROJECT_CONTEXT_MAX_FILES)(
        request,
        response,
        (error: unknown) => {
          if (error != null) {
            reject(this.mapMulterError(error, maxFileBytes));
            return;
          }
          resolve();
        },
      );
    });
  }

  private mapMulterError(error: unknown, maxFileBytes: number): unknown {
    if (!(error instanceof MulterError)) return error;

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return projectPayloadTooLarge(
          ProjectCreateErrorCode.FileTooLarge,
          `A context file exceeds the per-file limit of ${maxFileBytes} bytes`,
        );
      case 'LIMIT_FILE_COUNT':
        return this.tooManyFiles();
      case 'LIMIT_UNEXPECTED_FILE':
        /* `array()` reports a part over its max count this way too. */
        return error.field === PROJECT_CONTEXT_FILES_FIELD
          ? this.tooManyFiles()
          : new BadRequestException('Unexpected file field');
      default:
        return new BadRequestException(error.message);
    }
  }

  private tooManyFiles() {
    return projectBadRequest(
      ProjectCreateErrorCode.TooManyFiles,
      `A project may have at most ${PROJECT_CONTEXT_MAX_FILES} context files`,
    );
  }
}
