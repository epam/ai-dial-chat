import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { EnvironmentVariables } from '../config/environment.config';
import { withCachedDialRequest } from '../dial/cached-dial-request.helper';
import { DialClientService } from '../dial/dial-client.service';
import type { CreateScheduledTaskBodyDto } from './dto/create-scheduled-task.dto';
import type { ListScheduledTasksQueryDto } from './dto/list-scheduled-tasks-query.dto';
import { ScheduledTasksSortKey } from './dto/list-scheduled-tasks-query.dto';
import type { ListScheduledTasksResponseDto } from './dto/list-scheduled-tasks.dto';
import type { ScheduledTaskDto } from './dto/scheduled-task.dto';
import type { UpdateScheduledTaskBodyDto } from './dto/update-scheduled-task.dto';
import {
  fromUpstreamSchedule,
  toUpstreamSchedulePayload,
  type UpstreamScheduleResponse,
} from './scheduled-tasks.mapper';

const LIST_CACHE_TTL_MS = 30 * 1000;
const LIST_CACHE_EPOCH_TTL_MS = 24 * 60 * 60 * 1000;

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

@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name);
  private readonly schedulerAppId: string | undefined;
  private readonly schedulerServiceId: string | undefined;
  private readonly timeoutMs: number;

  constructor(
    private readonly dialClient: DialClientService,
    configService: ConfigService<EnvironmentVariables>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
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

  private getSchedulerServiceId(): string {
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

  private buildSchedulesUrl(scheduleId?: string): string {
    const base = `${this.dialClient.baseUrl}/v1/deployments/applications/${encodeURIComponent(this.getSchedulerAppId())}/route/v1/schedules`;
    return scheduleId
      ? `${base}/${encodeURIComponent(scheduleId)}`
      : `${base}/`;
  }

  private buildSchedulesListUrl(query: ListScheduledTasksQueryDto): string {
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
    const { orderBy, orderDir } =
      SORT_ORDER_MAP[query.sort ?? ScheduledTasksSortKey.FirstToRun];
    searchParams.set('order_by', orderBy);
    searchParams.set('order_dir', orderDir);
    const queryString = searchParams.toString();
    const url = this.buildSchedulesUrl();
    return queryString ? `${url}?${queryString}` : url;
  }

  /*
   * cache-manager's `Cache` type has no key-enumeration/prefix-delete API, so
   * invalidating "every cached list variant for a user" (one per limit/offset/
   * search combination) can't be done by scanning keys. Instead, each user has
   * an "epoch" counter baked into their list cache keys; bumping the epoch on
   * create/update makes every previously cached variant unreachable without
   * needing to know or delete each key individually.
   */
  private listCacheEpochKey(userSub: string): string {
    return `scheduled-tasks:list-epoch:${userSub}`;
  }

  private async getListCacheEpoch(userSub: string): Promise<number> {
    return (
      (await this.cacheManager.get<number>(this.listCacheEpochKey(userSub))) ??
      0
    );
  }

  /*
   * `limit`/`offset` are always validated, delimiter-free digit sequences
   * (or the empty string), and `sort` is always one of the fixed enum
   * values, so none of the leading `:`-separated fields can ever be
   * ambiguous with each other or with `search`. `search` is still
   * percent-encoded before being embedded, purely so a colon in a search
   * term doesn't make the raw cache key/log line harder for a human to read.
   */
  private normalizeListQuery(query: ListScheduledTasksQueryDto): string {
    const limit = query.limit ?? '';
    const offset = query.offset ?? 0;
    const search = encodeURIComponent(query.search ?? '');
    const sort = query.sort ?? ScheduledTasksSortKey.FirstToRun;
    return `${limit}:${offset}:${search}:${sort}`;
  }

  private async buildListCacheKey(
    userSub: string,
    query: ListScheduledTasksQueryDto,
  ): Promise<string> {
    const epoch = await this.getListCacheEpoch(userSub);
    return `scheduled-tasks:list:${userSub}:${epoch}:${this.normalizeListQuery(query)}`;
  }

  private async fetchUpstream(
    url: string,
    method: 'GET' | 'POST' | 'PUT',
    accessToken: string,
    context: string,
    body?: unknown,
  ): Promise<UpstreamScheduleResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    this.logger.debug(`Calling DIAL Scheduler: ${method} ${url} (${context})`);

    try {
      const response = await fetch(url, {
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
        return mapDialHttpStatus(
          response.status,
          context,
          this.logger,
          errorBody,
        );
      }

      const json = (await response.json()) as UpstreamScheduleResponse;
      this.logger.debug(
        `DIAL Scheduler body for ${context}: keys=${JSON.stringify(
          Array.isArray(json) ? `array(${json.length})` : Object.keys(json),
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
   * The DIAL Scheduler list endpoint returns a paginated envelope
   * (`{ count, limit, offset, results, next, previous }`), not a bare array
   * or an `{ items }` wrapper — `results` is checked first since it's the
   * shape confirmed against a live instance; `items`/array are kept as
   * fallbacks in case a future Scheduler version changes the envelope.
   */
  private extractListItems(
    result: UpstreamScheduleResponse,
  ): UpstreamScheduleResponse[] {
    if (Array.isArray(result)) {
      return result as unknown as UpstreamScheduleResponse[];
    }
    const envelope = result as unknown as {
      results?: UpstreamScheduleResponse[];
      items?: UpstreamScheduleResponse[];
    };
    return envelope.results ?? envelope.items ?? [];
  }

  /*
   * Only present when the upstream response is the paginated envelope
   * (`{ count, limit, offset, results, next, previous }`); a bare array or
   * an `{ items }` fallback shape has none of these, so every field stays
   * `undefined` in that case.
   */
  private extractListPagination(result: UpstreamScheduleResponse): {
    count?: number;
    limit?: number;
    offset?: number;
    next?: string | null;
    previous?: string | null;
  } {
    if (Array.isArray(result)) {
      return {};
    }
    const envelope = result as unknown as {
      count?: number;
      limit?: number;
      offset?: number;
      next?: string | null;
      previous?: string | null;
    };
    return {
      count: envelope.count,
      limit: envelope.limit,
      offset: envelope.offset,
      next: envelope.next,
      previous: envelope.previous,
    };
  }

  async listScheduledTasks(
    userSub: string,
    accessToken: string,
    query: ListScheduledTasksQueryDto = {},
  ): Promise<ListScheduledTasksResponseDto> {
    return withCachedDialRequest({
      cacheManager: this.cacheManager,
      cacheKey: await this.buildListCacheKey(userSub, query),
      ttlMs: LIST_CACHE_TTL_MS,
      context: 'list scheduled tasks',
      logger: this.logger,
      fetch: async () => {
        const result = await this.fetchUpstream(
          this.buildSchedulesListUrl(query),
          'GET',
          accessToken,
          'list scheduled tasks',
        );
        const items = this.extractListItems(result);
        const pagination = this.extractListPagination(result);
        this.logger.debug(
          `list scheduled tasks: resolved ${items.length} item(s) (upstream shape was ${
            Array.isArray(result)
              ? 'array'
              : `object{${Object.keys(result).join(',')}}`
          })`,
        );
        return { items: items.map(fromUpstreamSchedule), ...pagination };
      },
    });
  }

  async createScheduledTask(
    userSub: string,
    accessToken: string,
    body: CreateScheduledTaskBodyDto,
  ): Promise<ScheduledTaskDto> {
    const payload = toUpstreamSchedulePayload(
      body,
      this.dialClient.baseUrl,
      this.dialClient.dialApiVersion,
      this.getSchedulerServiceId(),
    );

    const result = await this.fetchUpstream(
      this.buildSchedulesUrl(),
      'POST',
      accessToken,
      'create scheduled task',
      payload,
    );

    await this.invalidateListCache(userSub);
    return fromUpstreamSchedule(result);
  }

  async getScheduledTask(
    accessToken: string,
    scheduleId: string,
  ): Promise<ScheduledTaskDto> {
    const result = await this.fetchUpstream(
      this.buildSchedulesUrl(scheduleId),
      'GET',
      accessToken,
      `get scheduled task "${scheduleId}"`,
    );
    return fromUpstreamSchedule(result);
  }

  async updateScheduledTask(
    userSub: string,
    accessToken: string,
    scheduleId: string,
    body: UpdateScheduledTaskBodyDto,
  ): Promise<ScheduledTaskDto> {
    const payload = toUpstreamSchedulePayload(
      body,
      this.dialClient.baseUrl,
      this.dialClient.dialApiVersion,
      this.getSchedulerServiceId(),
    );

    const result = await this.fetchUpstream(
      this.buildSchedulesUrl(scheduleId),
      'PUT',
      accessToken,
      `update scheduled task "${scheduleId}"`,
      payload,
    );

    await this.invalidateListCache(userSub);
    return fromUpstreamSchedule(result);
  }

  private async invalidateListCache(userSub: string): Promise<void> {
    try {
      const epoch = await this.getListCacheEpoch(userSub);
      await this.cacheManager.set(
        this.listCacheEpochKey(userSub),
        epoch + 1,
        LIST_CACHE_EPOCH_TTL_MS,
      );
    } catch (err) {
      handleDialFetchError(
        err,
        `invalidate scheduled tasks list cache (sub: ${userSub})`,
        this.logger,
        0,
        { swallow: true },
      );
    }
  }
}
