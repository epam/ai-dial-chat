import {
  ScheduledTaskCreateFormErrors,
  ScheduledTaskCreateFormValues,
  TIME_OF_DAY_PATTERN,
} from '@epam/ai-dial-scheduled-tasks';
import {
  ScheduledTaskValidationErrorCode,
  validateScheduledTaskFormValues,
  type ScheduledTaskValidationErrors,
} from '@epam/ai-dial-scheduled-tasks/validation';
import type { TFunction } from 'i18next';
import {
  EditorI18nKeys,
  ScheduledTasksI18nKeys,
} from '../constants/translation-keys';

/**
 * Validates a time-of-day value against the 24-hour `HH:mm` pattern; shared
 * by the form's submit pass and the lib-owned time field's blur pass.
 */
export const validateScheduledTaskTime = (
  time: string,
  t: TFunction,
): string | undefined =>
  TIME_OF_DAY_PATTERN.test(time)
    ? undefined
    : t(ScheduledTasksI18nKeys.CreateTimeInvalid);

/** Minimum lead time a one-shot `runAt` must be ahead of "now" to be accepted. */
export const RUN_AT_MIN_LEAD_MS = 60_000;

/** Translates shared validation codes at the application edge. */
export const mapScheduledTaskValidationErrors = (
  errors: ScheduledTaskValidationErrors,
  t: TFunction,
): ScheduledTaskCreateFormErrors =>
  Object.fromEntries(
    Object.entries(errors).map(([field, code]) => {
      const message =
        code === ScheduledTaskValidationErrorCode.DisplayNameRequired
          ? t(EditorI18nKeys.NameRequired)
          : code === ScheduledTaskValidationErrorCode.ModelRequired
            ? t(ScheduledTasksI18nKeys.CreateModelRequired)
            : code === ScheduledTaskValidationErrorCode.PromptRequired
              ? t(ScheduledTasksI18nKeys.CreatePromptRequired)
              : code === ScheduledTaskValidationErrorCode.DescriptionTooLong
                ? t(ScheduledTasksI18nKeys.CreateDescriptionMaxLengthError)
                : code === ScheduledTaskValidationErrorCode.MinuteInvalid
                  ? t(ScheduledTasksI18nKeys.CreateMinuteInvalid)
                  : code === ScheduledTaskValidationErrorCode.DayOfWeekInvalid
                    ? t(ScheduledTasksI18nKeys.CreateDayOfWeekRequired)
                    : code ===
                        ScheduledTaskValidationErrorCode.DayOfMonthInvalid
                      ? t(ScheduledTasksI18nKeys.CreateDayOfMonthRequired)
                      : code === ScheduledTaskValidationErrorCode.TimeInvalid
                        ? t(ScheduledTasksI18nKeys.CreateTimeInvalid)
                        : code ===
                            ScheduledTaskValidationErrorCode.EndDateInvalid
                          ? t(
                              ScheduledTasksI18nKeys.CreateEndDateBeforeStartError,
                            )
                          : t(ScheduledTasksI18nKeys.CreateRunAtRequired);
      return [field, message];
    }),
  );

/**
 * Validates create/edit form values against the same rules the BFF enforces
 * (required fields, description length, schedule-specific requirements),
 * shared between `ScheduledTaskCreatePage` and `ScheduledTaskEditPage` so a
 * rule change only needs to be made once.
 */
export const validateScheduledTaskForm = (
  data: ScheduledTaskCreateFormValues,
  t: TFunction,
): ScheduledTaskCreateFormErrors =>
  mapScheduledTaskValidationErrors(
    validateScheduledTaskFormValues(data, {
      now: new Date(),
      minimumLeadMs: RUN_AT_MIN_LEAD_MS,
    }),
    t,
  );
