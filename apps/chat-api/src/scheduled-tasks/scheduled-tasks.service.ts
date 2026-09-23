import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
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
import { DeploymentsService } from '../deployments/deployments.service';
import { withCachedDialRequest } from '../dial/cached-dial-request.helper';
import { DialClientService } from '../dial/dial-client.service';
import type { CreateScheduledTaskBodyDto } from './dto/create-scheduled-task.dto';
import type { ListScheduledTaskRunsQueryDto } from './dto/list-scheduled-task-runs-query.dto';
import type { ListScheduledTaskRunsResponseDto } from './dto/list-scheduled-task-runs.dto';
import type { ListScheduledTasksQueryDto } from './dto/list-scheduled-tasks-query.dto';
import { ScheduledTasksSortKey } from './dto/list-scheduled-tasks-query.dto';
import type { ListScheduledTasksResponseDto } from './dto/list-scheduled-tasks.dto';
import { ScheduledTaskRunStatus } from './dto/scheduled-task-run.dto';
import {
  ScheduleTriggerType,
  type ScheduledTaskDto,
} from './dto/scheduled-task.dto';
import type { UpdateScheduledTaskBodyDto } from './dto/update-scheduled-task.dto';
import {
  fromUpstreamRun,
  fromUpstreamSchedule,
  toUpstreamSchedulePayload,
  type UpstreamScheduleResponse,
  type UpstreamScheduleRun,
} from './scheduled-tasks.mapper';
import { ScheduleAction } from './types/schedule-action.enum';
import { ScheduledTaskErrorCode } from './types/scheduled-task-error-code.enum';

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
    private readonly deploymentsService: DeploymentsService,
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

  private buildScheduleActionUrl(
    scheduleId: string,
    action: ScheduleAction,
  ): string {
    return `${this.buildSchedulesUrl(scheduleId)}/${action}`;
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
   * The BFF always sends an explicit order_by=created_at&order_dir=desc pair
   * upstream — mirroring the same "always-explicit-default" decision made for
   * listScheduledTasks — so the endpoint's documented newest-first order is
   * the one actually observed, instead of relying on upstream's own default.
   */
  private buildRunsUrl(
    scheduleId: string,
    query: ListScheduledTaskRunsQueryDto,
  ): string {
    const searchParams = new URLSearchParams();
    searchParams.set('limit', String(query.limit ?? 20));
    searchParams.set('offset', String(query.offset ?? 0));
    searchParams.set('order_by', 'created_at');
    searchParams.set('order_dir', 'desc');
    return `${this.buildSchedulesUrl(scheduleId)}/runs?${searchParams.toString()}`;
  }

  /*
   * Completion candidate gate, first two clauses of the derivation for
   * one-time (date-trigger) schedules: nothing left to run. The gate is an OR
   * so it is path-independent — list responses that omit the nested `trigger`
   * rely on `nextRunTime` alone; responses that carry `trigger` have both arms
   * and they agree wherever both are computable. The clock comparison uses
   * this server's clock, keeping skew/timezone handling in one place.
   */
  private isCompletionCandidate(task: ScheduledTaskDto): boolean {
    if (task.triggerType !== ScheduleTriggerType.Date) {
      return false;
    }
    if (task.nextRunTime == null) {
      return true;
    }
    const triggerDate = task.trigger?.date;
    const triggerDateMs = triggerDate ? new Date(triggerDate).getTime() : NaN;
    return !Number.isNaN(triggerDateMs) && triggerDateMs <= Date.now();
  }

  /*
   * Recurring-schedule terminal state: the activity window has closed with no
   * upcoming run, so resuming can never produce another run — the same
   * condition that disables the detail view's Active switch. Unlike a one-time
   * schedule, this is unambiguous from the schedule fields alone, so no
   * run-history call is needed. A cron schedule without an `endDate`, or with
   * one still in the future, is merely paused — not terminal. Degrades to
   * `false` when the response carries no `trigger.cron.endDate` (a list shape
   * without the nested trigger), leaving such cards on today's Paused display.
   */
  private isExpiredRecurring(task: ScheduledTaskDto): boolean {
    if (task.triggerType !== ScheduleTriggerType.Cron) {
      return false;
    }
    if (task.nextRunTime != null) {
      return false;
    }
    const endDate = task.trigger?.cron?.endDate;
    const endDateMs = endDate ? new Date(endDate).getTime() : NaN;
    return !Number.isNaN(endDateMs) && endDateMs <= Date.now();
  }

  /** Newest run of a schedule (the runs endpoint's documented order is newest-first). */
  private async fetchNewestRun(
    scheduleId: string,
    accessToken: string,
  ): Promise<UpstreamScheduleRun | undefined> {
    const result = await this.fetchUpstream<
      UpstreamScheduleResponse & { results?: UpstreamScheduleRun[] }
    >(
      this.buildRunsUrl(scheduleId, { limit: 1, offset: 0 }),
      'GET',
      accessToken,
      `resolve scheduled task completion "${scheduleId}"`,
    );
    return result.results?.[0];
  }

  /*
   * Terminal-state resolution: an expired-window recurring schedule is
   * completed from its fields alone (no runs call); a one-time candidate
   * additionally needs its newest run to be terminal (Success or Error) —
   * "completed" means the task has finished, regardless of outcome.
   * InProgress, Missed, and an empty run list all mean not completed, and a
   * non-terminal schedule is never completed. A failed runs call degrades to
   * `undefined` (rendered identically to false) instead of failing the parent
   * list/get.
   */
  private async resolveIsCompleted(
    task: ScheduledTaskDto,
    accessToken: string,
  ): Promise<boolean | undefined> {
    if (this.isExpiredRecurring(task)) {
      return true;
    }
    if (!this.isCompletionCandidate(task)) {
      return false;
    }
    try {
      const newestRun = await this.fetchNewestRun(task.id, accessToken);
      if (newestRun == null) {
        return false;
      }
      const status = fromUpstreamRun(newestRun).status;
      return (
        status === ScheduledTaskRunStatus.Success ||
        status === ScheduledTaskRunStatus.Error
      );
    } catch (err) {
      this.logger.warn(
        `Failed to resolve completion for scheduled task "${task.id}"; returning isCompleted as unknown`,
        err instanceof Error ? err.stack : undefined,
      );
      return undefined;
    }
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

  private async fetchUpstream<T = UpstreamScheduleResponse>(
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
        return mapDialHttpStatus(
          response.status,
          context,
          this.logger,
          errorBody,
        );
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
        /*
         * Completion enrichment runs inside the cache wrapper, so a cached
         * page pays no runs calls; checks fire in parallel and only for the
         * page's candidate items (one-time schedules with no next run).
         */
        const mappedTasks = items.map(fromUpstreamSchedule);
        const completions = await Promise.all(
          mappedTasks.map((task) => this.resolveIsCompleted(task, accessToken)),
        );
        const enrichedItems = mappedTasks.map((task, index) => ({
          ...task,
          isCompleted: completions[index],
        }));
        return { items: enrichedItems, ...pagination };
      },
    });
  }

  async createScheduledTask(
    userSub: string,
    accessToken: string,
    body: CreateScheduledTaskBodyDto,
    bucket = '',
  ): Promise<ScheduledTaskDto> {
    await this.validateConfiguration(body, accessToken, bucket);
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
    const task = fromUpstreamSchedule(result);
    return {
      ...task,
      isCompleted: await this.resolveIsCompleted(task, accessToken),
    };
  }

  async listScheduledTaskRuns(
    accessToken: string,
    scheduleId: string,
    query: ListScheduledTaskRunsQueryDto = {},
  ): Promise<ListScheduledTaskRunsResponseDto> {
    const result = await this.fetchUpstream<
      UpstreamScheduleResponse & {
        results?: UpstreamScheduleRun[];
        count?: number;
        limit?: number;
        offset?: number;
        next?: string | null;
        previous?: string | null;
      }
    >(
      this.buildRunsUrl(scheduleId, query),
      'GET',
      accessToken,
      `list scheduled task runs "${scheduleId}"`,
    );
    const runs = result.results ?? [];
    return {
      items: runs.map(fromUpstreamRun),
      count: result.count,
      limit: result.limit,
      offset: result.offset,
      next: result.next,
      previous: result.previous,
    };
  }

  async updateScheduledTask(
    userSub: string,
    accessToken: string,
    scheduleId: string,
    body: UpdateScheduledTaskBodyDto,
    bucket = '',
  ): Promise<ScheduledTaskDto> {
    const serviceId = this.getSchedulerServiceId();
    const saved = await this.getScheduledTask(accessToken, scheduleId);
    const effectiveBody = {
      ...body,
      skillUrl: body.skillUrl === undefined ? saved.skillUrl : body.skillUrl,
    };
    await this.validateConfiguration(effectiveBody, accessToken, bucket);
    const payload = toUpstreamSchedulePayload(
      effectiveBody,
      this.dialClient.baseUrl,
      this.dialClient.dialApiVersion,
      serviceId,
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

  private async validateConfiguration(
    body: CreateScheduledTaskBodyDto,
    accessToken: string,
    bucket: string,
  ): Promise<void> {
    if (!body.prompt.trim() && !body.skillUrl) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: ScheduledTaskErrorCode.InstructionsOrSkillRequired,
        field: 'prompt',
        message: 'Choose a skill or write instructions.',
      });
    }
    if (!body.skillUrl) return;

    const unavailable = {
      code: ScheduledTaskErrorCode.DeploymentUnavailable,
      field: 'model',
      message: 'Selected model is unavailable.',
    };
    let deployment;
    try {
      deployment = await this.deploymentsService.resolveDeploymentItem(
        body.model,
        accessToken,
        bucket,
      );
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw new ForbiddenException({
          ...unavailable,
          statusCode: 403,
          error: 'Forbidden',
        });
      }
      if (!(error instanceof NotFoundException)) throw error;
    }
    if (!deployment) {
      throw new NotFoundException({
        ...unavailable,
        statusCode: 404,
        error: 'Not Found',
      });
    }
    if (deployment.features?.skillsSupported !== true) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: ScheduledTaskErrorCode.SkillUnsupported,
        field: 'skillUrl',
        message:
          'Selected model does not support skills. Remove the skill or select different model to proceed.',
      });
    }
  }

  /*
   * The upstream pause/resume action's own response body is not confirmed to
   * contain the updated schedule (see design.md "Decision 2" for
   * add-scheduled-task-active-toggle) — a follow-up GET is used instead of
   * trusting the action response's shape. If that follow-up GET fails after
   * the action itself already succeeded, per design.md "Decision 5" the
   * mutation is NOT rolled back: the caller gets isActive reflecting the
   * action just taken, with the rest of the last-known fields, rather than
   * an error that would incorrectly suggest the action didn't happen.
   */
  private async performScheduleAction(
    userSub: string,
    accessToken: string,
    scheduleId: string,
    action: ScheduleAction,
  ): Promise<ScheduledTaskDto> {
    await this.fetchUpstream(
      this.buildScheduleActionUrl(scheduleId, action),
      'POST',
      accessToken,
      `${action} scheduled task "${scheduleId}"`,
    );

    const requestedIsActive = action === ScheduleAction.Resume;
    let refreshed: ScheduledTaskDto;
    try {
      refreshed = await this.getScheduledTask(accessToken, scheduleId);
    } catch (err) {
      this.logger.warn(
        `Failed to refresh scheduled task "${scheduleId}" after ${action}; ` +
          'returning the requested isActive without a recalculated nextRunTime.',
        err instanceof Error ? err.stack : undefined,
      );
      refreshed = { id: scheduleId } as ScheduledTaskDto;
    }

    await this.invalidateListCache(userSub);
    return { ...refreshed, isActive: requestedIsActive };
  }

  async pauseScheduledTask(
    userSub: string,
    accessToken: string,
    scheduleId: string,
  ): Promise<ScheduledTaskDto> {
    return this.performScheduleAction(
      userSub,
      accessToken,
      scheduleId,
      ScheduleAction.Pause,
    );
  }

  async resumeScheduledTask(
    userSub: string,
    accessToken: string,
    scheduleId: string,
  ): Promise<ScheduledTaskDto> {
    return this.performScheduleAction(
      userSub,
      accessToken,
      scheduleId,
      ScheduleAction.Resume,
    );
  }

  async deleteScheduledTask(
    userSub: string,
    accessToken: string,
    scheduleId: string,
  ): Promise<void> {
    await this.fetchUpstream(
      this.buildSchedulesUrl(scheduleId),
      'DELETE',
      accessToken,
      `delete scheduled task "${scheduleId}"`,
      undefined,
      false,
    );

    await this.invalidateListCache(userSub);
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
