import {
  ENTITY_INSTRUCTIONS_MAX_LENGTH,
  ENTITY_NAME_MAX_LENGTH,
  exceedsMaxLength,
  hasControlCharacters,
  isSkillSelectionUnsupported,
} from '@epam/ai-dial-chat-shared';
import { DESCRIPTION_MAX_LENGTH } from '../constants/scheduled-task-create-form';
import type { ScheduledTaskCreateFormValues } from '../models/scheduled-task-create-form-props';
import { ScheduledTaskRepeat } from '../types/scheduled-task-schedule';
import {
  TIME_OF_DAY_PATTERN,
} from '../utils/calendar-value';

/** Stable error codes that a host translates at its application boundary. */
export enum ScheduledTaskValidationErrorCode {
  DisplayNameRequired = 'displayNameRequired',
  /** The display name exceeds the shared entity-name length limit. */
  DisplayNameTooLong = 'displayNameTooLong',
  /** The display name contains a control character (line break, tab, …). */
  DisplayNameControlCharacters = 'displayNameControlCharacters',
  ModelRequired = 'modelRequired',
  PromptRequired = 'promptRequired',
  /** The instructions exceed the shared instructions length limit. */
  PromptTooLong = 'promptTooLong',
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
  /** The activity-window start boundary is earlier than the clock — its day earlier than today for a date-only value, its instant earlier than now for a time-carrying one — and differs from the option's original. */
  StartDateInPast = 'startDateInPast',
  EndDateInvalid = 'endDateInvalid',
  /** The activity-window end boundary is earlier than the clock — its day earlier than today for a date-only value, its instant earlier than now for a time-carrying one — and differs from the option's original. */
  EndDateInPast = 'endDateInPast',
}

/** Field-keyed validation result for scheduled-task create and edit values. */
export type ScheduledTaskValidationErrors = Partial<
  Record<keyof ScheduledTaskCreateFormValues, ScheduledTaskValidationErrorCode>
>;

/** Explicit clock and lead-time inputs make schedule validation deterministic. */
export interface ScheduledTaskValidationOptions {
  now: Date;
  /** Minimum time a one-shot `runAt` must lie ahead of `now`. Defaults to `SCHEDULED_TASK_MINIMUM_LEAD_MS`. */
  minimumLeadMs?: number;
  /** Explicit capability of the draft's selected model; omitted means unsupported. */
  isSkillsSupported?: boolean;
  /** Activity-window start boundary the edit form was hydrated with, in the hydrated boundary's shape (`YYYY-MM-DD`); an unchanged original is exempt from the past-date rule. */
  originalStartDate?: string;
  /** Activity-window end boundary the edit form was hydrated with, in the hydrated boundary's shape (`YYYY-MM-DD`); an unchanged original is exempt from the past-date rule. */
  originalEndDate?: string;
}

/** Scheduled-task form fields that carry free text with a length limit. */
export type ScheduledTaskTextField = 'displayName' | 'description' | 'prompt';

/**
 * Checks one free-text field against its length limit (and, for the display
 * name, control characters) as the BFF will see it — trimmed. An empty value
 * passes; required checks live in `validateScheduledTaskFormValues`.
 */
export const validateScheduledTaskTextField = (
  field: ScheduledTaskTextField,
  value: string | undefined,
): ScheduledTaskValidationErrorCode | undefined => {
  const trimmed = value?.trim() ?? '';
  switch (field) {
    case 'displayName':
      if (exceedsMaxLength(trimmed, ENTITY_NAME_MAX_LENGTH)) {
        return ScheduledTaskValidationErrorCode.DisplayNameTooLong;
      }
      if (hasControlCharacters(trimmed)) {
        return ScheduledTaskValidationErrorCode.DisplayNameControlCharacters;
      }
      return undefined;
    case 'description':
      return exceedsMaxLength(trimmed, DESCRIPTION_MAX_LENGTH)
        ? ScheduledTaskValidationErrorCode.DescriptionTooLong
        : undefined;
    case 'prompt':
      return exceedsMaxLength(trimmed, ENTITY_INSTRUCTIONS_MAX_LENGTH)
        ? ScheduledTaskValidationErrorCode.PromptTooLong
        : undefined;
  }
};

/** Minimum time a one-shot `runAt` must lie ahead of `now`; the default of `minimumLeadMs`. */
export const SCHEDULED_TASK_MINIMUM_LEAD_MS = 60_000;
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

const padDatePart = (value: number): string => String(value).padStart(2, '0');

/** Formats a `Date` as its local `YYYY-MM-DD` date-only string, matching the form's `startDate`/`endDate` shape. */
const toLocalDateOnly = (date: Date): string =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

/** A date-only boundary is past when its day is earlier than today; any time on today's day is allowed. */
const isWindowBoundaryInPast = (value: string, today: string): boolean =>
  value < today;

/**
 * Validates only the fields active for the selected repeat cadence. This pure
 * function deliberately has no translation, DOM, network, or implicit-clock
 * dependencies so both application forms and request preparation agree.
 */
export const validateScheduledTaskFormValues = (
  values: ScheduledTaskCreateFormValues,
  {
    now,
    minimumLeadMs = SCHEDULED_TASK_MINIMUM_LEAD_MS,
    isSkillsSupported,
    originalStartDate,
    originalEndDate,
  }: ScheduledTaskValidationOptions,
): ScheduledTaskValidationErrors => {
  const errors: ScheduledTaskValidationErrors = {};
  const setTextFieldError = (
    field: ScheduledTaskTextField,
    value: string | undefined,
  ) => {
    const code = validateScheduledTaskTextField(field, value);
    if (code) errors[field] = code;
  };

  if (!values.displayName.trim()) {
    errors.displayName = ScheduledTaskValidationErrorCode.DisplayNameRequired;
  } else {
    setTextFieldError('displayName', values.displayName);
  }
  if (!values.modelId.trim()) {
    errors.modelId = ScheduledTaskValidationErrorCode.ModelRequired;
  }
  if (!values.prompt.trim() && !values.skillUrls?.length) {
    errors.prompt =
      ScheduledTaskValidationErrorCode.InstructionsOrSkillRequired;
  } else {
    setTextFieldError('prompt', values.prompt);
  }
  if (
    values.skillUrls?.some((url) =>
      isSkillSelectionUnsupported(url, isSkillsSupported),
    )
  ) {
    errors.skillUrls = ScheduledTaskValidationErrorCode.SkillUnsupported;
  }
  setTextFieldError('description', values.description);

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

  /* Weekly picks its day in the weekday Calendar; Custom in the segmented
   * day row — both store the same APScheduler-convention string. */
  const isDayOfWeekRepeat =
    values.repeat === ScheduledTaskRepeat.Weekly ||
    values.repeat === ScheduledTaskRepeat.Custom;
  if (isDayOfWeekRepeat && !WEEKDAY_PATTERN.test(values.dayOfWeek ?? '')) {
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
  /* Fixed-width `YYYY-MM-DD` strings compare chronologically. */
  if (
    values.startDate &&
    values.endDate &&
    isValidDateOnly(values.startDate) &&
    isValidDateOnly(values.endDate) &&
    values.endDate < values.startDate
  ) {
    errors.endDate = ScheduledTaskValidationErrorCode.EndDateInvalid;
  }

  /*
   * A boundary is past when its day is earlier than today. This runs after
   * the ordering check so the more fundamental "date is past" message wins
   * when a boundary is both past and mis-ordered. A boundary matching its
   * original is the loaded value of an older task opened for editing, not a
   * user choice, so it is exempt — only a boundary changed into the past is
   * rejected.
   */
  const today = toLocalDateOnly(now);
  if (
    values.startDate &&
    values.startDate !== originalStartDate &&
    isValidDateOnly(values.startDate) &&
    isWindowBoundaryInPast(values.startDate, today)
  ) {
    errors.startDate = ScheduledTaskValidationErrorCode.StartDateInPast;
  }
  if (
    values.endDate &&
    values.endDate !== originalEndDate &&
    isValidDateOnly(values.endDate) &&
    isWindowBoundaryInPast(values.endDate, today)
  ) {
    errors.endDate = ScheduledTaskValidationErrorCode.EndDateInPast;
  }

  return errors;
};
