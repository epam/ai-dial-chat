import { ScheduledTaskErrorCode } from '@epam/ai-dial-chat-api-client';
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
  SkillSelectorI18nKeys,
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

const VALIDATION_ERROR_KEYS: Record<
  ScheduledTaskValidationErrorCode,
  EditorI18nKeys | ScheduledTasksI18nKeys | SkillSelectorI18nKeys
> = {
  [ScheduledTaskValidationErrorCode.DisplayNameRequired]:
    EditorI18nKeys.NameRequired,
  [ScheduledTaskValidationErrorCode.ModelRequired]:
    ScheduledTasksI18nKeys.CreateModelRequired,
  [ScheduledTaskValidationErrorCode.PromptRequired]:
    ScheduledTasksI18nKeys.CreatePromptRequired,
  [ScheduledTaskValidationErrorCode.InstructionsOrSkillRequired]:
    ScheduledTasksI18nKeys.CreateInstructionsOrSkillRequired,
  [ScheduledTaskValidationErrorCode.SkillUnsupported]:
    SkillSelectorI18nKeys.UnsupportedTooltipLabel,
  [ScheduledTaskValidationErrorCode.DescriptionTooLong]:
    ScheduledTasksI18nKeys.CreateDescriptionMaxLengthError,
  [ScheduledTaskValidationErrorCode.RunAtInvalid]:
    ScheduledTasksI18nKeys.CreateRunAtRequired,
  [ScheduledTaskValidationErrorCode.TimeInvalid]:
    ScheduledTasksI18nKeys.CreateTimeInvalid,
  [ScheduledTaskValidationErrorCode.MinuteInvalid]:
    ScheduledTasksI18nKeys.CreateMinuteInvalid,
  [ScheduledTaskValidationErrorCode.DayOfWeekInvalid]:
    ScheduledTasksI18nKeys.CreateDayOfWeekRequired,
  [ScheduledTaskValidationErrorCode.DayOfMonthInvalid]:
    ScheduledTasksI18nKeys.CreateDayOfMonthRequired,
  [ScheduledTaskValidationErrorCode.StartDateInvalid]:
    ScheduledTasksI18nKeys.CreateStartDateInvalid,
  [ScheduledTaskValidationErrorCode.EndDateInvalid]:
    ScheduledTasksI18nKeys.CreateEndDateBeforeStartError,
};

/** Translates shared validation codes at the application edge. */
export const mapScheduledTaskValidationErrors = (
  errors: ScheduledTaskValidationErrors,
  t: TFunction,
): ScheduledTaskCreateFormErrors =>
  Object.fromEntries(
    Object.entries(errors).map(([field, code]) => [
      field,
      t(VALIDATION_ERROR_KEYS[code]),
    ]),
  );

/** Maps stable BFF validation codes to the same localized form messages. */
export const mapScheduledTaskApiError = (
  code: string | undefined,
  t: TFunction,
): ScheduledTaskCreateFormErrors | undefined => {
  if (code === ScheduledTaskErrorCode.ScheduledTaskSkillUnsupported)
    return mapScheduledTaskValidationErrors(
      { skillUrl: ScheduledTaskValidationErrorCode.SkillUnsupported },
      t,
    );
  if (code === ScheduledTaskErrorCode.ScheduledTaskInstructionsOrSkillRequired)
    return mapScheduledTaskValidationErrors(
      { prompt: ScheduledTaskValidationErrorCode.InstructionsOrSkillRequired },
      t,
    );
  return undefined;
};

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
