import { isSkillSelectionUnsupported } from '@epam/ai-dial-chat-shared';
import { DESCRIPTION_MAX_LENGTH } from '../constants/scheduled-task-create-form';
import type { ScheduledTaskCreateFormValues } from '../models/scheduled-task-create-form-props';
import { ScheduledTaskRepeat } from '../types/scheduled-task-schedule';
import { TIME_OF_DAY_PATTERN } from '../utils/calendar-value';

/** Stable error codes that a host translates at its application boundary. */
export enum ScheduledTaskValidationErrorCode {
  DisplayNameRequired = 'displayNameRequired',
  ModelRequired = 'modelRequired',
  PromptRequired = 'promptRequired',
  /** Neither instructions nor a skill was provided. */
  InstructionsOrSkillRequired = 'instructionsOrSkillRequired',
  /** A selected skill requires explicit capability support. */
  SkillUnsupported = 'skillUnsupported',
  DescriptionTooLong = 'descriptionTooLong',
  RunAtInvalid = 'runAtInvalid',
  TimeInvalid = 'timeInvalid',
  MinuteInvalid = 'minuteInvalid',
  DayOfWeekInvalid = 'dayOfWeekInvalid',
  DayOfMonthInvalid = 'dayOfMonthInvalid',
  StartDateInvalid = 'startDateInvalid',
  EndDateInvalid = 'endDateInvalid',
}

/** Field-keyed validation result for scheduled-task create and edit values. */
export type ScheduledTaskValidationErrors = Partial<
  Record<keyof ScheduledTaskCreateFormValues, ScheduledTaskValidationErrorCode>
>;

/** Explicit clock and lead-time inputs make schedule validation deterministic. */
export interface ScheduledTaskValidationOptions {
  now: Date;
  minimumLeadMs?: number;
  /** Explicit capability of the draft's selected model; omitted means unsupported. */
  isSkillsSupported?: boolean;
}

const DEFAULT_MINIMUM_LEAD_MS = 60_000;
const MINUTE_PATTERN = /^(?:[0-9]|[1-5][0-9])$/;
const WEEKDAY_PATTERN = /^[0-6]$/;
const MONTH_DAY_PATTERN = /^(?:[1-9]|[12][0-9]|3[01])$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidDateOnly = (value: string): boolean => {
  if (!DATE_PATTERN.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

const isValidLocalDateTime = (value: string): boolean => {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp);
};

/**
 * Validates only the fields active for the selected repeat cadence. This pure
 * function deliberately has no translation, DOM, network, or implicit-clock
 * dependencies so both application forms and request preparation agree.
 */
export const validateScheduledTaskFormValues = (
  values: ScheduledTaskCreateFormValues,
  {
    now,
    minimumLeadMs = DEFAULT_MINIMUM_LEAD_MS,
    isSkillsSupported,
  }: ScheduledTaskValidationOptions,
): ScheduledTaskValidationErrors => {
  const errors: ScheduledTaskValidationErrors = {};

  if (!values.displayName.trim()) {
    errors.displayName = ScheduledTaskValidationErrorCode.DisplayNameRequired;
  }
  if (!values.modelId.trim()) {
    errors.modelId = ScheduledTaskValidationErrorCode.ModelRequired;
  }
  if (!values.prompt.trim() && !values.skillUrl?.trim()) {
    errors.prompt =
      ScheduledTaskValidationErrorCode.InstructionsOrSkillRequired;
  }
  if (isSkillSelectionUnsupported(values.skillUrl, isSkillsSupported)) {
    errors.skillUrl = ScheduledTaskValidationErrorCode.SkillUnsupported;
  }
  if ((values.description?.trim().length ?? 0) > DESCRIPTION_MAX_LENGTH) {
    errors.description = ScheduledTaskValidationErrorCode.DescriptionTooLong;
  }

  if (values.repeat === ScheduledTaskRepeat.OneTime) {
    const runAtTime = values.runAt ? new Date(values.runAt).getTime() : NaN;
    if (
      !values.runAt ||
      !isValidLocalDateTime(values.runAt) ||
      !Number.isFinite(runAtTime) ||
      runAtTime < now.getTime() + minimumLeadMs
    ) {
      errors.runAt = ScheduledTaskValidationErrorCode.RunAtInvalid;
    }
    return errors;
  }

  if (values.repeat === ScheduledTaskRepeat.Hourly) {
    if (!MINUTE_PATTERN.test(values.minute ?? '')) {
      errors.minute = ScheduledTaskValidationErrorCode.MinuteInvalid;
    }
  } else if (!TIME_OF_DAY_PATTERN.test(values.time)) {
    errors.time = ScheduledTaskValidationErrorCode.TimeInvalid;
  }

  if (
    values.repeat === ScheduledTaskRepeat.Weekly &&
    !WEEKDAY_PATTERN.test(values.dayOfWeek ?? '')
  ) {
    errors.dayOfWeek = ScheduledTaskValidationErrorCode.DayOfWeekInvalid;
  }
  if (
    values.repeat === ScheduledTaskRepeat.Monthly &&
    !MONTH_DAY_PATTERN.test(values.dayOfMonth ?? '')
  ) {
    errors.dayOfMonth = ScheduledTaskValidationErrorCode.DayOfMonthInvalid;
  }

  if (values.startDate && !isValidDateOnly(values.startDate)) {
    errors.startDate = ScheduledTaskValidationErrorCode.StartDateInvalid;
  }
  if (values.endDate && !isValidDateOnly(values.endDate)) {
    errors.endDate = ScheduledTaskValidationErrorCode.EndDateInvalid;
  }
  if (
    values.startDate &&
    values.endDate &&
    isValidDateOnly(values.startDate) &&
    isValidDateOnly(values.endDate) &&
    values.endDate <= values.startDate
  ) {
    errors.endDate = ScheduledTaskValidationErrorCode.EndDateInvalid;
  }

  return errors;
};
