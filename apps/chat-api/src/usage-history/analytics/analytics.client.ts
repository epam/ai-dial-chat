import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import type { EnvironmentVariables } from '../../config/environment.config';

const USAGE_LOG_SCHEMA_PATH = '/v1/queries/entities/schema/dial_usage_log';
const EXECUTE_QUERY_PATH = '/v1/queries/execute';

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * DIAL Analytics (ADAS) transport for the usage history route. ADAS is not
 * DIAL Core, so the DIAL SDK does not apply (apps/chat-api/AGENTS.md §4): this
 * is a raw `fetch` with the Scheduler client's timeout pattern. It forwards
 * only the caller's own token and reuses the shared upstream classification
 * (`mapDialHttpStatus` / `handleDialFetchError`, called without a logger so
 * no line names DIAL Core), so callers receive the usual Nest exception for
 * each ADAS outcome. Every path is a constant; no caller input reaches a URL.
 */
@Injectable()
export class AnalyticsClient {
  private readonly logger = new Logger(AnalyticsClient.name);
  private readonly baseUrl: string | undefined;
  private readonly timeoutMs: number;

  constructor(configService: ConfigService<EnvironmentVariables>) {
    /* Trailing slashes are dropped so a base URL with a path prefix keeps it. */
    this.baseUrl =
      configService
        .get('ANALYTICS_URL', { infer: true })
        ?.trim()
        .replace(/\/+$/, '') || undefined;
    this.timeoutMs =
      configService.get('ANALYTICS_TIMEOUT_MS', { infer: true }) ??
      DEFAULT_TIMEOUT_MS;
  }

  /** Whether `ANALYTICS_URL` is set; without it no call may be made. */
  get isConfigured(): boolean {
    return this.baseUrl !== undefined;
  }

  /** `GET /v1/queries/entities/schema/dial_usage_log` as the caller. */
  getUsageLogSchema(accessToken: string): Promise<unknown> {
    return this.request('GET', USAGE_LOG_SCHEMA_PATH, accessToken);
  }

  /** `POST /v1/queries/execute` with a structured query document. */
  executeQuery(accessToken: string, query: object): Promise<unknown> {
    return this.request('POST', EXECUTE_QUERY_PATH, accessToken, query);
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    accessToken: string,
    body?: object,
  ): Promise<unknown> {
    const context = `DIAL Analytics ${method} ${path}`;
    if (this.baseUrl === undefined) {
      /* Callers check `isConfigured` first; reaching here is a programming error. */
      throw new Error(`${context}: ANALYTICS_URL is not configured`);
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          ...getBearerAuthHeaders(accessToken),
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        /* Like the other raw upstream readers: a redirect never decides where the user token goes. */
        redirect: 'manual',
        signal: controller.signal,
      });
      const outcome = `${context} answered ${response.status} in ${Date.now() - startedAt}ms`;
      if (!response.ok) {
        /* The raw ADAS status: the mapped exception below no longer carries it. */
        this.logger.warn(outcome);
        /* The body is discarded unread: ADAS error text never reaches logs or clients. */
        await response.body?.cancel();
        return mapDialHttpStatus(response.status, context);
      }
      this.logger.debug(outcome);
      return (await response.json()) as unknown;
    } catch (err) {
      return handleDialFetchError(err, context, undefined, this.timeoutMs);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
