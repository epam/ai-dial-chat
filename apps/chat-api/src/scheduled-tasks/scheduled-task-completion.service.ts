import { Injectable, Logger } from '@nestjs/common';
import { ScheduledTaskRunStatus } from './dto/scheduled-task-run.dto';
import {
  ScheduleTriggerType,
  type ScheduledTaskDto,
} from './dto/scheduled-task.dto';
import {
  fromUpstreamRun,
  type UpstreamScheduleResponse,
  type UpstreamScheduleRun,
} from './scheduled-tasks.mapper';
import { SchedulerUpstreamClient } from './scheduler-upstream.client';

/*
 * Shared parse-and-compare tail of the two terminal-state predicates below:
 * whether an optional ISO date string resolves to a moment that is not in
 * the future. An absent or unparseable date never counts as passed — the
 * list shape that omits the nested `trigger` degrades to not-terminal.
 * Uses this server's clock, keeping skew/timezone handling in one place.
 */
export const isPastDate = (date?: string): boolean => {
  const dateMs = date ? new Date(date).getTime() : NaN;
  return !Number.isNaN(dateMs) && dateMs <= Date.now();
};

/*
 * Completion candidate gate, first two clauses of the derivation for
 * one-time (date-trigger) schedules: nothing left to run. The gate is an OR
 * so it is path-independent — list responses that omit the nested `trigger`
 * rely on `nextRunTime` alone; responses that carry `trigger` have both arms
 * and they agree wherever both are computable.
 */
export const isCompletionCandidate = (task: ScheduledTaskDto): boolean => {
  if (task.triggerType !== ScheduleTriggerType.Date) {
    return false;
  }
  if (task.nextRunTime == null) {
    return true;
  }
  return isPastDate(task.trigger?.date);
};

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
export const isExpiredRecurring = (task: ScheduledTaskDto): boolean => {
  if (task.triggerType !== ScheduleTriggerType.Cron) {
    return false;
  }
  if (task.nextRunTime != null) {
    return false;
  }
  return isPastDate(task.trigger?.cron?.endDate);
};

/**
 * Derives `ScheduledTaskDto.isCompleted`, which DIAL Scheduler does not
 * report: from the schedule fields alone for recurring schedules, plus the
 * newest run for one-time schedules.
 */
@Injectable()
export class ScheduledTaskCompletionService {
  private readonly logger = new Logger(ScheduledTaskCompletionService.name);

  constructor(private readonly upstream: SchedulerUpstreamClient) {}

  /** Newest run of a schedule (the runs endpoint's documented order is newest-first). */
  private async fetchNewestRun(
    scheduleId: string,
    accessToken: string,
  ): Promise<UpstreamScheduleRun | undefined> {
    const result = await this.upstream.request<
      UpstreamScheduleResponse & { results?: UpstreamScheduleRun[] }
    >(
      this.upstream.runsUrl(scheduleId, { limit: 1, offset: 0 }),
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
  async resolveIsCompleted(
    task: ScheduledTaskDto,
    accessToken: string,
  ): Promise<boolean | undefined> {
    if (isExpiredRecurring(task)) {
      return true;
    }
    if (!isCompletionCandidate(task)) {
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
}
