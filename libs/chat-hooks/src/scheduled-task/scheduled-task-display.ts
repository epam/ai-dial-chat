import {
  ScheduledTaskErrorCode,
  ScheduledTaskRunDtoStatusEnum,
  type ConversationListItemDto,
  type ScheduledTaskDto,
  type ScheduledTaskRunDto,
} from '@epam/ai-dial-chat-api-client';
import {
  instantToZonedDateTime,
  isAbsoluteInstant,
  ScheduledTaskRunStatus,
  type ScheduledTaskItem,
  type ScheduledTaskRunItem,
} from '@epam/ai-dial-scheduled-tasks';
import type { ApiErrorDetails } from '../api-error/api-error';
import { isSameTimezone } from '../shared/timezones';
import {
  describeScheduledTaskTrigger,
  ScheduledTaskTriggerDescriptionKind as Kind,
} from './scheduled-task-description';
import {
  formatScheduledTaskClockTime,
  formatScheduledTaskRunDate,
  formatScheduledTaskRunTime,
  formatScheduledTaskWeekdays,
  formatZonedDateTime,
  SCHEDULED_TASK_WALL_DATE_TIME_PATTERN,
} from './scheduled-task-time-format';

/** Host-translated wording for each schedule shape; every argument is already locale-formatted. */
export interface ScheduledTaskScheduleLabels {
  /** A one-time run, e.g. "Once on {date}". */
  onceAt: (date: string) => string;
  /** A run every `count` minutes. */
  everyNMinutes: (count: number) => string;
  /** An hourly run at `minute` past the hour. */
  hourlyAt: (minute: string) => string;
  /** A daily run at `time`, a locale-formatted clock time such as `9:00 AM` or `09:00`. */
  dailyAt: (time: string) => string;
  /** A weekly run on `day` — one weekday name, or several joined as a locale list — at `time`. */
  weeklyAt: (day: string, time: string) => string;
  /** A monthly run on day-of-month `day` at `time`. */
  monthlyAt: (day: string, time: string) => string;
  /** Label for a trigger that cannot be read. */
  invalid: string;
  /** Label for a recurring trigger no other shape describes. */
  recurringFallback: string;
  /** Appends the task's zone to a schedule label, e.g. "Daily at 09:00 (Asia/Tokyo)". Omit to never show the zone. */
  withTimezone?: (label: string, timezone: string) => string;
}

/** Host-translated duration units for a run. */
export interface ScheduledTaskRunDurationLabels {
  /** `count` hours, e.g. "1h". */
  hours: (count: number) => string;
  /** `count` minutes, e.g. "2m". */
  minutes: (count: number) => string;
  /** `count` seconds, e.g. "3s". */
  seconds: (count: number) => string;
  /** Wraps the space-joined units, e.g. "(1h 2m 3s)". */
  suffix: (duration: string) => string;
}

/** Host-translated wording for a run's start time. */
export interface ScheduledTaskRunTimestampLabels {
  /** A run that started today at the short time `time`. */
  todayAt: (time: string) => string;
  /** A run that started on the short date `date` at `time`. */
  dateAt: (date: string, time: string) => string;
}

/** Locale and viewer zone used to format a schedule label. */
export interface ScheduledTaskScheduleLabelOptions {
  /** BCP 47 locale for dates and weekday names. Defaults to the runtime default. */
  locale?: string;
  /** The viewer's IANA zone; a task in a different zone gets its zone appended to the label. Defaults to the browser's resolved zone. */
  browserTimezone?: string;
  /** Appends the task's zone even when it equals the viewer's zone. Needs `labels.withTimezone`. Defaults to `false`. */
  alwaysShowTimezone?: boolean;
}

/** Inputs for formatting a run's start time. */
export interface ScheduledTaskRunTimestampOptions {
  /** Duration units; when supplied, a present duration is appended. */
  durationLabels?: ScheduledTaskRunDurationLabels;
  /** BCP 47 locale for the date and time. Defaults to the runtime default. */
  locale?: string;
  /** Reference "now" for the same-day check. Defaults to the current time. */
  now?: Date;
}

/** Inputs for mapping a run DTO to a run item. */
export interface ScheduledTaskRunItemOptions {
  /** Wording for the run's start time. */
  timestampLabels: ScheduledTaskRunTimestampLabels;
  /** Wording for the run's duration. */
  durationLabels: ScheduledTaskRunDurationLabels;
  /** Loaded conversation-list items used to resolve `isUnread`. */
  conversations: ConversationListItemDto[];
  /** Whether a conversation-list id and a run's `conversationId` name the same conversation. */
  conversationIdsMatch: (left: string, right: string) => boolean;
  /** BCP 47 locale for the start time. Defaults to the runtime default. */
  locale?: string;
  /** Reference "now" for the same-day check. Defaults to the current time. */
  now?: Date;
}

/** Pre-translated messages {@link selectScheduledTaskErrorMessage} chooses between. */
export interface ScheduledTaskErrorMessages {
  /** Shown when the scheduler's application consent was revoked. */
  adminConsentRequired: string;
  /** Shown when the scheduler gave no reason. */
  fallback: string;
}

/** Which message a failed scheduled-task delete should show. */
export enum ScheduledTaskDeleteErrorKind {
  /** The task no longer exists or is already deleted (404/409). */
  NotFound = 'notFound',
  /** The scheduler failed and the delete can be retried (502). */
  Retryable = 'retryable',
  /** Any other failure. */
  Generic = 'generic',
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Formats a stored trigger datetime — a zone-local wall time, or an absolute
 * instant written by an older client — as the wall time it shows in the
 * task's own zone. Returns the raw value when it is not a date.
 */
export const formatScheduledTaskTriggerTime = (
  value: string,
  timezone: string,
  locale?: string,
): string => {
  const wallTime = isAbsoluteInstant(value)
    ? instantToZonedDateTime(value, timezone)
    : value.slice(0, 16);
  if (!wallTime || !SCHEDULED_TASK_WALL_DATE_TIME_PATTERN.test(wallTime))
    return value;
  return formatZonedDateTime(wallTime, locale);
};

/**
 * Returns the schedule label for a task's trigger in the task's own zone: the
 * stored wall time is shown as is, and the zone is appended when it differs
 * from the viewer's.
 */
export const formatScheduledTaskScheduleLabel = (
  task: ScheduledTaskDto,
  labels: ScheduledTaskScheduleLabels,
  {
    locale,
    browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
    alwaysShowTimezone = false,
  }: ScheduledTaskScheduleLabelOptions = {},
): string => {
  const timezone = task.timezone || 'UTC';
  const description = describeScheduledTaskTrigger(task.trigger, { timezone });
  const time = description.time ?? '';
  const clockTime = formatScheduledTaskClockTime(time, locale);
  const withZone = (label: string): string =>
    labels.withTimezone &&
    (alwaysShowTimezone || !isSameTimezone(timezone, browserTimezone))
      ? labels.withTimezone(label, timezone)
      : label;
  switch (description.kind) {
    case Kind.OneTime:
      return withZone(
        labels.onceAt(formatZonedDateTime(description.dateTime ?? '', locale)),
      );
    case Kind.EveryNMinutes:
      return labels.everyNMinutes(description.intervalMinutes ?? 0);
    case Kind.Hourly:
      return withZone(labels.hourlyAt(time));
    case Kind.Daily:
      return withZone(labels.dailyAt(clockTime));
    case Kind.Weekly:
      return withZone(
        labels.weeklyAt(
          formatScheduledTaskWeekdays(
            description.daysOfWeek ?? [description.dayOfWeek ?? ''],
            locale,
          ),
          clockTime,
        ),
      );
    case Kind.Monthly:
      return withZone(
        labels.monthlyAt(description.dayOfMonth ?? '', clockTime),
      );
    case Kind.Invalid:
      return labels.invalid;
    default:
      return labels.recurringFallback;
  }
};

/** Maps a scheduled-task DTO to the scheduled-tasks lib's card item. */
export const toScheduledTaskItem = (
  task: ScheduledTaskDto,
  labels: ScheduledTaskScheduleLabels,
  options?: ScheduledTaskScheduleLabelOptions,
): ScheduledTaskItem => ({
  id: task.id,
  displayName: task.displayName,
  descriptionPreview: task.description,
  scheduleLabel: formatScheduledTaskScheduleLabel(task, labels, options),
  isActive: task.isActive,
  isCompleted: task.isCompleted,
});

/** Maps scheduled-task DTOs to card items, preserving order. */
export const toScheduledTaskItems = (
  tasks: ScheduledTaskDto[],
  labels: ScheduledTaskScheduleLabels,
  options?: ScheduledTaskScheduleLabelOptions,
): ScheduledTaskItem[] =>
  tasks.map((task) => toScheduledTaskItem(task, labels, options));

/** Returns a run's duration as non-zero hour/minute/second units, or `undefined` when it is absent. */
export const formatScheduledTaskRunDuration = (
  durationSeconds: number | null | undefined,
  labels: ScheduledTaskRunDurationLabels,
): string | undefined => {
  if (durationSeconds == null) return undefined;

  const units: [number, (count: number) => string][] = [
    [Math.floor(durationSeconds / SECONDS_PER_HOUR), labels.hours],
    [
      Math.floor((durationSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
      labels.minutes,
    ],
    [durationSeconds % SECONDS_PER_MINUTE, labels.seconds],
  ];
  const parts = units
    .filter(([count]) => count > 0)
    .map(([count, format]) => format(count));

  return labels.suffix(parts.length ? parts.join(' ') : labels.seconds(0));
};

/** Returns a run's start time as "today at" or "date at", followed by its duration when one is given. */
export const formatScheduledTaskRunTimestamp = (
  startTime: string,
  durationSeconds: number | null | undefined,
  labels: ScheduledTaskRunTimestampLabels,
  {
    durationLabels,
    locale,
    now = new Date(),
  }: ScheduledTaskRunTimestampOptions = {},
): string => {
  const start = new Date(startTime);
  const time = formatScheduledTaskRunTime(start, locale);
  const dateLabel = isSameDay(start, now)
    ? labels.todayAt(time)
    : labels.dateAt(formatScheduledTaskRunDate(start, locale), time);

  const durationLabel = durationLabels
    ? formatScheduledTaskRunDuration(durationSeconds, durationLabels)
    : undefined;
  return durationLabel ? `${dateLabel} ${durationLabel}` : dateLabel;
};

/* A switch, not a module-level map, so importing this module never reads the scheduled-tasks enum. */
const toRunStatus = (status: string): ScheduledTaskRunStatus => {
  switch (status) {
    case ScheduledTaskRunDtoStatusEnum.Success:
      return ScheduledTaskRunStatus.Success;
    case ScheduledTaskRunDtoStatusEnum.Error:
      return ScheduledTaskRunStatus.Error;
    case ScheduledTaskRunDtoStatusEnum.InProgress:
      return ScheduledTaskRunStatus.InProgress;
    default:
      return ScheduledTaskRunStatus.Missed;
  }
};

/** Maps a scheduled-task run DTO to the scheduled-tasks lib's history item. */
export const toScheduledTaskRunItem = (
  run: ScheduledTaskRunDto,
  {
    timestampLabels,
    durationLabels,
    conversations,
    conversationIdsMatch,
    locale,
    now,
  }: ScheduledTaskRunItemOptions,
): ScheduledTaskRunItem => {
  const { conversationId } = run;
  const conversation = conversationId
    ? conversations.find((item) =>
        conversationIdsMatch(item.id, conversationId),
      )
    : undefined;

  return {
    id: run.id,
    status: toRunStatus(run.status),
    timestampLabel: formatScheduledTaskRunTimestamp(
      run.startTime,
      undefined,
      timestampLabels,
      { locale, now },
    ),
    durationLabel: formatScheduledTaskRunDuration(
      run.durationSeconds,
      durationLabels,
    ),
    conversationId,
    isUnread: conversation?.isUnread === true,
    errorText: run.errorText,
  };
};

/** Maps scheduled-task run DTOs to history items, preserving order. */
export const toScheduledTaskRunItems = (
  runs: ScheduledTaskRunDto[],
  options: ScheduledTaskRunItemOptions,
): ScheduledTaskRunItem[] =>
  runs.map((run) => toScheduledTaskRunItem(run, options));

/** Returns which message a failed delete with HTTP `status` should show. */
export const classifyScheduledTaskDeleteError = (
  status: number | undefined,
): ScheduledTaskDeleteErrorKind => {
  if (status === 404 || status === 409)
    return ScheduledTaskDeleteErrorKind.NotFound;
  if (status === 502) return ScheduledTaskDeleteErrorKind.Retryable;
  return ScheduledTaskDeleteErrorKind.Generic;
};

/** Returns the admin-consent message, else the scheduler's own trimmed reason, else the fallback. */
export const selectScheduledTaskErrorMessage = (
  details: Pick<ApiErrorDetails, 'code' | 'upstreamMessage'>,
  { adminConsentRequired, fallback }: ScheduledTaskErrorMessages,
): string => {
  if (details.code === ScheduledTaskErrorCode.ScheduledTaskAdminConsentRequired)
    return adminConsentRequired;
  return details.upstreamMessage?.trim() || fallback;
};
