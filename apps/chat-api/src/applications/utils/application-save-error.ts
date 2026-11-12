import { ForbiddenException, type Logger } from '@nestjs/common';
import { mapDialHttpStatus } from '../../common/dial/dial-error.mapper';
import { ApplicationErrorCode } from '../types/application-error-code.enum';

const FORBIDDEN_STATUS = 403;

/** Message of the coded 403 returned when a saved application's dependency is missing. */
export const DEPENDENT_RESOURCE_MISSING_MESSAGE =
  'This application refers to a resource that is no longer available. Remove or replace it to continue.';

/*
 * DIAL Core refuses a save of an application whose dependency no longer
 * exists with 403 and a plain-text body `Failed to access application
 * resource <uri>` (`ResourceController`, wrapping an
 * `ApplicationTypeResourceException`, which `ApplicationSchemaService` throws
 * only for a missing resource). Core gives this case no machine-readable
 * field, so it is detected by prefix match on the text; the text itself is
 * never forwarded because it carries the resource path.
 */
const DEPENDENT_RESOURCE_PREFIX = 'failed to access application resource';

/**
 * Tells whether a DIAL Core error body is the refusal for a missing application dependency.
 * @param errorBody - the parsed error body of the failed Core call
 */
export const isDependentResourceError = (errorBody: unknown): boolean =>
  typeof errorBody === 'string' &&
  errorBody.trim().toLowerCase().startsWith(DEPENDENT_RESOURCE_PREFIX);

/**
 * Throws the exception for a failed application save: a coded 403 when DIAL
 * Core reports a missing dependency, otherwise the generic status mapping.
 * @param status - HTTP status of the Core response
 * @param errorBody - parsed error body of the Core response
 * @param context - operation name used in log lines
 * @param logger - logger of the calling service
 */
export const throwApplicationSaveError = (
  status: number,
  errorBody: unknown,
  context: string,
  logger: Logger,
): never => {
  if (status === FORBIDDEN_STATUS && isDependentResourceError(errorBody)) {
    logger.warn(`DIAL Core refused ${context}: dependent resource is missing`);
    throw new ForbiddenException({
      statusCode: FORBIDDEN_STATUS,
      error: 'Forbidden',
      code: ApplicationErrorCode.DependentResourceMissing,
      message: DEPENDENT_RESOURCE_MISSING_MESSAGE,
    });
  }
  return mapDialHttpStatus(status, context, logger, errorBody);
};
