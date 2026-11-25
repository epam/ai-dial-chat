import { ForbiddenException, type Logger } from '@nestjs/common';
import {
  extractDialErrorMessage,
  mapDialHttpStatus,
} from '../../common/dial/dial-error.mapper';
import { ApplicationErrorCode } from '../types/application-error-code.enum';

const FORBIDDEN_STATUS = 403;

/*
 * Core gives these refusals no machine-readable field, so each is recognised
 * by its text. Each caller keeps its own normalisation of that text.
 */
const hasErrorText = (
  errorBody: unknown,
  matches: (message: string) => boolean,
): boolean => {
  const message = extractDialErrorMessage(errorBody);
  return message != null && matches(message);
};

/** Message of the coded 403 returned when a saved application's dependency is missing. */
export const DEPENDENT_RESOURCE_MISSING_MESSAGE =
  'This application refers to a resource that is no longer available. Remove or replace it to continue.';

/** Message of the coded 403 returned when DIAL Core only lets administrators change dependencies. */
export const RESOURCE_DEPENDENCIES_NOT_ALLOWED_MESSAGE =
  'Only an administrator can change the resource access of an application.';

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
  hasErrorText(errorBody, (message) =>
    message.trim().toLowerCase().startsWith(DEPENDENT_RESOURCE_PREFIX),
  );

/*
 * With `applications.allowUserAuthoredDependencies` disabled, Core answers a
 * user's change of `resource_dependencies` with a plain 403 whose text names
 * that setting (`ApplicationService.inheritOrGuardDependencies`). There is no
 * machine-readable field, so the setting name is matched in the text with
 * separators and case ignored; the text itself is never forwarded.
 */
const DEPENDENCIES_NOT_ALLOWED_MARKER = 'allowuserauthoreddependencies';

/**
 * Tells whether a DIAL Core error body is the refusal of a user's change to resource dependencies.
 * @param errorBody - the parsed error body of the failed Core call
 */
export const isResourceDependenciesNotAllowedError = (
  errorBody: unknown,
): boolean =>
  hasErrorText(errorBody, (message) =>
    message
      .toLowerCase()
      .replace(/[^a-z]/g, '')
      .includes(DEPENDENCIES_NOT_ALLOWED_MARKER),
  );

/**
 * Throws the exception for a failed application save: a coded 403 when DIAL
 * Core reports a missing dependency or refuses a dependency change, otherwise
 * the generic status mapping.
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
  if (
    status === FORBIDDEN_STATUS &&
    isResourceDependenciesNotAllowedError(errorBody)
  ) {
    logger.warn(`DIAL Core refused ${context}: dependency change not allowed`);
    throw new ForbiddenException({
      statusCode: FORBIDDEN_STATUS,
      error: 'Forbidden',
      code: ApplicationErrorCode.ResourceDependenciesNotAllowed,
      message: RESOURCE_DEPENDENCIES_NOT_ALLOWED_MESSAGE,
    });
  }
  return mapDialHttpStatus(status, context, logger);
};
