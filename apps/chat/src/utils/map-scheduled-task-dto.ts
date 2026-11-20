import type { ScheduledTaskDto } from '@epam/ai-dial-chat-api-client';
import type { ApiErrorDetails } from '@epam/ai-dial-chat-hooks';
import {
  classifyScheduledTaskDeleteError,
  formatScheduledTaskActiveWindow,
  formatScheduledTaskNextRunTime,
  formatScheduledTaskScheduleLabel,
  ScheduledTaskDeleteErrorKind,
  selectScheduledTaskErrorMessage,
  toScheduledTaskItem,
  type ScheduledTaskScheduleLabels,
  type ScheduledTaskZoneLabels,
} from '@epam/ai-dial-chat-hooks/scheduled-tasks';
import type { ScheduledTaskItem } from '@epam/ai-dial-scheduled-tasks';
import type { TFunction } from 'i18next';
import {
  ScheduledTasksI18nKeys as Keys,
  ToolsetSigninI18nKeys,
} from '../constants/translation-keys';

/** Appends `(zone)` through the same translated suffix the schedule label uses. */
const buildZoneLabels = (t: TFunction): ScheduledTaskZoneLabels => ({
  withTimezone: (label, timezone) =>
    t(Keys.CardScheduleZoneSuffix, { label, timezone }),
});

const buildScheduleLabels = (t: TFunction): ScheduledTaskScheduleLabels => ({
  onceAt: (date) => t(Keys.CardScheduleOnceAt, { date }),
  everyNMinutes: (count) => t(Keys.CardScheduleEveryNMinutes, { count }),
  hourlyAt: (minute) => t(Keys.CardScheduleHourlyAt, { minute }),
  dailyAt: (time) => t(Keys.CardScheduleDailyAt, { time }),
  weeklyAt: (day, time) => t(Keys.CardScheduleWeeklyAt, { day, time }),
  monthlyAt: (day, time) => t(Keys.CardScheduleMonthlyAt, { day, time }),
  invalid: t(Keys.EditInvalidScheduleLabel),
  recurringFallback: t(Keys.CardScheduleRecurringFallback),
  ...buildZoneLabels(t),
});

/**
 * Localizes the shared trigger descriptor. The task's zone is appended only when it
 * differs from the browser's, unless `alwaysShowTimezone` is set.
 */
export const buildScheduleLabel = (
  task: ScheduledTaskDto,
  t: TFunction,
  locale?: string,
  alwaysShowTimezone = false,
): string =>
  formatScheduledTaskScheduleLabel(task, buildScheduleLabels(t), {
    locale,
    alwaysShowTimezone,
  });

/**
 * Builds the Details "Next run" text: the instant in the viewer's zone, named
 * so it can be read next to Repeats, which names the task's zone.
 */
export const buildNextRunLabel = (
  nextRunTime: string,
  t: TFunction,
  locale?: string,
  browserTimezone?: string,
): string =>
  t(Keys.DetailNextRunLabel, {
    value: formatScheduledTaskNextRunTime(nextRunTime, buildZoneLabels(t), {
      locale,
      browserTimezone,
    }),
  });

/** Builds the Details "Active" window text in the task's zone, or `undefined` when the window has no end date. */
export const buildActiveWindowLabel = (
  task: Pick<ScheduledTaskDto, 'trigger' | 'timezone' | 'nextRunTime'>,
  t: TFunction,
  locale?: string,
): string | undefined =>
  formatScheduledTaskActiveWindow(
    task,
    {
      ...buildZoneLabels(t),
      range: (startDate, endDate) =>
        t(Keys.DetailActiveWindowValue, { startDate, endDate }),
    },
    locale,
  );

/** Maps a `GET /api/v1/scheduled-tasks` DTO to the lib-facing `ScheduledTaskItem`. */
export const mapScheduledTaskDtoToItem = (
  task: ScheduledTaskDto,
  t: TFunction,
  locale?: string,
): ScheduledTaskItem =>
  toScheduledTaskItem(task, buildScheduleLabels(t), { locale });

/** Maps a list of `ScheduledTaskDto` to `ScheduledTaskItem[]`, preserving order. */
export const mapScheduledTaskDtosToItems = (
  tasks: ScheduledTaskDto[],
  t: TFunction,
  locale?: string,
): ScheduledTaskItem[] => {
  const labels = buildScheduleLabels(t);
  return tasks.map((task) => toScheduledTaskItem(task, labels, { locale }));
};

/** Maps a failed delete request's HTTP status to the localized error message key shown in the delete confirmation dialog. */
export const getDeleteErrorMessageKey = (status: number | undefined): Keys => {
  switch (classifyScheduledTaskDeleteError(status)) {
    case ScheduledTaskDeleteErrorKind.NotFound:
      return Keys.DetailDeleteNotFoundError;
    case ScheduledTaskDeleteErrorKind.Retryable:
      return Keys.DetailDeleteRetryableError;
    default:
      return Keys.DetailDeleteGenericError;
  }
};

/** Picks the notification text for a failed scheduled-task mutation; the BFF's generic `message` is never shown. */
export const resolveScheduledTaskErrorMessage = (
  details: Pick<ApiErrorDetails, 'code' | 'upstreamMessage'>,
  fallbackKey: Keys,
  t: TFunction,
): string =>
  selectScheduledTaskErrorMessage(details, {
    adminConsentRequired: t(ToolsetSigninI18nKeys.AdminConsentRequired),
    fallback: t(fallbackKey),
  });
