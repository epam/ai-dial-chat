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
  DATE_ONLY_VALUE_LENGTH,
  DATETIME_LOCAL_SEPARATOR,
  isDateTimeLocalValue,
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
  minimumLeadMs?: number;
  /** Explicit capability of the draft's selected model; omitted means unsupported. */
  isSkillsSupported?: boolean;
  /** Activity-window start boundary the edit form was hydrated with, in the hydrated boundary's shape (`YYYY-MM-DD`, or `YYYY-MM-DDTHH:mm` for Hourly); an unchanged original is exempt from the past-date rule. */
  originalStartDate?: string;
  /** Activity-window end boundary the edit form was hydrated with, in the hydrated boundary's shape (`YYYY-MM-DD`, or `YYYY-MM-DDTHH:mm` for Hourly); an unchanged original is exempt from the past-date rule. */
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

const DEFAULT_MINIMUM_LEAD_MS = 60_000;
const MINUTE_PATTERN = /^(?:[0-9]|[1-5][0-9])$/;
const WEEKDAY_PATTERN = /^[0-6]$/;
const MONTH_DAY_PATTERN = /^(?:[1-9]|[12][0-9]|3[01])$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/* Hourly repeats write `YYYY-MM-DDTHH:mm` window boundaries; day-based
 * repeats write date-only values. The form clears both boundaries on a
 * shape-changing repeat switch, so the two shapes never mix; either format
 * stays parseable here, but a boundary whose shape does not match the
 * cadence is rejected below — it can only come from a host that bypassed
 * the form, and the UTC boundary mapping dispatches on the repeat. */
const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):([0-5]\d)$/;

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

/** Accepts a window boundary in either shape: date-only `YYYY-MM-DD` or hourly `YYYY-MM-DDTHH:mm`. */
const isValidWindowBoundary = (value: string): boolean => {
  if (!isValidDateOnly(value.slice(0, DATE_ONLY_VALUE_LENGTH))) return false;
  return (
    !isDateTimeLocalValue(value) ||
    (DATETIME_LOCAL_PATTERN.test(value) &&
      Number.isFinite(new Date(value).getTime()))
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

/** Formats a `Date` as its local `YYYY-MM-DDTHH:mm` string, matching the Hourly boundaries' shape. */
const toLocalDateTime = (date: Date): string =>
  `${toLocalDateOnly(date)}${DATETIME_LOCAL_SEPARATOR}${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;

/*
 * Same-shape string comparison is chronological for these fixed-width ISO
 * values, so each boundary compares against the clock at its own
 * granularity: a date-only boundary against today (any time on today's day
 * is allowed), a time-carrying boundary against the now instant — an end
 * earlier today than now has already closed the window.
 */
const isWindowBoundaryInPast = (
  value: string,
  today: string,
  nowLocal: string,
): boolean => value < (isDateTimeLocalValue(value) ? nowLocal : today);

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

  if (values.startDate && !isValidWindowBoundary(values.startDate)) {
    errors.startDate = ScheduledTaskValidationErrorCode.StartDateInvalid;
  }
  if (values.endDate && !isValidWindowBoundary(values.endDate)) {
    errors.endDate = ScheduledTaskValidationErrorCode.EndDateInvalid;
  }
  /* A boundary's shape must match the cadence: hourly picks exact
   * `YYYY-MM-DDTHH:mm` instants, day-based repeats pick whole `YYYY-MM-DD`
   * days. */
  const isHourlyRepeat = values.repeat === ScheduledTaskRepeat.Hourly;
  const isBoundaryShapeMismatched = (value: string) =>
    isDateTimeLocalValue(value) !== isHourlyRepeat;
  if (
    values.startDate &&
    isValidWindowBoundary(values.startDate) &&
    isBoundaryShapeMismatched(values.startDate)
  ) {
    errors.startDate = ScheduledTaskValidationErrorCode.StartDateInvalid;
  }
  if (
    values.endDate &&
    isValidWindowBoundary(values.endDate) &&
    isBoundaryShapeMismatched(values.endDate)
  ) {
    errors.endDate = ScheduledTaskValidationErrorCode.EndDateInvalid;
  }
  /* Raw string comparison is chronological within a shape: the form
   * clears both boundaries on a shape-changing repeat switch, so the two
   * values reaching this check always share one shape and compare field
   * by field. */
  if (
    values.startDate &&
    values.endDate &&
    isValidWindowBoundary(values.startDate) &&
    isValidWindowBoundary(values.endDate) &&
    values.endDate < values.startDate
  ) {
    errors.endDate = ScheduledTaskValidationErrorCode.EndDateInvalid;
  }

  /*
   * The granularity of "past" follows the value's shape: a date-only boundary
   * is past when its day is earlier than today, a time-carrying boundary when
   * its instant is earlier than the now clock (see `isWindowBoundaryInPast`).
   * This runs after the ordering check so the more fundamental "date is past"
   * message wins when a boundary is both past and mis-ordered. A boundary
   * matching its original is the loaded value of an older task opened for
   * editing, not a user choice, so it is exempt — only a boundary changed
   * into the past is rejected.
   */
  const today = toLocalDateOnly(now);
  const nowLocal = toLocalDateTime(now);
  if (
    values.startDate &&
    values.startDate !== originalStartDate &&
    isValidWindowBoundary(values.startDate) &&
    isWindowBoundaryInPast(values.startDate, today, nowLocal)
  ) {
    errors.startDate = ScheduledTaskValidationErrorCode.StartDateInPast;
  }
  if (
    values.endDate &&
    values.endDate !== originalEndDate &&
    isValidWindowBoundary(values.endDate) &&
    isWindowBoundaryInPast(values.endDate, today, nowLocal)
  ) {
    errors.endDate = ScheduledTaskValidationErrorCode.EndDateInPast;
  }

  return errors;
};
