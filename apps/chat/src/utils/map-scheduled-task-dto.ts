import type { ScheduledTaskDto } from '@epam/ai-dial-chat-api-client';
import {
  describeScheduledTaskTrigger,
  ScheduledTaskTriggerDescriptionKind as Kind,
} from '@epam/ai-dial-chat-hooks/scheduled-tasks';
import type { ScheduledTaskItem } from '@epam/ai-dial-scheduled-tasks';
import type { TFunction } from 'i18next';
import { ScheduledTasksI18nKeys as Keys } from '../constants/translation-keys';

/** Localizes the shared trigger descriptor in the browser's display timezone. */
export const buildScheduleLabel = (
  task: ScheduledTaskDto,
  t: TFunction,
  locale?: string,
): string => {
  const description = describeScheduledTaskTrigger(task.trigger, {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const { time } = description;
  switch (description.kind) {
    case Kind.OneTime:
      return t(Keys.CardScheduleOnceAt, {
        date: new Intl.DateTimeFormat(locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(description.date),
      });
    case Kind.EveryNMinutes:
      return t(Keys.CardScheduleEveryNMinutes, {
        count: description.intervalMinutes,
      });
    case Kind.Hourly:
      return t(Keys.CardScheduleHourlyAt, { minute: time });
    case Kind.Daily:
      return t(Keys.CardScheduleDailyAt, { time });
    case Kind.Weekly: {
      const date = new Date(
        Date.UTC(2023, 0, 2 + Number(description.dayOfWeek)),
      );
      const day = new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        timeZone: 'UTC',
      }).format(date);
      return t(Keys.CardScheduleWeeklyAt, { day, time });
    }
    case Kind.Monthly:
      return t(Keys.CardScheduleMonthlyAt, {
        day: description.dayOfMonth,
        time,
      });
    case Kind.Invalid:
      return t(Keys.EditInvalidScheduleLabel);
    default:
      return t(Keys.CardScheduleRecurringFallback);
  }
};

/**
 * Maps a `GET /api/v1/scheduled-tasks` DTO to the lib-facing `ScheduledTaskItem`.
 * `description` maps 1:1 to `descriptionPreview` (undefined when absent)
 * with no truncation — the BFF's 500-char cap bounds the value, and the
 * card's own line-clamp/ellipsis handles presentation-layer truncation.
 * `isActive` maps 1:1 from the DTO with no reinterpretation — derivation is
 * owned entirely by the BFF mapper.
 */
export const mapScheduledTaskDtoToItem = (
  task: ScheduledTaskDto,
  t: TFunction,
): ScheduledTaskItem => ({
  id: task.id,
  displayName: task.displayName,
  descriptionPreview: task.description,
  scheduleLabel: buildScheduleLabel(task, t),
  isActive: task.isActive,
});

/** Maps a list of `ScheduledTaskDto` to `ScheduledTaskItem[]`, preserving order. */
export const mapScheduledTaskDtosToItems = (
  tasks: ScheduledTaskDto[],
  t: TFunction,
): ScheduledTaskItem[] =>
  tasks.map((task) => mapScheduledTaskDtoToItem(task, t));

/**
 * Maps a failed delete request's HTTP status to the localized error message
 * key shown in the delete confirmation dialog: not-found/already-deleted
 * (404/409), a retryable scheduler failure (502), or a generic fallback.
 */
export const getDeleteErrorMessageKey = (status: number | undefined): Keys => {
  if (status === 404 || status === 409) {
    return Keys.DetailDeleteNotFoundError;
  }
  if (status === 502) {
    return Keys.DetailDeleteRetryableError;
  }
  return Keys.DetailDeleteGenericError;
};
