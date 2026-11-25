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
import { DIAL_ENTITY_NAME_MAX_BYTES } from '../common/validators/dial-entity-name.validator';
import type { EnvironmentVariables } from '../config/environment.config';
import {
  DEFAULT_PROJECT_CONTEXT_FILE_MAX_BYTES,
  DEFAULT_PROJECT_CONTEXT_MAX_FILES,
  DEFAULT_PROJECT_CONTEXT_TOTAL_MAX_BYTES,
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
const DEFAULT_FIELD_MAX_BYTES = 1024 * 1024;

/** Stops retaining file parts once their combined size exceeds this request's budget. */
const createContextStorage = (maxTotalBytes: number): multer.StorageEngine => {
  const memory = memoryStorage();
  let totalBytes = 0;
  return {
    _removeFile: memory._removeFile.bind(memory),
    _handleFile(req, file, callback) {
      memory._handleFile(req, file, (error, info) => {
        if (error || !info) return callback(error, info);
        totalBytes += info.size ?? 0;
        if (totalBytes > maxTotalBytes) {
          return callback(
            projectPayloadTooLarge(
              ProjectCreateErrorCode.CapacityExceeded,
              `Context files exceed the limit of ${maxTotalBytes} bytes`,
            ),
          );
        }
        callback(null, info);
      });
    },
  };
};

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

    const maxFiles =
      this.configService.get<number>('PROJECT_CONTEXT_MAX_FILES') ??
      DEFAULT_PROJECT_CONTEXT_MAX_FILES;
    const maxTotalBytes =
      this.configService.get<number>('PROJECT_CONTEXT_TOTAL_MAX_BYTES') ??
      DEFAULT_PROJECT_CONTEXT_TOTAL_MAX_BYTES;

    return new Promise((resolve, reject) => {
      multer({
        storage: createContextStorage(maxTotalBytes),
        limits: {
          /* Compact JSON: valid names need no escaping, plus quotes, commas and brackets. */
          fieldSize: Math.max(
            DEFAULT_FIELD_MAX_BYTES,
            1 + maxFiles * (DIAL_ENTITY_NAME_MAX_BYTES + 3),
          ),
          fileSize: maxFileBytes,
          files: maxFiles,
          fields: MAX_TEXT_FIELDS,
        },
      }).array(PROJECT_CONTEXT_FILES_FIELD, maxFiles)(
        request,
        response,
        (error: unknown) => {
          if (error != null) {
            reject(this.mapMulterError(error, maxFileBytes, maxFiles));
            return;
          }
          resolve();
        },
      );
    });
  }

  private mapMulterError(
    error: unknown,
    maxFileBytes: number,
    maxFiles: number,
  ): unknown {
    if (!(error instanceof MulterError)) return error;

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return projectPayloadTooLarge(
          ProjectCreateErrorCode.FileTooLarge,
          `A context file exceeds the per-file limit of ${maxFileBytes} bytes`,
        );
      case 'LIMIT_FILE_COUNT':
        return this.tooManyFiles(maxFiles);
      case 'LIMIT_UNEXPECTED_FILE':
        /* `array()` reports a part over its max count this way too. */
        return error.field === PROJECT_CONTEXT_FILES_FIELD
          ? this.tooManyFiles(maxFiles)
          : new BadRequestException('Unexpected file field');
      default:
        return new BadRequestException(error.message);
    }
  }

  private tooManyFiles(maxFiles: number) {
    return projectBadRequest(
      ProjectCreateErrorCode.TooManyFiles,
      `A project may have at most ${maxFiles} context files`,
    );
  }
}
