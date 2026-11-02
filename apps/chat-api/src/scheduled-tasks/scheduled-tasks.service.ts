import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { withCachedDialRequest } from '../dial/cached-dial-request.helper';
import { DialClientService } from '../dial/dial-client.service';
import type { CreateScheduledTaskBodyDto } from './dto/create-scheduled-task.dto';
import type { ListScheduledTaskRunsQueryDto } from './dto/list-scheduled-task-runs-query.dto';
import type { ListScheduledTaskRunsResponseDto } from './dto/list-scheduled-task-runs.dto';
import type { ListScheduledTasksQueryDto } from './dto/list-scheduled-tasks-query.dto';
import type { ListScheduledTasksResponseDto } from './dto/list-scheduled-tasks.dto';
import type { ScheduledTaskRunDto } from './dto/scheduled-task-run.dto';
import type { ScheduledTaskDto } from './dto/scheduled-task.dto';
import type { UpdateScheduledTaskBodyDto } from './dto/update-scheduled-task.dto';
import { ScheduledTaskCompletionService } from './scheduled-task-completion.service';
import { ScheduledTaskPreconditionsService } from './scheduled-task-preconditions.service';
import { ScheduledTaskRunsService } from './scheduled-task-runs.service';
import {
  LIST_CACHE_TTL_MS,
  ScheduledTasksListCacheService,
} from './scheduled-tasks-list-cache.service';
import {
  extractScheduleListItems,
  extractScheduleListPagination,
  fromUpstreamRun,
  fromUpstreamSchedule,
  toUpstreamSchedulePayload,
  type UpstreamScheduleRun,
} from './scheduled-tasks.mapper';
import { SchedulerUpstreamClient } from './scheduler-upstream.client';
import { ScheduleAction } from './types/schedule-action.enum';

/**
 * Scheduled-tasks operations proxied to DIAL Scheduler. Owns the order of
 * each operation (consent, configuration check, upstream call, list cache
 * invalidation) and delegates transport, caching, completion and run reads
 * to its collaborators.
 */
@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly upstream: SchedulerUpstreamClient,
    private readonly listCache: ScheduledTasksListCacheService,
    private readonly completion: ScheduledTaskCompletionService,
    private readonly runs: ScheduledTaskRunsService,
    private readonly preconditions: ScheduledTaskPreconditionsService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async listScheduledTasks(
    userSub: string,
    accessToken: string,
    query: ListScheduledTasksQueryDto = {},
  ): Promise<ListScheduledTasksResponseDto> {
    return withCachedDialRequest({
      cacheManager: this.cacheManager,
      cacheKey: await this.listCache.buildKey(userSub, query),
      ttlMs: LIST_CACHE_TTL_MS,
      context: 'list scheduled tasks',
      logger: this.logger,
      fetch: async () => {
        const result = await this.upstream.request(
          this.upstream.schedulesListUrl(query),
          'GET',
          accessToken,
          'list scheduled tasks',
        );
        const items = extractScheduleListItems(result);
        const pagination = extractScheduleListPagination(result);
        this.logger.debug(
          `list scheduled tasks: resolved ${items.length} item(s) (upstream shape was ${
            Array.isArray(result)
              ? 'array'
              : `object{${Object.keys(result).join(',')}}`
          })`,
        );
        /*
         * Completion enrichment runs inside the cache wrapper, so a cached
         * page pays no runs calls. Checks fire in parallel and only for the
         * page's candidate items (one-time schedules with no next run) —
         * one `runs?limit=1` call per candidate, so a cache miss costs up to
         * `limit` concurrent upstream calls (page size 20 in this app, hard
         * cap 100 via the DTO validation), at most once per 30s cache window
         * per query variant. No concurrency cap by design: the burst is
         * page-bounded, cron schedules never qualify, and a failed check
         * degrades per-item instead of failing the list. When DIAL Scheduler
         * gains an authoritative state field (or a batch runs endpoint),
         * replace this fan-out here in one place.
         */
        const mappedTasks = items.map(fromUpstreamSchedule);
        const completions = await Promise.all(
          mappedTasks.map((task) =>
            this.completion.resolveIsCompleted(task, accessToken),
          ),
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
    await this.preconditions.assertSchedulerConsent(accessToken);
    await this.preconditions.validateConfiguration(body, accessToken, bucket);
    const payload = toUpstreamSchedulePayload(
      body,
      this.dialClient.baseUrl,
      this.dialClient.dialApiVersion,
      this.upstream.getSchedulerServiceId(),
    );

    const result = await this.upstream.request(
      this.upstream.schedulesUrl(),
      'POST',
      accessToken,
      'create scheduled task',
      payload,
    );

    await this.listCache.invalidate(userSub);
    return fromUpstreamSchedule(result);
  }

  async getScheduledTask(
    accessToken: string,
    scheduleId: string,
  ): Promise<ScheduledTaskDto> {
    const result = await this.upstream.request(
      this.upstream.schedulesUrl(scheduleId),
      'GET',
      accessToken,
      `get scheduled task "${scheduleId}"`,
    );
    const task = fromUpstreamSchedule(result);
    return {
      ...task,
      isCompleted: await this.completion.resolveIsCompleted(task, accessToken),
    };
  }

  async listScheduledTaskRuns(
    accessToken: string,
    scheduleId: string,
    query: ListScheduledTaskRunsQueryDto = {},
  ): Promise<ListScheduledTaskRunsResponseDto> {
    return this.runs.listRuns(accessToken, scheduleId, query);
  }

  /** Reads one run through the caller-scoped Scheduler route without caching it. */
  async getScheduledTaskRun(
    accessToken: string,
    scheduleId: string,
    runId: string,
  ): Promise<ScheduledTaskRunDto> {
    return this.runs.getRun(accessToken, scheduleId, runId);
  }

  /** Starts a saved schedule without changing its trigger or cached list entries. */
  async startScheduledTask(
    accessToken: string,
    scheduleId: string,
  ): Promise<ScheduledTaskRunDto> {
    await this.preconditions.assertSchedulerConsent(accessToken);
    const result = await this.upstream.request<UpstreamScheduleRun>(
      this.upstream.scheduleActionUrl(scheduleId, ScheduleAction.Run),
      'POST',
      accessToken,
      `start scheduled task "${scheduleId}"`,
    );
    return fromUpstreamRun(result);
  }

  async updateScheduledTask(
    userSub: string,
    accessToken: string,
    scheduleId: string,
    body: UpdateScheduledTaskBodyDto,
    bucket = '',
  ): Promise<ScheduledTaskDto> {
    const serviceId = this.upstream.getSchedulerServiceId();
    await this.preconditions.assertSchedulerConsent(accessToken);
    const saved = await this.getScheduledTask(accessToken, scheduleId);
    const effectiveBody = {
      ...body,
      skillUrls:
        body.skillUrls === undefined ? saved.skillUrls : body.skillUrls,
    };
    await this.preconditions.validateConfiguration(
      effectiveBody,
      accessToken,
      bucket,
    );
    const payload = toUpstreamSchedulePayload(
      effectiveBody,
      this.dialClient.baseUrl,
      this.dialClient.dialApiVersion,
      serviceId,
    );

    const result = await this.upstream.request(
      this.upstream.schedulesUrl(scheduleId),
      'PUT',
      accessToken,
      `update scheduled task "${scheduleId}"`,
      payload,
    );

    await this.listCache.invalidate(userSub);
    return fromUpstreamSchedule(result);
  }

  /*
   * The upstream pause/resume action's own response body is not confirmed to
   * contain the updated schedule (see `openspec/changes/archive/2026-08-11-add-scheduled-task-active-toggle/design.md` "Decision 2" for
   * add-scheduled-task-active-toggle) — a follow-up GET is used instead of
   * trusting the action response's shape. If that follow-up GET fails after
   * the action itself already succeeded, per `openspec/changes/archive/2026-08-11-add-scheduled-task-active-toggle/design.md` "Decision 5" the
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
    await this.upstream.request(
      this.upstream.scheduleActionUrl(scheduleId, action),
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

    await this.listCache.invalidate(userSub);
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
    await this.preconditions.assertSchedulerConsent(accessToken);
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
    await this.upstream.request(
      this.upstream.schedulesUrl(scheduleId),
      'DELETE',
      accessToken,
      `delete scheduled task "${scheduleId}"`,
      undefined,
      false,
    );

    await this.listCache.invalidate(userSub);
  }
}
