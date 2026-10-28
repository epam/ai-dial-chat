import {
  BadRequestException,
  ConflictException,
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
