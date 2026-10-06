import { HttpStatus, type Type } from '@nestjs/common';
import {
  ApiResponse,
  type ApiResponseOptions,
  DECORATORS,
} from '@nestjs/swagger';
import { isUpstreamTextExposable } from './dial-error.mapper';

/**
 * `Retry-After` header schema for a 429 whose handler forwards DIAL Core's
 * (or DIAL Scheduler's) own `Retry-After` value to the client.
 */
export const DIAL_CORE_RETRY_AFTER_HEADER = {
  'Retry-After': {
    description: 'Upstream retry delay, when provided by DIAL Core',
    schema: { type: 'string' },
  },
};

/**
 * 429 entry for a handler that forwards DIAL Core's `Retry-After` header.
 * Handlers that do not forward the header use `ApiDialCoreErrors()`'s plain 429.
 */
export const DIAL_CORE_RATE_LIMITED_RESPONSE = {
  status: HttpStatus.TOO_MANY_REQUESTS,
  description: 'DIAL Core rate-limited the request',
  headers: DIAL_CORE_RETRY_AFTER_HEADER,
};

/**
 * Statuses `mapDialHttpStatus` / `handleDialSdkError` / `handleDialFetchError`
 * pass through for any DIAL Core call, declared by default.
 */
export const DIAL_CORE_ERROR_STATUSES = [
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
  HttpStatus.NOT_FOUND,
  HttpStatus.CONFLICT,
  HttpStatus.PAYLOAD_TOO_LARGE,
  HttpStatus.UNPROCESSABLE_ENTITY,
  HttpStatus.TOO_MANY_REQUESTS,
  HttpStatus.BAD_GATEWAY,
  HttpStatus.SERVICE_UNAVAILABLE,
] as const;

/**
 * Statuses `mapDialHttpStatus` also maps but DIAL Core only returns for
 * specific operations (method restrictions, `If-Match` preconditions), so
 * they are declared only when a handler opts in through `include`.
 */
export const DIAL_CORE_OPT_IN_ERROR_STATUSES = [
  HttpStatus.METHOD_NOT_ALLOWED,
  HttpStatus.PRECONDITION_FAILED,
] as const;

const DIAL_CORE_ERROR_DESCRIPTIONS: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'DIAL Core rejected the request as invalid',
  [HttpStatus.UNAUTHORIZED]:
    'Not authenticated, or DIAL Core rejected the session token',
  [HttpStatus.FORBIDDEN]: 'DIAL Core denied access to the resource',
  [HttpStatus.NOT_FOUND]: 'DIAL Core resource not found',
  [HttpStatus.METHOD_NOT_ALLOWED]:
    'DIAL Core does not allow this method for the resource',
  [HttpStatus.CONFLICT]:
    'DIAL Core reported a conflict with the current resource state',
  [HttpStatus.PRECONDITION_FAILED]:
    'DIAL Core precondition failed (the resource changed since it was read)',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'DIAL Core rejected the payload as too large',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'DIAL Core could not process the request',
  [HttpStatus.TOO_MANY_REQUESTS]: 'DIAL Core rate-limited the request',
  [HttpStatus.BAD_GATEWAY]:
    'DIAL Core returned a server error or an unexpected response',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'DIAL Core is unreachable or timed out',
};

export interface ApiDialCoreErrorsOptions {
  /** Default statuses this handler can never return (e.g. a custom mapping that rewrites them). */
  exclude?: readonly HttpStatus[];
  /** Extra mapper statuses to declare — normally from `DIAL_CORE_OPT_IN_ERROR_STATUSES`. */
  include?: readonly HttpStatus[];
  /** Whether the handler forwards DIAL Core's `Retry-After` header on a 429. */
  hasRetryAfter?: boolean;
  /**
   * Error body schema for statuses whose upstream text may reach the client
   * (`isUpstreamTextExposable`), for domains that extend the Nest error body.
   */
  errorType?: Type<unknown>;
}

const buildEntry = (
  status: HttpStatus,
  options: ApiDialCoreErrorsOptions,
): ApiResponseOptions => {
  const entry: ApiResponseOptions = {
    status,
    description:
      DIAL_CORE_ERROR_DESCRIPTIONS[status] ?? `DIAL Core returned ${status}`,
  };
  if (status === HttpStatus.TOO_MANY_REQUESTS && options.hasRetryAfter) {
    entry.headers = DIAL_CORE_RETRY_AFTER_HEADER;
  }
  if (options.errorType && isUpstreamTextExposable(status)) {
    entry.type = options.errorType;
  }
  return entry;
};

/**
 * Declares the error statuses a handler can return because it rethrows DIAL
 * Core failures through `mapDialHttpStatus`, `handleDialSdkError`, or
 * `handleDialFetchError`.
 *
 * A status the handler already declares keeps its own `@ApiResponse` — this
 * decorator only fills the missing ones. `@nestjs/swagger` merges two entries
 * for one status by concatenating their descriptions, so place this decorator
 * ABOVE the handler's own `@ApiResponse` decorators (TypeScript applies method
 * decorators bottom-up, so it then runs after them and sees what they declared).
 *
 * @example
 * ```ts
 * @Get()
 * @ApiOperation({ operationId: 'listFiles' })
 * @ApiDialCoreErrors({ exclude: [HttpStatus.PAYLOAD_TOO_LARGE] })
 * @ApiResponse({ status: 200, type: ListFilesResponseDto })
 * @ApiResponse({ status: 404, description: 'Bucket or path not found' })
 * listFiles() { … }
 * ```
 */
export const ApiDialCoreErrors =
  (options: ApiDialCoreErrorsOptions = {}): MethodDecorator =>
  (target, propertyKey, descriptor) => {
    const declared: Record<string, unknown> =
      Reflect.getMetadata(
        DECORATORS.API_RESPONSE,
        descriptor.value as object,
      ) ?? {};
    const excluded = new Set<number>(options.exclude ?? []);
    const statuses = new Set<HttpStatus>([
      ...DIAL_CORE_ERROR_STATUSES,
      ...(options.include ?? []),
    ]);

    for (const status of statuses) {
      if (excluded.has(status) || String(status) in declared) continue;
      ApiResponse(buildEntry(status, options))(target, propertyKey, descriptor);
    }
    return descriptor;
  };
