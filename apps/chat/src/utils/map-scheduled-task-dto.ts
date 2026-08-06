import {
  ScheduledTaskSectionKey,
  type ScheduledTaskItem,
} from '@epam/ai-dial-scheduled-tasks';
import type { ScheduledTaskDto } from '@epam/chat-api-client';
import type { TFunction } from 'i18next';
import { ScheduledTasksI18nKeys } from '../constants/translation-keys';
import { apSchedulerDayToJsDay, jsDayToApSchedulerDay } from './cron-weekday';

const padTwoDigits = (value: string): string => value.padStart(2, '0');

const EVERY_N_MINUTES_PATTERN = /^\*\/(\d+)$/;

/**
 * Formats a cron trigger with no fixed `hour` field (i.e. it fires every
 * hour or every N minutes) instead of collapsing it into the generic
 * recurring fallback.
 */
const formatSubHourlyScheduleLabel = (
  minute: string | undefined,
  t: TFunction,
): string => {
  const intervalMatch = minute?.match(EVERY_N_MINUTES_PATTERN);
  if (intervalMatch) {
    return t(ScheduledTasksI18nKeys.CardScheduleEveryNMinutes, {
      count: Number(intervalMatch[1]),
    });
  }
  if (minute && /^\d+$/.test(minute)) {
    return t(ScheduledTasksI18nKeys.CardScheduleHourlyAt, {
      minute: padTwoDigits(minute),
    });
  }
  return t(ScheduledTasksI18nKeys.CardScheduleRecurringFallback);
};

/**
 * Converts stored UTC `hour`/`minute`/`day_of_week`/`day` cron fields back to
 * the browser's local time, mirroring `buildCronFields`'s local-to-UTC
 * conversion (apps/chat/src/utils/scheduled-task-trigger.ts) in reverse, so
 * the displayed schedule always matches what will actually execute.
 */
const convertCronFieldsToLocal = (
  fields: Record<string, string>,
): Record<string, string> => {
  const reference = new Date();
  reference.setUTCHours(Number(fields.hour), Number(fields.minute), 0, 0);

  /* Only numeric APScheduler indices/day-of-month are convertible; legacy or
   * malformed values (e.g. a raw weekday name) are left untouched. */
  const hasDayOfWeek = !!fields.day_of_week && /^\d+$/.test(fields.day_of_week);
  const hasDayOfMonth = !!fields.day && /^\d+$/.test(fields.day);

  if (hasDayOfWeek) {
    const targetUtcDay = apSchedulerDayToJsDay(Number(fields.day_of_week));
    const diff = (targetUtcDay - reference.getUTCDay() + 7) % 7;
    reference.setUTCDate(reference.getUTCDate() + diff);
  } else if (hasDayOfMonth) {
    reference.setUTCDate(Number(fields.day));
  }

  const localFields: Record<string, string> = {
    ...fields,
    hour: String(reference.getHours()),
    minute: String(reference.getMinutes()),
  };
  if (hasDayOfWeek) {
    localFields.day_of_week = String(jsDayToApSchedulerDay(reference.getDay()));
  }
  if (hasDayOfMonth) {
    localFields.day = String(reference.getDate());
  }

  return localFields;
};

const formatCronScheduleLabel = (
  fields: Record<string, string> | undefined,
  t: TFunction,
): string => {
  if (!fields || (fields.hour && fields.hour !== '*' && !fields.minute)) {
    return t(ScheduledTasksI18nKeys.CardScheduleRecurringFallback);
  }
  if (!fields.hour || fields.hour === '*') {
    return formatSubHourlyScheduleLabel(fields.minute, t);
  }
  const localFields = convertCronFieldsToLocal(fields);
  const time = `${padTwoDigits(localFields.hour)}:${padTwoDigits(localFields.minute)}`;

  if (localFields.day_of_week) {
    return t(ScheduledTasksI18nKeys.CardScheduleWeeklyAt, {
      day: localFields.day_of_week,
      time,
    });
  }
  if (localFields.day) {
    return t(ScheduledTasksI18nKeys.CardScheduleMonthlyAt, {
      day: localFields.day,
      time,
    });
  }
  return t(ScheduledTasksI18nKeys.CardScheduleDailyAt, { time });
};

const formatDateScheduleLabel = (date: string, t: TFunction): string => {
  let formattedDate = date;
  try {
    formattedDate = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(date));
  } catch {
    // Keep the raw ISO string if the date can't be formatted.
  }
  return t(ScheduledTasksI18nKeys.CardScheduleOnceAt, { date: formattedDate });
};

const buildScheduleLabel = (task: ScheduledTaskDto, t: TFunction): string => {
  if (task.trigger.date) {
    return formatDateScheduleLabel(task.trigger.date, t);
  }
  return formatCronScheduleLabel(
    task.trigger.cron?.fields as Record<string, string> | undefined,
    t,
  );
};

/**
 * Resolves the card grid section for a task from `createdBy` vs. the
 * current user's sub. Falls back to `myTasks` when `createdBy` or
 * `currentUserSub` is unavailable (e.g. older upstream responses, or a
 * caller that hasn't wired the current user), matching prior behavior.
 */
const resolveSectionKey = (
  task: ScheduledTaskDto,
  currentUserSub: string | undefined,
): ScheduledTaskSectionKey => {
  if (task.createdBy && currentUserSub && task.createdBy !== currentUserSub) {
    return ScheduledTaskSectionKey.Shared;
  }
  return ScheduledTaskSectionKey.MyTasks;
};

/**
 * Maps a `GET /api/v1/scheduled-tasks` DTO to the lib-facing `ScheduledTaskItem`.
 * `sectionKey` is `shared` when the upstream `createdBy` differs from
 * `currentUserSub`, otherwise `myTasks` (also the fallback when either value
 * is missing). `description` maps 1:1 to `descriptionPreview` (undefined when
 * absent) with no truncation — the BFF's 500-char cap bounds the value, and
 * the card's own line-clamp/ellipsis handles presentation-layer truncation.
 */
export const mapScheduledTaskDtoToItem = (
  task: ScheduledTaskDto,
  t: TFunction,
  currentUserSub?: string,
): ScheduledTaskItem => ({
  id: task.id,
  displayName: task.displayName,
  descriptionPreview: task.description,
  scheduleLabel: buildScheduleLabel(task, t),
  sectionKey: resolveSectionKey(task, currentUserSub),
});

/** Maps a list of `ScheduledTaskDto` to `ScheduledTaskItem[]`, preserving order. */
export const mapScheduledTaskDtosToItems = (
  tasks: ScheduledTaskDto[],
  t: TFunction,
  currentUserSub?: string,
): ScheduledTaskItem[] =>
  tasks.map((task) => mapScheduledTaskDtoToItem(task, t, currentUserSub));
