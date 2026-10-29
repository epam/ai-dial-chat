import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ProjectCreateErrorCode } from '../types/project-create-error-code.enum';

const buildBody = (
  statusCode: number,
  error: string,
  code: ProjectCreateErrorCode,
  message: string,
  field?: string,
) => ({
  statusCode,
  error,
  code,
  message,
  ...(field != null ? { field } : {}),
});

/* Each builder returns the Nest exception whose body is a `ProjectCreateErrorDto`. */

export const projectBadRequest = (
  code: ProjectCreateErrorCode,
  message: string,
  field?: string,
): BadRequestException =>
  new BadRequestException(buildBody(400, 'Bad Request', code, message, field));

export const projectPayloadTooLarge = (
  code: ProjectCreateErrorCode,
  message: string,
  field?: string,
): PayloadTooLargeException =>
  new PayloadTooLargeException(
    buildBody(413, 'Payload Too Large', code, message, field),
  );

export const projectConflict = (
  code: ProjectCreateErrorCode,
  message: string,
  field?: string,
): ConflictException =>
  new ConflictException(buildBody(409, 'Conflict', code, message, field));

export const projectPreconditionRequired = (): HttpException =>
  new HttpException(
    buildBody(
      HttpStatus.PRECONDITION_REQUIRED,
      'Precondition Required',
      ProjectCreateErrorCode.IfMatchRequired,
      'If-Match is required: send the single ETag the project was read with',
    ),
    HttpStatus.PRECONDITION_REQUIRED,
  );

/**
 * The caller's `If-Match`, trimmed, when it names exactly one entity tag.
 * A missing or blank value, the `*` wildcard and a comma-separated list are
 * all `428 if-match-required`: Core would treat `*` as "any version" and a
 * list as "any of these", so either would turn the write the caller asked
 * for into one not conditioned on the version they read.
 */
export const requireSingleIfMatch = (ifMatch: string | undefined): string => {
  const etag = ifMatch?.trim() ?? '';
  if (etag === '' || etag === '*' || etag.includes(',')) {
    throw projectPreconditionRequired();
  }
  return etag;
};

/* The project changed since the caller read it: Core's `412` on a write
 * conditioned on the caller's ETag. */
export const projectChanged = (): ConflictException =>
  projectConflict(
    ProjectCreateErrorCode.ProjectChanged,
    'The project was changed by someone else; reload it and try again',
  );
