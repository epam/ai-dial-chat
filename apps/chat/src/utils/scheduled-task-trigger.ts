import type {
  CreateScheduledTaskBodyDto,
  ScheduledTaskDto,
  ScheduleTriggerDto,
  UpdateScheduledTaskBodyDto,
} from '@epam/ai-dial-chat-api-client';
import {
  ScheduledTaskCreateFormValues,
  ScheduledTaskRepeat,
} from '@epam/ai-dial-scheduled-tasks';
import {
  UnsupportedTriggerReason,
  type ScheduledTaskDtoMappingResult,
} from '../types/scheduled-task-mapping';
import { apSchedulerDayToJsDay, jsDayToApSchedulerDay } from './cron-weekday';
import { padTwoDigits } from './formatting';

/** Which boundary of a cron activity window is being computed. */
enum CronWindowEdge {
  Start = 'start',
  End = 'end',
}

const CRON_FIELD_KEYS = new Set(['hour', 'minute', 'day_of_week', 'day']);

/**
 * `values.time` placeholder for repeat values that don't use it (`OneTime`,
 * `Hourly`). Matches the Create page's `DEFAULT_VALUES.time` so switching
 * the Repeat dropdown to a time-based cadence (Daily/Weekly/Monthly) on the
 * edit page starts from a reasonable time instead of a silent midnight.
 */
const DEFAULT_TIME_PLACEHOLDER = '09:00';

/**
 * Converts the locally-entered `hour`/`minute` (and, for weekly/monthly
 * recurrence, the locally-selected `dayOfWeek`/`dayOfMonth`) to their UTC
 * equivalents, since DIAL Scheduler executes `cron.fields` in UTC with no
 * per-schedule timezone field. Uses a single reference `Date` and reads its
 * UTC getters back, so the browser's own timezone/DST handling does the
 * conversion instead of manual offset arithmetic.
 *
 * `Hourly` is a partial exception: the `hour` field is always the literal
 * `'*'` (the hour boundary itself is timezone-invariant), but the
 * user-selected `minute`-of-hour still needs local→UTC conversion for
 * sub-hour-offset timezones (e.g. UTC+5:30) — done via a reference `Date`
 * set to local hour `0`/local `minute`, reading back only `getUTCMinutes()`.
 */
const buildCronFields = (
  values: ScheduledTaskCreateFormValues,
): Record<string, string> => {
  if (values.repeat === ScheduledTaskRepeat.Hourly) {
    const reference = new Date();
    reference.setHours(0, Number(values.minute), 0, 0);
    return { hour: '*', minute: String(reference.getUTCMinutes()) };
  }

  const [hourStr, minuteStr] = values.time.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  const reference = new Date();
  reference.setHours(hour, minute, 0, 0);

  const hasDayOfWeek =
    values.repeat === ScheduledTaskRepeat.Weekly && !!values.dayOfWeek;
  const hasDayOfMonth =
    values.repeat === ScheduledTaskRepeat.Monthly && !!values.dayOfMonth;

  if (hasDayOfWeek) {
    const targetLocalDay = apSchedulerDayToJsDay(Number(values.dayOfWeek));
    const diff = (targetLocalDay - reference.getDay() + 7) % 7;
    reference.setDate(reference.getDate() + diff);
  } else if (hasDayOfMonth) {
    reference.setDate(Number(values.dayOfMonth));
  }

  const fields: Record<string, string> = {
    hour: String(reference.getUTCHours()),
    minute: String(reference.getUTCMinutes()),
  };

  if (hasDayOfWeek) {
    fields.day_of_week = String(jsDayToApSchedulerDay(reference.getUTCDay()));
  }
  if (hasDayOfMonth) {
    fields.day = String(reference.getUTCDate());
  }

  return fields;
};

/*
 * Converts a `YYYY-MM-DD` local calendar date (`values.startDate`/`endDate`)
 * to the UTC ISO instant at the start or end of that local day, using the
 * same reference-`Date`-plus-getters technique as `buildCronFields` above:
 * the browser's own timezone/DST handling does the conversion, rather than
 * manual offset arithmetic. `end` resolves to `23:59:59.999` local, not
 * midnight of the next day, so the last local day the user picked stays
 * fully inside the window.
 */
const buildCronWindowBoundary = (
  dateValue: string,
  edge: CronWindowEdge,
): string => {
  const [year, month, day] = dateValue.split('-').map(Number);
  const reference = new Date(year, month - 1, day);
  if (edge === CronWindowEdge.Start) {
    reference.setHours(0, 0, 0, 0);
  } else {
    reference.setHours(23, 59, 59, 999);
  }
  return reference.toISOString();
};

/**
 * Maps validated create-form values to the `POST /api/v1/scheduled-tasks`
 * request body, building `trigger.date` for a one-shot schedule or
 * `trigger.cron.fields` for a recurring one. Assumes the caller has already
 * validated required fields (name, model, prompt, and the active schedule
 * section's fields) — this function does not re-validate.
 */
export const mapFormValuesToCreateBody = (
  values: ScheduledTaskCreateFormValues,
): CreateScheduledTaskBodyDto => {
  const trigger: ScheduleTriggerDto =
    values.repeat === ScheduledTaskRepeat.OneTime
      ? { date: new Date(values.runAt ?? '').toISOString() }
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
    model: values.modelId,
    prompt: values.prompt.trim(),
    ...(trimmedDescription ? { description: trimmedDescription } : {}),
  };
};

/**
 * Maps validated edit-form values to the `PUT /api/v1/scheduled-tasks/:scheduleId`
 * request body. `UpdateScheduledTaskBodyDto` has the same shape as
 * `CreateScheduledTaskBodyDto`, so this reuses the same trigger-building logic.
 */
export const mapFormValuesToUpdateBody = (
  values: ScheduledTaskCreateFormValues,
): UpdateScheduledTaskBodyDto => mapFormValuesToCreateBody(values);

/**
 * Converts a UTC ISO instant to the local `YYYY-MM-DDTHH:mm` string the
 * "Run at" field expects, using `Date`'s local getters so the browser's own
 * timezone/DST handling does the conversion.
 */
const isoToLocalDateTime = (iso: string): string => {
  const date = new Date(iso);
  return (
    `${date.getFullYear()}-${padTwoDigits(date.getMonth() + 1)}-${padTwoDigits(date.getDate())}` +
    `T${padTwoDigits(date.getHours())}:${padTwoDigits(date.getMinutes())}`
  );
};

/**
 * Converts a UTC ISO instant (an activity-window `startDate`/`endDate`
 * boundary) to the local `YYYY-MM-DD` date-only value the "Start date"/"End
 * date" pickers expect.
 */
const isoToLocalDateOnly = (iso: string): string => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${padTwoDigits(date.getMonth() + 1)}-${padTwoDigits(date.getDate())}`;
};

/**
 * Inverts {@link buildCronFields}: given the UTC `hour`/`minute` (and,
 * for weekly/monthly recurrence, the UTC `day_of_week`/`day`) stored on the
 * task, resolves the local wall-clock `time` and, when applicable, the local
 * `dayOfWeek`/`dayOfMonth` — using a single reference `Date` and its local
 * getters, mirroring the forward conversion's reference-`Date` technique.
 *
 * `hour: '*'` (Hourly) is checked first and returns immediately with just
 * the local `minute` (inverting the forward conversion via
 * `setUTCHours(0, utcMinute)` → `getMinutes()`) — there is no local hour to
 * convert, since `hour` is always the literal `'*'`.
 */
const parseCronFields = (
  fields: Record<string, string | null | undefined>,
):
  | { ok: true; isHourly: true; minute: string }
  | {
      ok: true;
      isHourly: false;
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

  if (
    extraKeys.length > 0 ||
    (hasDayOfWeek && hasDayOfMonth) ||
    !presentKeys.has('hour') ||
    !presentKeys.has('minute')
  ) {
    return { ok: false };
  }

  if (
    fields.hour === '*' &&
    /^\d+$/.test(String(fields.minute)) &&
    !hasDayOfWeek &&
    !hasDayOfMonth
  ) {
    const reference = new Date();
    reference.setUTCHours(0, Number(fields.minute), 0, 0);
    return {
      ok: true,
      isHourly: true,
      minute: String(reference.getMinutes()),
    };
  }

  const utcHour = Number(fields.hour);
  const utcMinute = Number(fields.minute);
  if (Number.isNaN(utcHour) || Number.isNaN(utcMinute)) {
    return { ok: false };
  }

  const reference = new Date();
  reference.setUTCHours(utcHour, utcMinute, 0, 0);

  if (hasDayOfWeek) {
    const utcDayOfWeek = Number(fields.day_of_week);
    if (Number.isNaN(utcDayOfWeek)) return { ok: false };
    const targetUtcDay = apSchedulerDayToJsDay(utcDayOfWeek);
    const diff = (targetUtcDay - reference.getUTCDay() + 7) % 7;
    reference.setUTCDate(reference.getUTCDate() + diff);
  } else if (hasDayOfMonth) {
    const utcDay = Number(fields.day);
    if (Number.isNaN(utcDay)) return { ok: false };
    reference.setUTCDate(utcDay);
  }

  return {
    ok: true,
    isHourly: false,
    time: `${padTwoDigits(reference.getHours())}:${padTwoDigits(reference.getMinutes())}`,
    ...(hasDayOfWeek
      ? { dayOfWeek: String(jsDayToApSchedulerDay(reference.getDay())) }
      : {}),
    ...(hasDayOfMonth ? { dayOfMonth: String(reference.getDate()) } : {}),
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
  if (!dto.model || !dto.prompt) {
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

  const base: Pick<
    ScheduledTaskCreateFormValues,
    'displayName' | 'modelId' | 'prompt' | 'description'
  > = {
    displayName: dto.displayName,
    modelId: dto.model,
    prompt: dto.prompt,
    ...(dto.description ? { description: dto.description } : {}),
  };

  if (hasDate) {
    return {
      ok: true,
      values: {
        ...base,
        repeat: ScheduledTaskRepeat.OneTime,
        runAt: isoToLocalDateTime(date as string),
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

  if (parsed.isHourly) {
    return {
      ok: true,
      values: {
        ...base,
        repeat: ScheduledTaskRepeat.Hourly,
        time: DEFAULT_TIME_PLACEHOLDER,
        minute: parsed.minute,
        ...(cron.startDate
          ? { startDate: isoToLocalDateOnly(cron.startDate) }
          : {}),
        ...(cron.endDate ? { endDate: isoToLocalDateOnly(cron.endDate) } : {}),
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
      ...(cron.startDate
        ? { startDate: isoToLocalDateOnly(cron.startDate) }
        : {}),
      ...(cron.endDate ? { endDate: isoToLocalDateOnly(cron.endDate) } : {}),
    },
  };
};
