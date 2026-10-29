import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import type { ListScheduledTaskRunsQueryDto } from './dto/list-scheduled-task-runs-query.dto';
import type { ListScheduledTaskRunsResponseDto } from './dto/list-scheduled-task-runs.dto';
import {
  type ScheduledTaskRunDto,
  ScheduledTaskRunStatus,
} from './dto/scheduled-task-run.dto';
import {
  fromUpstreamRun,
  type UpstreamScheduleResponse,
  type UpstreamScheduleRun,
} from './scheduled-tasks.mapper';
import { SchedulerUpstreamClient } from './scheduler-upstream.client';

/* Upper bound on per-run detail reads a single run-list call may fan out to. */
const RUN_ERROR_DETAIL_MAX_READS = 10;
/* A terminal run's error text is immutable; the TTL only bounds cache growth. */
const RUN_ERROR_TEXT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Reads a schedule's runs through the caller-scoped Scheduler route and
 * fills in the failed runs' error text, which the run list omits.
 */
@Injectable()
export class ScheduledTaskRunsService {
  private readonly logger = new Logger(ScheduledTaskRunsService.name);

  constructor(
    private readonly upstream: SchedulerUpstreamClient,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async listRuns(
    accessToken: string,
    scheduleId: string,
    query: ListScheduledTaskRunsQueryDto = {},
  ): Promise<ListScheduledTaskRunsResponseDto> {
    const result = await this.upstream.request<
      UpstreamScheduleResponse & {
        results?: UpstreamScheduleRun[];
        count?: number;
        limit?: number;
        offset?: number;
        next?: string | null;
        previous?: string | null;
      }
    >(
      this.upstream.runsUrl(scheduleId, query),
      'GET',
      accessToken,
      `list scheduled task runs "${scheduleId}"`,
    );
    const runs = result.results ?? [];
    return {
      items: await this.withRunErrorDetails(
        accessToken,
        scheduleId,
        runs.map(fromUpstreamRun),
      ),
      count: result.count,
      limit: result.limit,
      offset: result.offset,
      next: result.next,
      previous: result.previous,
    };
  }

  /** Reads one run through the caller-scoped Scheduler route without caching it. */
  async getRun(
    accessToken: string,
    scheduleId: string,
    runId: string,
  ): Promise<ScheduledTaskRunDto> {
    const result = await this.upstream.request<UpstreamScheduleRun>(
      this.upstream.runUrl(scheduleId, runId),
      'GET',
      accessToken,
      `get scheduled task run "${runId}" for "${scheduleId}"`,
    );
    return fromUpstreamRun(result);
  }

  /*
   * Keyed by schedule + run only: a cached value is served solely for a run
   * the caller's own upstream list call just returned, so the owner check
   * has already happened for this caller.
   */
  private runErrorTextCacheKey(scheduleId: string, runId: string): string {
    return `scheduled-tasks:run-error-text:${scheduleId}:${runId}`;
  }

  /*
   * DIAL Scheduler's run list (`RunListItem`) omits `result`, so a failed
   * run's `error_text` is only available from the per-run detail route. To
   * keep that fan-out bounded:
   * - a terminal run's error text never changes, so each resolved value
   *   (including "none", stored as '') is cached and History's background
   *   refreshes do not re-read the same runs;
   * - at most RUN_ERROR_DETAIL_MAX_READS uncached runs are re-read per list
   *   call (newest first, matching the list order); the rest stay without
   *   `errorText` until a later call picks them up.
   * A failed detail read is logged, not cached, and leaves that run without
   * `errorText` rather than failing the whole list.
   */
  private async withRunErrorDetails(
    accessToken: string,
    scheduleId: string,
    runs: ScheduledTaskRunDto[],
  ): Promise<ScheduledTaskRunDto[]> {
    const resolved = new Map<string, string>();
    const uncachedIds: string[] = [];
    await Promise.all(
      runs
        .filter(
          (run) =>
            run.status === ScheduledTaskRunStatus.Error &&
            run.errorText == null,
        )
        .map(async (run) => {
          const cached = await this.cacheManager.get<string>(
            this.runErrorTextCacheKey(scheduleId, run.id),
          );
          if (cached == null) {
            uncachedIds.push(run.id);
          } else {
            resolved.set(run.id, cached);
          }
        }),
    );

    const runOrder = new Map(runs.map((run, index) => [run.id, index]));
    const idsToRead = uncachedIds
      .sort((a, b) => (runOrder.get(a) ?? 0) - (runOrder.get(b) ?? 0))
      .slice(0, RUN_ERROR_DETAIL_MAX_READS);
    await Promise.all(
      idsToRead.map(async (runId) => {
        try {
          const detail = await this.getRun(accessToken, scheduleId, runId);
          const errorText = detail.errorText ?? '';
          resolved.set(runId, errorText);
          await this.cacheManager.set(
            this.runErrorTextCacheKey(scheduleId, runId),
            errorText,
            RUN_ERROR_TEXT_CACHE_TTL_MS,
          );
        } catch (err) {
          this.logger.warn(
            `Failed to read error details for scheduled task run "${runId}" of "${scheduleId}"`,
            err instanceof Error ? err.stack : undefined,
          );
        }
      }),
    );

    return runs.map((run) => {
      const errorText = resolved.get(run.id);
      return errorText ? { ...run, errorText } : run;
    });
  }
}
