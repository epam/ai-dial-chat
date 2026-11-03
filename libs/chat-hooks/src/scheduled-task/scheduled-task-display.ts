import {
  ScheduledTaskErrorCode,
  ScheduledTaskRunDtoStatusEnum,
  type ConversationListItemDto,
  type ScheduledTaskDto,
  type ScheduledTaskRunDto,
} from '@epam/ai-dial-chat-api-client';
import {
  ScheduledTaskRunStatus,
  type ScheduledTaskItem,
  type ScheduledTaskRunItem,
} from '@epam/ai-dial-scheduled-tasks';
import type { ApiErrorDetails } from '../api-error/api-error';
import {
  describeScheduledTaskTrigger,
  ScheduledTaskTriggerDescriptionKind as Kind,
} from './scheduled-task-description';

/** Host-translated wording for each schedule shape; every argument is already locale-formatted. */
export interface ScheduledTaskScheduleLabels {
  /** A one-time run, e.g. "Once on {date}". */
  onceAt: (date: string) => string;
  /** A run every `count` minutes. */
  everyNMinutes: (count: number) => string;
  /** An hourly run at `minute` past the hour. */
  hourlyAt: (minute: string) => string;
  /** A daily run at `time` (`HH:mm`). */
  dailyAt: (time: string) => string;
  /** A weekly run on the weekday name `day` at `time`. */
  weeklyAt: (day: string, time: string) => string;
  /** A run every `count` weeks on the weekday name `day` at `time`. */
  everyNWeeks: (count: number, day: string, time: string) => string;
  /** A monthly run on day-of-month `day` at `time`. */
  monthlyAt: (day: string, time: string) => string;
  /** Label for a trigger that cannot be read. */
  invalid: string;
  /** Label for a recurring trigger no other shape describes. */
  recurringFallback: string;
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

/** Locale and timezone used to format a schedule label. */
export interface ScheduledTaskScheduleLabelOptions {
  /** BCP 47 locale for dates and weekday names. Defaults to the runtime default. */
  locale?: string;
  /** IANA timezone the schedule is shown in. Defaults to the browser's resolved timezone. */
  timeZone?: string;
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

/* APScheduler numbers weekdays from Monday = 0, and 2023-01-02 was a Monday. */
const formatWeekday = (dayOfWeek: string | undefined, locale?: string) =>
  new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2023, 0, 2 + Number(dayOfWeek))),
  );

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Returns the schedule label for a task's trigger, shown in `timeZone`. */
export const formatScheduledTaskScheduleLabel = (
  task: ScheduledTaskDto,
  labels: ScheduledTaskScheduleLabels,
  {
    locale,
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  }: ScheduledTaskScheduleLabelOptions = {},
): string => {
  const description = describeScheduledTaskTrigger(task.trigger, { timeZone });
  const time = description.time ?? '';
  switch (description.kind) {
    case Kind.OneTime:
      return labels.onceAt(
        new Intl.DateTimeFormat(locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(description.date),
      );
    case Kind.EveryNMinutes:
      return labels.everyNMinutes(description.intervalMinutes ?? 0);
    case Kind.Hourly:
      return labels.hourlyAt(time);
    case Kind.Daily:
      return labels.dailyAt(time);
    case Kind.Weekly:
      return labels.weeklyAt(
        formatWeekday(description.dayOfWeek, locale),
        time,
      );
    case Kind.EveryNWeeks:
      return labels.everyNWeeks(
        description.intervalWeeks ?? 0,
        formatWeekday(description.dayOfWeek, locale),
        time,
      );
    case Kind.Monthly:
      return labels.monthlyAt(description.dayOfMonth ?? '', time);
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
  const time = new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(
    start,
  );
  const dateLabel = isSameDay(start, now)
    ? labels.todayAt(time)
    : labels.dateAt(
        new Intl.DateTimeFormat(locale, {
          month: 'short',
          day: 'numeric',
        }).format(start),
        time,
      );

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
