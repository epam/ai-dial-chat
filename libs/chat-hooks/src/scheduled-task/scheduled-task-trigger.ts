import type {
  CreateScheduledTaskBodyDto,
  ScheduledTaskDto,
  ScheduleTriggerDto,
  UpdateScheduledTaskBodyDto,
} from '@epam/ai-dial-chat-api-client';
import {
  instantToZonedDateTime,
  isAbsoluteInstant,
  ScheduledTaskRepeat,
  type ScheduledTaskCreateFormValues,
} from '@epam/ai-dial-scheduled-tasks';
import { padTwoDigits } from '../shared/formatting';
import { isKnownTimezone } from '../shared/timezones';
import {
  UnsupportedTriggerReason,
  type ScheduledTaskDtoMappingResult,
} from './scheduled-task-mapping';

/*
 * Cron fields, `date`, `startDate` and `endDate` are wall time in the task's
 * `timezone`: DIAL Scheduler evaluates them there, including daylight-saving
 * changes. So nothing here shifts a value by the browser's offset — the form's
 * local values travel as typed, next to the zone they were typed in.
 */

/** Which boundary of a cron activity window is being computed. */
enum CronWindowEdge {
  Start = 'start',
  End = 'end',
}

const CRON_FIELD_KEYS = new Set(['hour', 'minute', 'day_of_week', 'day']);

/** Zone assumed for a task saved before schedules carried one. */
const DEFAULT_TIMEZONE = 'UTC';

/** Matches one APScheduler-convention weekday, `0` (Monday) – `6` (Sunday). */
const WEEKDAY_PATTERN = /^[0-6]$/;
const PLAIN_NUMBER_PATTERN = /^\d+$/;
const LOCAL_DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?/;
const DATE_ONLY_LENGTH = 10;
const DATE_TIME_TO_MINUTE_LENGTH = 16;

/** Sorts APScheduler-convention weekday strings Monday first. */
const sortWeekdays = (days: string[]): string[] =>
  [...days].sort((a, b) => Number(a) - Number(b));

/**
 * `values.time` placeholder for repeat values that don't use it (`OneTime`,
 * `Hourly`). Matches the Create page's `DEFAULT_VALUES.time` so switching
 * the Repeat dropdown to a time-based cadence (Daily/Weekly/Monthly) on the
 * edit page starts from a reasonable time instead of a silent midnight.
 */
const DEFAULT_TIME_PLACEHOLDER = '09:00';

/** Builds the cron `fields` from the entered wall time, unshifted. */
const buildCronFields = (
  values: ScheduledTaskCreateFormValues,
): Record<string, string> => {
  if (values.repeat === ScheduledTaskRepeat.Hourly) {
    return { hour: '*', minute: String(Number(values.minute)) };
  }

  const [hourStr, minuteStr] = values.time.split(':');
  const fields: Record<string, string> = {
    hour: String(Number(hourStr)),
    minute: String(Number(minuteStr)),
  };

  if (values.repeat === ScheduledTaskRepeat.Weekly && values.dayOfWeek) {
    fields.day_of_week = values.dayOfWeek;
  }
  if (values.repeat === ScheduledTaskRepeat.Monthly && values.dayOfMonth) {
    fields.day = String(Number(values.dayOfMonth));
  }
  if (values.repeat === ScheduledTaskRepeat.Custom) {
    const customDays = sortWeekdays(values.daysOfWeek ?? []);
    if (customDays.length) fields.day_of_week = customDays.join(',');
  }

  return fields;
};

/*
 * Resolves a date-only `YYYY-MM-DD` window boundary to a zone-local datetime
 * with no offset: the first instant of that day for a start, its last
 * millisecond for an end, so the final day the user picked stays fully inside
 * the window. Every cadence that renders boundary pickers uses this one shape.
 */
const buildCronWindowBoundary = (
  dateValue: string,
  edge: CronWindowEdge,
): string =>
  edge === CronWindowEdge.Start
    ? `${dateValue}T00:00:00.000`
    : `${dateValue}T23:59:59.999`;

/** Turns the form's `YYYY-MM-DDTHH:mm` run-at value into an offset-less datetime with seconds. */
const toOffsetLessDateTime = (runAt: string): string => {
  const match = LOCAL_DATE_TIME_PATTERN.exec(runAt);
  return match ? `${match[1]}:${match[2] ?? '00'}` : runAt;
};

/**
 * Maps validated create-form values to the `POST /api/v1/scheduled-tasks`
 * request body: `trigger.date` for a one-shot schedule or `trigger.cron` for a
 * recurring one, both in wall time, plus the `timezone` they are read in.
 * Assumes the caller has already validated required fields (name, model,
 * prompt, and the active schedule section's fields) — this function does not
 * re-validate.
 */
export const mapFormValuesToCreateBody = (
  values: ScheduledTaskCreateFormValues,
): CreateScheduledTaskBodyDto => {
  const trigger: ScheduleTriggerDto =
    values.repeat === ScheduledTaskRepeat.OneTime
      ? { date: toOffsetLessDateTime(values.runAt ?? '') }
      : {
          cron: {
            fields: buildCronFields(values),
            ...(values.startDate
              ? {
                  startDate: buildCronWindowBoundary(
                    values.startDate,
                    CronWindowEdge.Start,
                  ),
                }
              : {}),
            ...(values.endDate
              ? {
                  endDate: buildCronWindowBoundary(
                    values.endDate,
                    CronWindowEdge.End,
                  ),
                }
              : {}),
          },
        };

  const trimmedDescription = values.description?.trim();

  return {
    displayName: values.displayName.trim(),
    trigger,
    timezone: values.timezone,
    model: values.modelId,
    prompt: values.prompt.trim(),
    ...(values.skillUrls?.length
      ? { skillUrls: [...new Set(values.skillUrls)] }
      : {}),
    ...(trimmedDescription ? { description: trimmedDescription } : {}),
  };
};

/**
 * Maps a complete, validated edit draft to an update body. An unset skill
 * emits null to remove the saved reference; hydrate from detail before editing.
 * The zone is always present, because the scheduler resets an omitted one to UTC.
 */
export const mapFormValuesToUpdateBody = (
  values: ScheduledTaskCreateFormValues,
): UpdateScheduledTaskBodyDto => ({
  ...mapFormValuesToCreateBody(values),
  skillUrls: [...new Set(values.skillUrls ?? [])],
});

/**
 * Reads a stored one-time `date` as the `YYYY-MM-DDTHH:mm` the "Run at" field
 * shows: an offset-less value is already wall time in the task's zone, an
 * absolute instant (every task saved before schedules had a zone) is shown in
 * that zone.
 */
const dateToLocalDateTime = (date: string, timezone: string): string => {
  if (!isAbsoluteInstant(date)) {
    return date.slice(0, DATE_TIME_TO_MINUTE_LENGTH);
  }
  return (
    instantToZonedDateTime(date, timezone) ??
    date.slice(0, DATE_TIME_TO_MINUTE_LENGTH)
  );
};

/** Reads a stored window boundary as the `YYYY-MM-DD` the date pickers expect, in the task's zone. */
const boundaryToLocalDateOnly = (value: string, timezone: string): string =>
  dateToLocalDateTime(value, timezone).slice(0, DATE_ONLY_LENGTH);

/**
 * Inverts {@link buildCronFields}: reads the stored `hour`/`minute` (and, for
 * weekly/monthly/custom recurrence, `day_of_week`/`day`) exactly as stored,
 * because they are already wall time in the task's zone.
 *
 * `hour: '*'` (Hourly) is checked first and returns just the `minute`. A
 * `day_of_week` list of two or more distinct weekdays is the Custom repeat's
 * weekday list. Any `week` value is an unsupported extra field and fails
 * closed, as does a `day` that is not a plain day number (including `last`).
 */
const parseCronFields = (
  fields: Record<string, string | null | undefined>,
):
  | { ok: true; isHourly: true; minute: string }
  | {
      ok: true;
      isHourly: false;
      isCustom: true;
      time: string;
      daysOfWeek: string[];
    }
  | {
      ok: true;
      isHourly: false;
      isCustom?: false;
      time: string;
      dayOfWeek?: string;
      dayOfMonth?: string;
    }
  | { ok: false } => {
  /* DIAL Scheduler always returns every cron field key, using `null` for
   * ones that aren't set — so presence-of-key checks (`in`/Object.keys)
   * must be replaced with presence-of-value checks. */
  const presentKeys = new Set(
    Object.entries(fields)
      .filter(([, value]) => value != null)
      .map(([key]) => key),
  );
  const extraKeys = [...presentKeys].filter((key) => !CRON_FIELD_KEYS.has(key));
  const hasDayOfWeek = presentKeys.has('day_of_week');
  const hasDayOfMonth = presentKeys.has('day');
  const hasHour = presentKeys.has('hour');
  const hasMinute = presentKeys.has('minute');

  /*
   * Hourly pattern: `minute` only (with `hour` absent or `'*'`), no day fields.
   * External schedulers (e.g. Claude Desktop) may omit `hour` entirely rather
   * than setting it to `'*'` — both mean "every hour at minute N".
   */
  const isHourlyPattern =
    hasMinute &&
    (!hasHour || fields.hour === '*') &&
    !hasDayOfWeek &&
    !hasDayOfMonth &&
    PLAIN_NUMBER_PATTERN.test(String(fields.minute));

  if (isHourlyPattern) {
    return { ok: true, isHourly: true, minute: String(Number(fields.minute)) };
  }

  if (
    extraKeys.length > 0 ||
    (hasDayOfWeek && hasDayOfMonth) ||
    !hasHour ||
    !hasMinute
  ) {
    return { ok: false };
  }

  if (
    !PLAIN_NUMBER_PATTERN.test(String(fields.hour)) ||
    !PLAIN_NUMBER_PATTERN.test(String(fields.minute))
  ) {
    return { ok: false };
  }
  const time = `${padTwoDigits(Number(fields.hour))}:${padTwoDigits(Number(fields.minute))}`;

  const weekdays = hasDayOfWeek ? String(fields.day_of_week).split(',') : [];
  if (
    weekdays.some((day) => !WEEKDAY_PATTERN.test(day)) ||
    new Set(weekdays).size !== weekdays.length
  ) {
    return { ok: false };
  }
  if (weekdays.length > 1) {
    return {
      ok: true,
      isHourly: false,
      isCustom: true,
      time,
      daysOfWeek: sortWeekdays(weekdays),
    };
  }

  const day = hasDayOfMonth ? String(fields.day) : undefined;
  if (
    day !== undefined &&
    (!PLAIN_NUMBER_PATTERN.test(day) || Number(day) < 1 || Number(day) > 31)
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    isHourly: false,
    time,
    ...(weekdays.length ? { dayOfWeek: weekdays[0] } : {}),
    ...(day ? { dayOfMonth: String(Number(day)) } : {}),
  };
};

/**
 * Attempts to map a {@link ScheduledTaskDto} back to editable
 * {@link ScheduledTaskCreateFormValues}, inverting {@link buildCronFields}/
 * {@link buildCronWindowBoundary}. Fails closed — returning a reason instead
 * of a value — whenever the task's trigger or required fields cannot be
 * represented losslessly by the editor, so an unsupported schedule is never
 * silently coerced and re-submitted.
 */
export const mapScheduledTaskDtoToFormValues = (
  dto: ScheduledTaskDto,
): ScheduledTaskDtoMappingResult => {
  if (
    !dto.model ||
    typeof dto.prompt !== 'string' ||
    (!dto.prompt.trim() && !dto.skillUrls?.length)
  ) {
    return {
      ok: false,
      reason: UnsupportedTriggerReason.MissingRequiredFields,
    };
  }

  const { date, cron } = dto.trigger;
  const hasDate = !!date;
  const hasCron = !!cron;
  if (hasDate === hasCron) {
    return {
      ok: false,
      reason: UnsupportedTriggerReason.UnsupportedTriggerType,
    };
  }

  const timezone = dto.timezone || DEFAULT_TIMEZONE;
  if (!isKnownTimezone(timezone)) {
    return {
      ok: false,
      reason: UnsupportedTriggerReason.UnsupportedTriggerType,
    };
  }

  const base: Pick<
    ScheduledTaskCreateFormValues,
    | 'displayName'
    | 'modelId'
    | 'prompt'
    | 'description'
    | 'skillUrls'
    | 'timezone'
  > = {
    displayName: dto.displayName,
    modelId: dto.model,
    prompt: dto.prompt,
    skillUrls: [...new Set(dto.skillUrls ?? [])],
    timezone,
    ...(dto.description ? { description: dto.description } : {}),
  };

  if (hasDate) {
    return {
      ok: true,
      values: {
        ...base,
        repeat: ScheduledTaskRepeat.OneTime,
        runAt: dateToLocalDateTime(date as string, timezone),
        time: DEFAULT_TIME_PLACEHOLDER,
      },
    };
  }

  if (!cron) {
    return {
      ok: false,
      reason: UnsupportedTriggerReason.UnsupportedTriggerType,
    };
  }

  const parsed = parseCronFields(cron.fields);
  if (!parsed.ok) {
    return { ok: false, reason: UnsupportedTriggerReason.UnsupportedCronShape };
  }

  const window = {
    ...(cron.startDate
      ? { startDate: boundaryToLocalDateOnly(cron.startDate, timezone) }
      : {}),
    ...(cron.endDate
      ? { endDate: boundaryToLocalDateOnly(cron.endDate, timezone) }
      : {}),
  };

  if (parsed.isHourly) {
    return {
      ok: true,
      values: {
        ...base,
        repeat: ScheduledTaskRepeat.Hourly,
        time: DEFAULT_TIME_PLACEHOLDER,
        minute: parsed.minute,
        ...window,
      },
    };
  }

  if (parsed.isCustom) {
    return {
      ok: true,
      values: {
        ...base,
        repeat: ScheduledTaskRepeat.Custom,
        time: parsed.time,
        daysOfWeek: parsed.daysOfWeek,
        ...window,
      },
    };
  }

  let repeat = ScheduledTaskRepeat.Daily;
  if (parsed.dayOfWeek) {
    repeat = ScheduledTaskRepeat.Weekly;
  } else if (parsed.dayOfMonth) {
    repeat = ScheduledTaskRepeat.Monthly;
  }

  return {
    ok: true,
    values: {
      ...base,
      repeat,
      time: parsed.time,
      ...(parsed.dayOfWeek ? { dayOfWeek: parsed.dayOfWeek } : {}),
      ...(parsed.dayOfMonth ? { dayOfMonth: parsed.dayOfMonth } : {}),
      ...window,
    },
  };
};
