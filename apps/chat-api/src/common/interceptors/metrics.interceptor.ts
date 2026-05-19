import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Interceptor for logging request metrics.
 *
 * Logs endpoint duration, method, path, and status code for monitoring purposes.
 * Can be extended to integrate with Prometheus, DataDog, or other monitoring services.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Metrics');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;

          this.logger.log(`${method} ${url} ${statusCode} - ${duration}ms`);

          // TODO: Send metrics to monitoring service (Prometheus, DataDog, etc.)
          // Example: metricsService.recordHttpRequest({ method, url, statusCode, duration });
        },
        error: (error: unknown) => {
          const duration = Date.now() - startTime;
          const statusCode =
            typeof error === 'object' &&
            error !== null &&
            'status' in error &&
            typeof (error as { status?: unknown }).status === 'number'
              ? (error as { status: number }).status
              : 500;
          const message =
            typeof error === 'object' &&
            error !== null &&
            'message' in error &&
            typeof (error as { message?: unknown }).message === 'string'
              ? (error as { message: string }).message
              : 'Unknown error';

          this.logger.error(
            `${method} ${url} ${statusCode} - ${duration}ms - Error: ${message}`,
          );

          // TODO: Send error metrics to monitoring service
          // Example: metricsService.recordHttpError({ method, url, statusCode, duration, error });
        },
      }),
    );
  }
}
