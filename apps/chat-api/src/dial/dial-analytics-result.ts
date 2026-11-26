import type { SDKResponse } from '@epam/ai-dial-typescript-sdk';
import { ServiceUnavailableException } from '@nestjs/common';
import { dialAnalyticsErrors } from '../common/dial/dial-error.mapper';

/* The mapper names its context only in log lines; these helpers log nothing. */
const CONTEXT = 'DIAL Analytics call';

/**
 * Returns the data of a DIAL Analytics SDK call, or throws the shared mapping
 * of its outcome: a non-ok status throws the exception `mapDialHttpStatus`
 * picks for it (the transport has logged the raw status and discarded the
 * body unread), and an ok answer without a body throws
 * `ServiceUnavailableException`, like a body that is not JSON.
 */
export const readDialAnalyticsData = <TData, TError>(
  result: SDKResponse<TData, TError>,
): NonNullable<TData> => {
  if (!result.response.ok) {
    return dialAnalyticsErrors.mapHttpStatus(result.response.status, CONTEXT);
  }
  if (result.data == null) {
    throw new ServiceUnavailableException(
      'DIAL Analytics is currently unavailable',
    );
  }
  return result.data;
};

/**
 * Throws the shared mapping of a DIAL Analytics call that did not resolve: an
 * `HttpException` as is, a timeout or an aborted call as
 * `ServiceUnavailableException('DIAL Analytics request timed out')`, anything
 * else (a refused connection, a body that is not JSON) as
 * `ServiceUnavailableException('DIAL Analytics is currently unavailable')`.
 * Nothing is logged.
 */
export const handleDialAnalyticsFailure = (error: unknown): never =>
  dialAnalyticsErrors.handleFetchError(error, CONTEXT);
