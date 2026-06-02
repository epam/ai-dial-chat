import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Maps a non-ok HTTP status from DIAL Core to the appropriate Nest exception.
 * Call this immediately after checking `!response.ok`.
 */
export const mapDialHttpStatus = (
  status: number,
  context: string,
  logger: Logger,
): never => {
  logger.warn(`DIAL Core returned ${status} for ${context}`);
  if (status === 401) throw new UnauthorizedException();
  if (status === 403) throw new ForbiddenException();
  if (status === 404) throw new NotFoundException('Resource not found');
  if (status === 429) throw new HttpException('Too Many Requests', 429);
  if (status >= 500)
    throw new BadGatewayException('DIAL Core returned a server error');
  throw new BadGatewayException(`Unexpected upstream status ${status}`);
};

/**
 * Handles errors caught in a fetch try/catch block.
 * Re-throws Nest exceptions as-is; maps AbortError and unexpected errors.
 */
export const handleDialFetchError = (
  err: unknown,
  context: string,
  logger: Logger,
  timeoutMs: number,
): never => {
  if (err instanceof HttpException) throw err;

  const error = err as { name?: string; message?: string; stack?: string };

  if (error.name === 'AbortError') {
    logger.error(
      `DIAL Core request timed out after ${timeoutMs}ms (${context})`,
    );
    throw new ServiceUnavailableException('DIAL Core request timed out');
  }

  logger.error(
    `Unexpected error during ${context}: ${error.message}`,
    error.stack,
  );
  throw new ServiceUnavailableException('DIAL Core is currently unavailable');
};
