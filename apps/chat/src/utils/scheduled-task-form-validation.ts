import {
  DESCRIPTION_MAX_LENGTH,
  ScheduledTaskCreateFormErrors,
  ScheduledTaskCreateFormValues,
  ScheduledTaskFrequency,
  ScheduledTaskScheduleType,
} from '@epam/ai-dial-scheduled-tasks';
import type { TFunction } from 'i18next';
import {
  EditorI18nKeys,
  ScheduledTasksI18nKeys,
} from '../constants/translation-keys';

/** `HH:mm` 24-hour time-of-day, matching the `Calendar` time control's value shape. */
export const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minimum lead time a one-shot `runAt` must be ahead of "now" to be accepted. */
export const RUN_AT_MIN_LEAD_MS = 60_000;

/**
 * Validates create/edit form values against the same rules the BFF enforces
 * (required fields, description length, schedule-specific requirements),
 * shared between `ScheduledTaskCreatePage` and `ScheduledTaskEditPage` so a
 * rule change only needs to be made once.
 */
export const validateScheduledTaskForm = (
  data: ScheduledTaskCreateFormValues,
  t: TFunction,
): ScheduledTaskCreateFormErrors => {
  const nextErrors: ScheduledTaskCreateFormErrors = {};

  if (!data.displayName.trim()) {
    nextErrors.displayName = t(EditorI18nKeys.NameRequired);
  }
  if (!data.modelId) {
    nextErrors.modelId = t(ScheduledTasksI18nKeys.CreateModelRequired);
  }
  if (!data.prompt.trim()) {
    nextErrors.prompt = t(ScheduledTasksI18nKeys.CreatePromptRequired);
  }
  if ((data.description?.length ?? 0) > DESCRIPTION_MAX_LENGTH) {
    nextErrors.description = t(
      ScheduledTasksI18nKeys.CreateDescriptionMaxLengthError,
    );
  }

  if (data.scheduleType === ScheduledTaskScheduleType.Once) {
    const runAtTime = data.runAt ? new Date(data.runAt).getTime() : NaN;
    if (
      !data.runAt ||
      Number.isNaN(runAtTime) ||
      runAtTime <= Date.now() + RUN_AT_MIN_LEAD_MS
    ) {
      nextErrors.runAt = t(ScheduledTasksI18nKeys.CreateRunAtRequired);
    }
  } else {
    if (!TIME_PATTERN.test(data.time)) {
      nextErrors.time = t(ScheduledTasksI18nKeys.CreateTimeInvalid);
    }
    if (
      data.frequency === ScheduledTaskFrequency.Weekly &&
      !data.dayOfWeek?.trim()
    ) {
      nextErrors.dayOfWeek = t(ScheduledTasksI18nKeys.CreateDayOfWeekRequired);
    }
    if (
      data.frequency === ScheduledTaskFrequency.Monthly &&
      !data.dayOfMonth?.trim()
    ) {
      nextErrors.dayOfMonth = t(
        ScheduledTasksI18nKeys.CreateDayOfMonthRequired,
      );
    }
    if (
      data.startDate &&
      data.endDate &&
      new Date(data.endDate).getTime() <= new Date(data.startDate).getTime()
    ) {
      nextErrors.endDate = t(
        ScheduledTasksI18nKeys.CreateEndDateBeforeStartError,
      );
    }
  }

  return nextErrors;
};
