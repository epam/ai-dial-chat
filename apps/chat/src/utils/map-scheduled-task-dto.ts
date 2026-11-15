import type { ScheduledTaskDto } from '@epam/ai-dial-chat-api-client';
import type { ApiErrorDetails } from '@epam/ai-dial-chat-hooks';
import {
  classifyScheduledTaskDeleteError,
  formatScheduledTaskScheduleLabel,
  ScheduledTaskDeleteErrorKind,
  selectScheduledTaskErrorMessage,
  toScheduledTaskItem,
  type ScheduledTaskScheduleLabels,
} from '@epam/ai-dial-chat-hooks/scheduled-tasks';
import type { ScheduledTaskItem } from '@epam/ai-dial-scheduled-tasks';
import type { TFunction } from 'i18next';
import {
  ScheduledTasksI18nKeys as Keys,
  ToolsetSigninI18nKeys,
} from '../constants/translation-keys';

const buildScheduleLabels = (t: TFunction): ScheduledTaskScheduleLabels => ({
  onceAt: (date) => t(Keys.CardScheduleOnceAt, { date }),
  everyNMinutes: (count) => t(Keys.CardScheduleEveryNMinutes, { count }),
  hourlyAt: (minute) => t(Keys.CardScheduleHourlyAt, { minute }),
  dailyAt: (time) => t(Keys.CardScheduleDailyAt, { time }),
  weeklyAt: (day, time) => t(Keys.CardScheduleWeeklyAt, { day, time }),
  monthlyAt: (day, time) => t(Keys.CardScheduleMonthlyAt, { day, time }),
  invalid: t(Keys.EditInvalidScheduleLabel),
  recurringFallback: t(Keys.CardScheduleRecurringFallback),
});

/** Localizes the shared trigger descriptor in the browser's display timezone. */
export const buildScheduleLabel = (
  task: ScheduledTaskDto,
  t: TFunction,
  locale?: string,
): string =>
  formatScheduledTaskScheduleLabel(task, buildScheduleLabels(t), { locale });

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
