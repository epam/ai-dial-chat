import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { isExcludedFromTelemetry } from '../../telemetry/excluded-paths';
import {
  httpServerRequestDuration,
  resolveRouteTemplate,
} from '../../telemetry/http-metrics';
import { getErrorDetails } from '../utils/error-details';

/**
 * Interceptor for logging and recording request metrics.
 *
 * Logs endpoint duration, method, path, and status code, and records the same data on the
 * shared `http.server.request.duration` histogram (see telemetry/http-metrics.ts), which is a
 * no-op when OpenTelemetry metrics are disabled. Infra probe routes
 * (`telemetry/excluded-paths.ts`, e.g. `/api/health`) are still logged but never recorded onto
 * the histogram, mirroring the same routes' exclusion from tracing so probe traffic doesn't
 * pollute business-request dashboards/alerting.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Metrics');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const startTime = Date.now();
    const route = resolveRouteTemplate(request);
    const isExcludedFromMetrics = isExcludedFromTelemetry(route);

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;

          this.logger.log(`${method} ${url} ${statusCode} - ${duration}ms`);

          if (isExcludedFromMetrics) return;

          httpServerRequestDuration.record(duration / 1000, {
            'http.request.method': method,
            'http.route': route,
            'http.response.status_code': statusCode,
          });
        },
        error: (error: unknown) => {
          const duration = Date.now() - startTime;
          const { statusCode, message } = getErrorDetails(error);

          this.logger.error(
            `${method} ${url} ${statusCode} - ${duration}ms - Error: ${message}`,
          );

          if (isExcludedFromMetrics) return;

          httpServerRequestDuration.record(duration / 1000, {
            'http.request.method': method,
            'http.route': route,
            'http.response.status_code': statusCode,
          });
        },
      }),
    );
  }
}
