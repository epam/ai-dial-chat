import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  extractDialErrorMessage,
  handleDialFetchError,
  isUpstreamTextExposable,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { EnvironmentVariables } from '../config/environment.config';
import { DialClientService } from '../dial/dial-client.service';
import type { ListScheduledTaskRunsQueryDto } from './dto/list-scheduled-task-runs-query.dto';
import type { ListScheduledTasksQueryDto } from './dto/list-scheduled-tasks-query.dto';
import { ScheduledTasksSortKey } from './dto/list-scheduled-tasks-query.dto';
import { ScheduledTaskRateLimitException } from './scheduled-task-rate-limit.exception';
import type { UpstreamScheduleResponse } from './scheduled-tasks.mapper';
import { ScheduleAction } from './types/schedule-action.enum';

const UPSTREAM_MESSAGE_MAX_LENGTH = 1000;
const UPSTREAM_CODE_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;

interface UpstreamErrorFields {
  upstreamMessage?: string;
  upstreamCode?: string;
}

/*
 * The reason and code DIAL Scheduler returned, sanitized for the client: the
 * message is trimmed and capped, the code must be a safe token. The raw body
 * itself is never forwarded.
 */
const extractUpstreamErrorFields = (body: unknown): UpstreamErrorFields => {
  const fields: UpstreamErrorFields = {};
  const message = extractDialErrorMessage(body)?.trim();
  if (message) {
    fields.upstreamMessage = message.slice(0, UPSTREAM_MESSAGE_MAX_LENGTH);
  }
  if (body !== null && typeof body === 'object') {
    const record = body as { code?: unknown; error?: { code?: unknown } };
    const code = record.error?.code ?? record.code;
    if (typeof code === 'string' && UPSTREAM_CODE_PATTERN.test(code)) {
      fields.upstreamCode = code;
    }
  }
  return fields;
};

/*
 * The BFF always sends an explicit order_by/order_dir pair upstream — even
 * when the client omits `sort` — so the endpoint's documented default
 * (firstToRun) is the one actually observed, instead of silently inheriting
 * upstream's own default (created_at desc).
 */
const SORT_ORDER_MAP: Record<
  ScheduledTasksSortKey,
  { orderBy: string; orderDir: 'asc' | 'desc' }
> = {
  [ScheduledTasksSortKey.FirstToRun]: {
    orderBy: 'next_run_time',
    orderDir: 'asc',
  },
  [ScheduledTasksSortKey.LastToRun]: {
    orderBy: 'next_run_time',
    orderDir: 'desc',
  },
  [ScheduledTasksSortKey.Newest]: { orderBy: 'created_at', orderDir: 'desc' },
  [ScheduledTasksSortKey.NameAZ]: { orderBy: 'name', orderDir: 'asc' },
};

/**
 * DIAL Scheduler transport: owns the Scheduler configuration, every upstream
 * URL under the routed `SCHEDULER_APP_ID` deployment, and the raw
 * `dialClient.fetchCore` call with its timeout and error mapping. The SDK has
 * no operation for this route, hence the shared-transport escape hatch.
 */
@Injectable()
export class SchedulerUpstreamClient {
  private readonly logger = new Logger(SchedulerUpstreamClient.name);
  private readonly schedulerAppId: string | undefined;
  private readonly schedulerServiceId: string | undefined;
  private readonly timeoutMs: number;

  constructor(
    private readonly dialClient: DialClientService,
    configService: ConfigService<EnvironmentVariables>,
  ) {
    this.schedulerAppId = configService.get('SCHEDULER_APP_ID', {
      infer: true,
    });
    this.schedulerServiceId = configService.get('SCHEDULER_SERVICE_ID', {
      infer: true,
    });
    this.timeoutMs =
      configService.get('SCHEDULER_SERVICE_TIMEOUT_MS', { infer: true }) ??
      10_000;
  }

  private getSchedulerAppId(): string {
    if (!this.schedulerAppId) {
      this.logger.error(
        'SCHEDULER_APP_ID is not configured — cannot proxy DIAL Scheduler requests',
      );
      throw new ServiceUnavailableException(
        'Scheduled tasks are not configured (SCHEDULER_APP_ID is missing)',
      );
    }
    return this.schedulerAppId;
  }

  getSchedulerServiceId(): string {
    if (!this.schedulerServiceId) {
      this.logger.error(
        'SCHEDULER_SERVICE_ID is not configured — cannot build DIAL Scheduler upstream payload',
      );
      throw new ServiceUnavailableException(
        'Scheduled tasks are not configured (SCHEDULER_SERVICE_ID is missing)',
      );
    }
    return this.schedulerServiceId;
  }

  schedulesUrl(scheduleId?: string): string {
    const base = `${this.dialClient.baseUrl}/v1/deployments/applications/${encodeURIComponent(this.getSchedulerAppId())}/route/v1/schedules`;
    return scheduleId
      ? `${base}/${encodeURIComponent(scheduleId)}`
      : `${base}/`;
  }

  scheduleActionUrl(scheduleId: string, action: ScheduleAction): string {
    return `${this.schedulesUrl(scheduleId)}/${action}`;
  }

  schedulesListUrl(query: ListScheduledTasksQueryDto): string {
    const searchParams = new URLSearchParams();
    if (query.limit != null) {
      searchParams.set('limit', String(query.limit));
    }
    if (query.offset != null) {
      searchParams.set('offset', String(query.offset));
    }
    if (query.search) {
      searchParams.set('name', query.search);
    }
    if (query.model) {
      searchParams.set('model', query.model);
    }
    const { orderBy, orderDir } =
      SORT_ORDER_MAP[query.sort ?? ScheduledTasksSortKey.FirstToRun];
    searchParams.set('order_by', orderBy);
    searchParams.set('order_dir', orderDir);
    const queryString = searchParams.toString();
    const url = this.schedulesUrl();
    return queryString ? `${url}?${queryString}` : url;
  }

  /*
   * The BFF always sends an explicit order_by=created_at&order_dir=desc pair
   * upstream — mirroring the same "always-explicit-default" decision made for
   * listScheduledTasks — so the endpoint's documented newest-first order is
   * the one actually observed, instead of relying on upstream's own default.
   */
  runsUrl(scheduleId: string, query: ListScheduledTaskRunsQueryDto): string {
    const searchParams = new URLSearchParams();
    searchParams.set('limit', String(query.limit ?? 20));
    searchParams.set('offset', String(query.offset ?? 0));
    searchParams.set('order_by', 'created_at');
    searchParams.set('order_dir', 'desc');
    return `${this.schedulesUrl(scheduleId)}/runs?${searchParams.toString()}`;
  }

  runUrl(scheduleId: string, runId: string): string {
    return `${this.schedulesUrl(scheduleId)}/runs/${encodeURIComponent(runId)}`;
  }

  async request<T = UpstreamScheduleResponse>(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    accessToken: string,
    context: string,
    body?: unknown,
    parseJson = true,
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    this.logger.debug(`Calling DIAL Scheduler: ${method} ${url} (${context})`);

    try {
      const response = await this.dialClient.fetchCore(url, {
        method,
        headers: {
          ...getBearerAuthHeaders(accessToken),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      this.logger.debug(
        `DIAL Scheduler responded ${response.status} for ${context}`,
      );

      if (!response.ok) {
        let errorBody: unknown;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = undefined;
        }
        try {
          return this.throwUpstreamError(response.status, context, errorBody);
        } catch (error) {
          if (error instanceof HttpException && error.getStatus() === 429) {
            throw new ScheduledTaskRateLimitException(
              error.getResponse(),
              response.headers?.get('retry-after') ?? null,
            );
          }
          throw error;
        }
      }

      if (!parseJson) {
        return undefined as T;
      }

      const json = (await response.json()) as T;
      this.logger.debug(
        `DIAL Scheduler body for ${context}: keys=${JSON.stringify(
          Array.isArray(json)
            ? `array(${json.length})`
            : Object.keys(json as object),
        )}`,
      );
      return json;
    } catch (err) {
      return handleDialFetchError(err, context, this.logger, this.timeoutMs);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /*
   * Maps a non-2xx Scheduler response exactly as `mapDialHttpStatus` does —
   * same status, exception type and generic `message` — and, where the shared
   * exposure rule allows, adds Scheduler's own reason and code as
   * `upstreamMessage`/`upstreamCode` so the client can show them.
   */
  private throwUpstreamError(
    status: number,
    context: string,
    errorBody: unknown,
  ): never {
    try {
      return mapDialHttpStatus(status, context, this.logger, errorBody);
    } catch (err) {
      if (!(err instanceof HttpException) || !isUpstreamTextExposable(status)) {
        throw err;
      }
      const fields = extractUpstreamErrorFields(errorBody);
      if (!fields.upstreamMessage && !fields.upstreamCode) throw err;
      const mapped = err.getResponse();
      /* Extend the freshly built body in place so the exception subtype survives. */
      if (typeof mapped === 'object' && mapped !== null) {
        Object.assign(mapped, fields);
        throw err;
      }
      throw new HttpException(
        { statusCode: err.getStatus(), message: mapped, ...fields },
        err.getStatus(),
      );
    }
  }
}
