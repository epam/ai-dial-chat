import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Maps a DIAL Core HTTP status to the appropriate Nest exception. Shared by
 * the SDK-shaped (`handleDialSdkError`) and fetch-shaped (`handleDialFetchError`)
 * entry points so every `chat-api` domain throws the same exception subtype
 * for a given upstream status code.
 */
export const mapDialHttpStatus = (
  status: number,
  context: string,
  logger?: Logger,
): never => {
  logger?.warn(`DIAL Core returned ${status} for ${context}`);

  if (status === 400)
    throw new BadRequestException('Invalid request to DIAL Core');
  if (status === 401) throw new UnauthorizedException();
  if (status === 403) throw new ForbiddenException();
  if (status === 404) throw new NotFoundException('Resource not found');
  if (status === 409) throw new ConflictException('Conflict');
  if (status === 413) throw new PayloadTooLargeException('Payload too large');
  if (status === 429)
    throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
  if (status >= 500)
    throw new BadGatewayException('DIAL Core returned a server error');

  throw new BadGatewayException(`Unexpected upstream status ${status}`);
};

const isTimeoutError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'TimeoutError';

const isNetworkError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.message.includes('ECONNREFUSED') ||
    error.message.includes('ENOTFOUND') ||
    error.message.includes('fetch failed'));

const isHttpError = (error: unknown): error is { status: number } =>
  typeof error === 'object' &&
  error != null &&
  'status' in error &&
  typeof (error as Record<string, unknown>).status === 'number';

/**
 * Handles an SDK-shaped error (`@epam/ai-dial-typescript-sdk`, `{ status }`)
 * and throws the matching Nest exception. Call this from a service's
 * catch block or when the SDK response carries an `error` field.
 */
export const handleDialSdkError = (
  error: unknown,
  context: string,
  logger?: Logger,
): never => {
  if (error instanceof HttpException) {
    throw error;
  }

  if (
    error instanceof TypeError ||
    isNetworkError(error) ||
    isTimeoutError(error)
  ) {
    logger?.error(`DIAL Core is unreachable during ${context}`, error);
    throw new ServiceUnavailableException('DIAL Core is unreachable');
  }

  if (isHttpError(error)) {
    return mapDialHttpStatus(error.status, context, logger);
  }

  logger?.error(`Unexpected response from DIAL Core during ${context}`, error);
  throw new BadGatewayException('Unexpected response from DIAL Core');
};

/**
 * Handles errors caught in a raw-`fetch` try/catch block. Re-throws Nest
 * exceptions as-is; maps `AbortError` (timeout) and unexpected errors.
 * Call this immediately after catching a fetch rejection — for a non-ok
 * `response.ok === false`, use `mapDialHttpStatus` instead.
 */
export const handleDialFetchError = (
  err: unknown,
  context: string,
  logger?: Logger,
  timeoutMs?: number,
): never => {
  if (err instanceof HttpException) {
    throw err;
  }

  const error = err as { name?: string; message?: string; stack?: string };

  if (error.name === 'AbortError') {
    logger?.error(
      `DIAL Core request timed out after ${timeoutMs ?? 0}ms (${context})`,
    );
    throw new ServiceUnavailableException('DIAL Core request timed out');
  }

  logger?.error(
    `Unexpected error during ${context}: ${error.name ?? 'Error'}`,
    error.stack,
  );
  throw new ServiceUnavailableException('DIAL Core is currently unavailable');
};
