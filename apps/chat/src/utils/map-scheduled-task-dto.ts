import {
  ScheduledTaskErrorCode,
  type ScheduledTaskDto,
  type ScheduleTriggerDto,
  SchedulerServiceConsentStatus,
} from '@epam/ai-dial-chat-api-client';
import type { ApiErrorDetails } from '@epam/ai-dial-chat-hooks';
import {
  describeScheduledTaskTrigger,
  ScheduledTaskTriggerDescriptionKind as Kind,
} from '@epam/ai-dial-chat-hooks/scheduled-tasks';
import type { ScheduledTaskItem } from '@epam/ai-dial-scheduled-tasks';
import type { TFunction } from 'i18next';
import {
  ScheduledTasksI18nKeys as Keys,
  ToolsetSigninI18nKeys,
} from '../constants/translation-keys';

/** APScheduler `day` expression for the last day of the month. */
const CRON_LAST_DAY_OF_MONTH = 'last';
/* A day-of-month constraint (e.g. the 31st) always matches within a year. */
const MAX_DAYS_TO_NEXT_OCCURRENCE = 366;
const PLAIN_NUMBER = /^\d+$/;

/** Whether a UTC date satisfies the cron's `day_of_week` / `day` constraint. */
const matchesCronDay = (
  date: Date,
  dayOfWeek: string | null | undefined,
  dayOfMonth: string | null | undefined,
): boolean => {
  if (dayOfWeek != null) {
    /* APScheduler weekdays run Monday=0..Sunday=6; JS `getUTCDay` Sunday=0. */
    return (Number(dayOfWeek) + 1) % 7 === date.getUTCDay();
  }
  if (dayOfMonth === CRON_LAST_DAY_OF_MONTH) {
    const nextDay = new Date(date);
    nextDay.setUTCDate(date.getUTCDate() + 1);
    return nextDay.getUTCDate() === 1;
  }
  if (dayOfMonth != null) return Number(dayOfMonth) === date.getUTCDate();
  return true;
};

/**
 * Returns the next UTC time at which a cron trigger with a fixed
 * `hour`/`minute` fires, honouring its `day_of_week` (Weekly) or `day`
 * (Monthly) constraint. Returns `undefined` when the fields are not plain
 * values this helper can evaluate.
 */
export const getNextCronOccurrence = (
  cron: NonNullable<ScheduleTriggerDto['cron']>,
  from: Date = new Date(),
): Date | undefined => {
  const {
    hour,
    minute,
    day_of_week: dayOfWeek,
    day: dayOfMonth,
  } = cron.fields as Record<string, string | null | undefined>;
  if (
    !hour ||
    !minute ||
    !PLAIN_NUMBER.test(hour) ||
    !PLAIN_NUMBER.test(minute) ||
    (dayOfWeek != null && !/^[0-6]$/.test(dayOfWeek)) ||
    (dayOfMonth != null &&
      dayOfMonth !== CRON_LAST_DAY_OF_MONTH &&
      !PLAIN_NUMBER.test(dayOfMonth))
  ) {
    return undefined;
  }
  const candidate = new Date(from);
  candidate.setUTCHours(Number(hour), Number(minute), 0, 0);
  for (let i = 0; i <= MAX_DAYS_TO_NEXT_OCCURRENCE; i++) {
    if (candidate > from && matchesCronDay(candidate, dayOfWeek, dayOfMonth)) {
      return candidate;
    }
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return undefined;
};

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
 * `isActive` and `isCompleted` map 1:1 from the DTO with no reinterpretation —
 * derivation is owned entirely by the BFF mapper.
 */
export const mapScheduledTaskDtoToItem = (
  task: ScheduledTaskDto,
  t: TFunction,
  locale?: string,
): ScheduledTaskItem => ({
  id: task.id,
  displayName: task.displayName,
  descriptionPreview: task.description,
  scheduleLabel: buildScheduleLabel(task, t, locale),
  isActive: task.isActive,
  isCompleted: task.isCompleted,
});

/** Maps a list of `ScheduledTaskDto` to `ScheduledTaskItem[]`, preserving order. */
export const mapScheduledTaskDtosToItems = (
  tasks: ScheduledTaskDto[],
  t: TFunction,
  locale?: string,
): ScheduledTaskItem[] =>
  tasks.map((task) => mapScheduledTaskDtoToItem(task, t, locale));

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

/**
 * Picks the notification text for a failed scheduled-task mutation: a revoked
 * DIAL_NATIVE scheduler consent gets the localized "contact your
 * administrator" message; otherwise DIAL Scheduler's own reason is shown as
 * received; otherwise the page's localized fallback. The BFF's generic
 * `message` is never shown — it is English-only and not actionable.
 */
export const resolveScheduledTaskErrorMessage = (
  details: Pick<ApiErrorDetails, 'code' | 'upstreamMessage'>,
  fallbackKey: Keys,
  t: TFunction,
): string => {
  if (details.code === ScheduledTaskErrorCode.ScheduledTaskAdminConsentRequired)
    return t(ToolsetSigninI18nKeys.AdminConsentRequired);
  const upstreamMessage = details.upstreamMessage?.trim();
  return upstreamMessage || t(fallbackKey);
};

/**
 * Whether the scheduler service's administrator consent is missing: the
 * user can neither create nor edit tasks until an administrator restores
 * it — logging in cannot help, so consent is evaluated before any login
 * state. `unknown` (a failed consent read) fails open.
 */
export const isSchedulerConsentMissing = (
  schedulerServiceConsent: SchedulerServiceConsentStatus | undefined,
): boolean =>
  schedulerServiceConsent === SchedulerServiceConsentStatus.SignedOut;
