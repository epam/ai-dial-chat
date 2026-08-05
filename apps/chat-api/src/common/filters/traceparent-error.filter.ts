import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { getActiveTraceparent } from '../../telemetry/traceparent.middleware';

/*
 * Global exception filter that appends the active request's `traceparent` to JSON error
 * response bodies, mirroring the value already set on the response header by
 * `traceparentMiddleware`. It delegates entirely to `HttpException`'s own status/body (or a
 * generic 500 body for unmapped errors) instead of rebuilding Nest/DIAL's error-mapping logic,
 * so `statusCode`/`message`/`error`/any domain `code` are never altered — only `traceparent` is
 * added, and only when a valid active span exists and the response hasn't already been sent.
 *
 * Registering this as the global filter replaces Nest's default `BaseExceptionFilter`, which
 * otherwise logs the full exception (message + stack) for every unmapped (non-`HttpException`)
 * error — so unmapped exceptions are logged here too, keeping that diagnostic trail intact.
 */
@Catch()
export class TraceparentErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(TraceparentErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    /*
     * A streaming/SSE response that already started sending data (or any response whose headers
     * are already flushed) can't have its body rewritten — attempting `response.json()` here
     * would throw `ERR_HTTP_HEADERS_SENT`. Leave it untouched, matching
     * `traceparentMiddleware`'s own no-op behavior for responses it can no longer affect.
     */
    if (response.headersSent) {
      return;
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: status, message: 'Internal server error' };

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
    }

    const responseBody =
      typeof body === 'object' && body !== null
        ? { ...body }
        : { statusCode: status, message: body };

    const traceparent = getActiveTraceparent();

    if (traceparent) {
      (responseBody as Record<string, unknown>).traceparent = traceparent;
    }

    response.status(status).json(responseBody);
  }
}
