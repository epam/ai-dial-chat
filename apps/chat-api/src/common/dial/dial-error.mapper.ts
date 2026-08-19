import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  MethodNotAllowedException,
  NotFoundException,
  PayloadTooLargeException,
  PreconditionFailedException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';

/**
 * Maps a DIAL Core HTTP status to the appropriate Nest exception. Shared by
 * the SDK-shaped (`handleDialSdkError`) and fetch-shaped (`handleDialFetchError`)
 * entry points so every `chat-api` domain throws the same exception subtype
 * for a given upstream status code.
 *
 * `upstreamMessage`, when provided, replaces the generic 400/409/413/429/5xx
 * text with DIAL Core's own explanation (e.g. "The specified endpoint
 * 'https://x' is invalid or unreachable") so the client can show the actual
 * reason instead of a meaningless generic message. It's never used for
 * 401/403/404 — those stay generic since the upstream body could describe
 * an internal auth/resource detail that shouldn't reach the client.
 */
export const mapDialHttpStatus = (
  status: number,
  context: string,
  logger?: Logger,
  errorBody?: unknown,
  upstreamMessage?: string,
): never => {
  logger?.warn(`DIAL Core returned ${status} for ${context}`);
  if (errorBody !== undefined) {
    logger?.warn(
      `DIAL Core error body for ${context}: ${JSON.stringify(errorBody)}`,
    );
  }

  if (status === 400)
    throw new BadRequestException(
      upstreamMessage ?? 'Invalid request to DIAL Core',
    );
  if (status === 401) throw new UnauthorizedException();
  if (status === 403) throw new ForbiddenException();
  if (status === 404) throw new NotFoundException('Resource not found');
  if (status === 409)
    throw new ConflictException(upstreamMessage ?? 'Conflict');
  if (status === 413)
    throw new PayloadTooLargeException(upstreamMessage ?? 'Payload too large');
  if (status === 405)
    throw new MethodNotAllowedException(
      upstreamMessage ?? 'Method not allowed for this resource',
    );
  if (status === 412)
    throw new PreconditionFailedException(
      upstreamMessage ?? 'Precondition failed',
    );
  if (status === 422)
    throw new UnprocessableEntityException(
      upstreamMessage ?? 'Unprocessable entity',
    );
  if (status === 429)
    throw new HttpException(
      upstreamMessage ?? 'Too Many Requests',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  if (status >= 500)
    throw new BadGatewayException(
      upstreamMessage ?? 'DIAL Core returned a server error',
    );

  throw new BadGatewayException(
    upstreamMessage ?? `Unexpected upstream status ${status}`,
  );
};

interface DialErrorBody {
  error?: { display_message?: string; message?: string };
  message?: string;
}

// TODO: try to move this into @epam/ai-dial-typescript-sdk later.
/**
 * Extracts a human-readable message from an untyped DIAL Core error payload.
 * The body may be a plain string (e.g. an endpoint-reachability failure) or
 * an object carrying `error.display_message`, `error.message`, or `message`.
 */
export const extractDialErrorMessage = (error: unknown): string | undefined => {
  if (typeof error === 'string') return error;
  if (error != null && typeof error === 'object') {
    const body = error as DialErrorBody;
    const message =
      body.error?.display_message ?? body.error?.message ?? body.message;
    if (typeof message === 'string') return message;
  }
  return undefined;
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
 * and throws the matching Nest exception. Call this from a service's catch
 * block or when the SDK response carries an `error` field.
 *
 * Pass `response` (the raw `Response` the SDK call resolved with) whenever
 * one is available — `error` is only ever the parsed DIAL Core error body,
 * which never carries a `status` field itself, so without `response` the
 * real upstream status is lost and every error falls through to a generic
 * `BadGatewayException`.
 */
export const handleDialSdkError = (
  error: unknown,
  context: string,
  logger?: Logger,
  response?: { status: number },
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

  const mappableError = response
    ? {
        ...(typeof error === 'object' && error !== null ? error : {}),
        status: response.status,
      }
    : error;

  if (isHttpError(mappableError)) {
    return mapDialHttpStatus(mappableError.status, context, logger);
  }

  logger?.error(`Unexpected response from DIAL Core during ${context}`, error);
  throw new BadGatewayException('Unexpected response from DIAL Core');
};

interface HandleDialFetchError {
  (err: unknown, context: string, logger?: Logger, timeoutMs?: number): never;
  (
    err: unknown,
    context: string,
    logger: Logger | undefined,
    timeoutMs: number | undefined,
    options: { swallow: true },
  ): void;
}

/**
 * Handles errors caught in a raw-`fetch` try/catch block. Re-throws Nest
 * exceptions as-is; maps `AbortError` (timeout) and unexpected errors.
 * Call this immediately after catching a fetch rejection — for a non-ok
 * `response.ok === false`, use `mapDialHttpStatus` instead.
 *
 * Pass `{ swallow: true }` for failures that must only be logged and never
 * propagated (e.g. a cache-invalidation step after the real operation already
 * succeeded) — the error is logged with the same messages as the throwing
 * path, but the call returns instead of throwing.
 */
const handleDialFetchErrorImpl = (
  err: unknown,
  context: string,
  logger?: Logger,
  timeoutMs?: number,
  options?: { swallow?: boolean },
): void => {
  if (err instanceof HttpException) {
    if (options?.swallow) {
      logger?.warn(`${context} failed: ${err.message}`);
      return;
    }
    throw err;
  }

  const error = err as { name?: string; message?: string; stack?: string };

  if (error.name === 'AbortError') {
    logger?.error(
      `DIAL Core request timed out after ${timeoutMs ?? 0}ms (${context})`,
    );
    if (options?.swallow) {
      return;
    }
    throw new ServiceUnavailableException('DIAL Core request timed out');
  }

  logger?.error(
    `Unexpected error during ${context}: ${error.name ?? 'Error'}`,
    error.stack,
  );
  if (options?.swallow) {
    return;
  }
  throw new ServiceUnavailableException('DIAL Core is currently unavailable');
};

export const handleDialFetchError =
  handleDialFetchErrorImpl as unknown as HandleDialFetchError;
